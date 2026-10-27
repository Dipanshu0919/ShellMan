"""
Server-side alerting.

A background thread checks every enabled rule on a schedule, so alerts fire even when no browser is
open. When a rule stays breached for its duration an incident opens and every enabled channel
(Telegram, Slack, Discord, generic webhook, e-mail) is notified; a recovery message follows when the
value is back to normal. In-app, the bell icon and the Alerts page read the same incidents.

Environment
  SHELLMAN_ALERTS=0              turn the background engine off
  SHELLMAN_ALERT_INTERVAL=60     seconds between checks (15-3600)
"""
import hmac
import hashlib
import ipaddress
import json
import logging
import math
import os
import socket
import ssl
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from email.message import EmailMessage
from urllib.parse import urlparse

from models import db
from models.alert import AlertRule, AlertEvent, AlertChannel, METRICS
from models.server import Server

logger = logging.getLogger('shellman.alerts')

METRIC_LABELS = {
    'cpu': 'CPU usage', 'mem': 'Memory usage', 'disk': 'Disk usage', 'swap': 'Swap usage',
    'load': 'Load average (1 min)', 'offline': 'Server unreachable', 'quota': 'Time budget',
}

# Recommended starting rules (offered by the "Add recommended rules" button, never added on their own).
PRESETS = [
    dict(name='Server unreachable', metric='offline', threshold=0, duration_min=2, cooldown_min=60, severity='critical'),
    dict(name='High CPU', metric='cpu', threshold=90, duration_min=5, cooldown_min=60, severity='warning'),
    dict(name='High memory', metric='mem', threshold=90, duration_min=5, cooldown_min=60, severity='warning'),
    dict(name='Disk almost full', metric='disk', threshold=90, duration_min=2, cooldown_min=360, severity='critical'),
]


def _now():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------- URL safety
def check_url(url: str) -> str:
    """Return '' when the URL is acceptable for an outgoing notification, else the reason."""
    try:
        p = urlparse(url or '')
    except Exception:
        return 'Invalid URL'
    if p.scheme not in ('http', 'https') or not p.hostname:
        return 'URL must start with http:// or https://'
    try:
        infos = socket.getaddrinfo(p.hostname, p.port or (443 if p.scheme == 'https' else 80), type=socket.SOCK_STREAM)
    except OSError:
        return 'Host name does not resolve'
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_link_local or ip.is_multicast or ip.is_unspecified or str(ip) == '169.254.169.254':
            return 'Link-local and metadata addresses are not allowed'
    return ''


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """A notification endpoint must answer itself; following a redirect could reach an address we refused."""
    def redirect_request(self, *a, **k):
        return None


_opener = urllib.request.build_opener(_NoRedirect)


def _post_json(url: str, payload: dict, headers: dict = None, timeout: int = 10):
    reason = check_url(url)
    if reason:
        raise RuntimeError(reason)
    data = json.dumps(payload).encode('utf-8')
    h = {'Content-Type': 'application/json', 'User-Agent': 'ShellMan-Alerts/1.0'}
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=h, method='POST')
    with _opener.open(req, timeout=timeout) as resp:
        resp.read(2048)
        return resp.status


# ---------------------------------------------------------------- senders
def _send_telegram(cfg, title, text, event):
    token, chat = (cfg.get('bot_token') or '').strip(), (cfg.get('chat_id') or '').strip()
    if not token or not chat:
        raise RuntimeError('Bot token and chat id are required')
    _post_json(f"https://api.telegram.org/bot{token}/sendMessage", {'chat_id': chat, 'text': f"{title}\n{text}"})


def _send_slack(cfg, title, text, event):
    _post_json(cfg.get('url', ''), {'text': f"*{title}*\n{text}"})


def _send_discord(cfg, title, text, event):
    _post_json(cfg.get('url', ''), {'content': f"**{title}**\n{text}"[:1900]})


def _send_webhook(cfg, title, text, event):
    body = {'title': title, 'text': text, 'event': event}
    headers = {}
    secret = cfg.get('secret') or ''
    if secret:
        raw = json.dumps(body).encode('utf-8')
        headers['X-ShellMan-Signature'] = 'sha256=' + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    _post_json(cfg.get('url', ''), body, headers)


def _send_email(cfg, title, text, event):
    host = (cfg.get('host') or '').strip()
    to = [a.strip() for a in (cfg.get('to') or '').replace(';', ',').split(',') if a.strip()]
    if not host or not to:
        raise RuntimeError('SMTP host and at least one recipient are required')
    port = int(cfg.get('port') or 587)
    mode = (cfg.get('security') or 'starttls').lower()
    msg = EmailMessage()
    msg['Subject'] = title
    msg['From'] = cfg.get('from') or cfg.get('username') or 'shellman@localhost'
    msg['To'] = ', '.join(to)
    msg.set_content(text)
    import smtplib  # imported on demand, only used for email alerts
    ctx = ssl.create_default_context()
    if mode == 'ssl':
        smtp = smtplib.SMTP_SSL(host, port, timeout=15, context=ctx)
    else:
        smtp = smtplib.SMTP(host, port, timeout=15)
    try:
        smtp.ehlo()
        if mode == 'starttls':
            smtp.starttls(context=ctx)
            smtp.ehlo()
        if cfg.get('username'):
            smtp.login(cfg['username'], cfg.get('password') or '')
        smtp.send_message(msg)
    finally:
        try:
            smtp.quit()
        except Exception:
            pass


SENDERS = {'telegram': _send_telegram, 'slack': _send_slack, 'discord': _send_discord,
           'webhook': _send_webhook, 'email': _send_email}


def send_to_channel(channel: AlertChannel, title: str, text: str, event: dict) -> str:
    """Send one message; returns '' on success or an error string. Never raises."""
    try:
        SENDERS[channel.kind](channel.config, title, text, event)
        return ''
    except urllib.error.HTTPError as e:
        return f"HTTP {e.code}"
    except Exception as e:
        return str(e)[:200]


def format_message(ev: AlertEvent, state: str):
    label = METRIC_LABELS.get(ev.metric, ev.metric)
    if state == 'resolved':
        title = f"[RESOLVED] {ev.rule_name} on {ev.server_name}"
        text = f"{label} is back to normal on {ev.server_name}. Peak value {_fmt(ev.metric, ev.peak)}."
    else:
        tag = 'CRITICAL' if ev.severity == 'critical' else 'WARNING'
        title = f"[{tag}] {ev.rule_name} on {ev.server_name}"
        text = ev.message or f"{label} on {ev.server_name}: {_fmt(ev.metric, ev.value)}"
    return title, text


def _fmt(metric, value):
    if metric == 'offline' or value is None:
        return 'unreachable' if metric == 'offline' else 'n/a'
    return f"{value:g}" if metric == 'load' else f"{value:g}%"


def notify_async(app, event_id: int, state: str):
    """Fan out in a worker thread so slow channels never delay the check loop."""
    threading.Thread(target=_notify, args=(app, event_id, state), daemon=True).start()


def _notify(app, event_id, state):
    with app.app_context():
        ev = db.session.get(AlertEvent, event_id)
        if not ev:
            return
        title, text = format_message(ev, state)
        payload = {'state': state, 'rule': ev.rule_name, 'server': ev.server_name, 'metric': ev.metric,
                   'severity': ev.severity, 'value': ev.value, 'peak': ev.peak,
                   'started_at': ev.started_at.replace(tzinfo=timezone.utc).isoformat() if ev.started_at else None}
        for ch in AlertChannel.query.filter_by(enabled=True).all():
            if ch.min_severity == 'critical' and ev.severity != 'critical':
                continue
            err = send_to_channel(ch, title, text, payload)
            ch.last_status = ('failed: ' + err) if err else 'sent'
            ch.last_sent_at = _now()
        db.session.commit()


# ---------------------------------------------------------------- engine
class AlertEngine:
    def __init__(self):
        self.app = None
        self.interval = 60
        self.thread = None
        self.running = False
        self.last_tick = None
        self.last_error = ''
        self._state = {}          # (rule_id, server_id) -> dict(breach, ok, firing, event_id, last_notified)
        self._lock_fd = None
        self._wake = threading.Event()

    # -- lifecycle
    def start(self, app):
        if os.environ.get('SHELLMAN_ALERTS', '1') == '0' or self.running:
            return False
        if not self._acquire_process_lock(app):
            return False       # another gunicorn worker already runs the engine
        self.app = app
        try:
            self.interval = max(15, min(3600, int(os.environ.get('SHELLMAN_ALERT_INTERVAL', '60'))))
        except ValueError:
            self.interval = 60
        self.running = True
        self.thread = threading.Thread(target=self._loop, name='shellman-alerts', daemon=True)
        self.thread.start()
        return True

    def _acquire_process_lock(self, app):
        try:
            import fcntl
            path = os.path.join(app.instance_path if os.path.isdir(app.instance_path) else os.getcwd(), '.alerts.lock')
            os.makedirs(os.path.dirname(path), exist_ok=True)
            fd = open(path, 'w')
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self._lock_fd = fd
            return True
        except ImportError:
            return True        # Windows: single process assumed
        except OSError:
            return False

    def status(self):
        return {'running': self.running, 'interval': self.interval,
                'last_tick': self.last_tick.isoformat() if self.last_tick else None,
                'last_error': self.last_error}

    def check_now(self):
        self._wake.set()

    def _loop(self):
        time.sleep(5)
        with self.app.app_context():
            self._restore_open_incidents()
        while self.running:
            try:
                with self.app.app_context():
                    self.tick()
                self.last_error = ''
            except Exception as e:
                self.last_error = str(e)[:200]
                logger.exception('alert tick failed')
            finally:
                try:
                    db.session.remove()
                except Exception:
                    pass
            self.last_tick = _now()
            self._wake.wait(self.interval)
            self._wake.clear()

    # -- evaluation
    def _restore_open_incidents(self):
        for ev in AlertEvent.query.filter(AlertEvent.resolved_at.is_(None)).all():
            key = (ev.rule_id, ev.server_id)
            self._state[key] = {'breach': 99, 'ok': 0, 'firing': True, 'event_id': ev.id, 'last_notified': time.time()}

    @staticmethod
    def metric_value(metric, m):
        if metric == 'cpu':
            return float(m.get('cpu') or 0)
        if metric == 'mem':
            return float((m.get('memory') or {}).get('percent') or 0)
        if metric == 'swap':
            return float((m.get('swap') or {}).get('percent') or 0)
        if metric == 'load':
            load = m.get('load') or [0]
            return float(load[0] or 0)
        if metric == 'disk':
            fs = (m.get('disk') or {}).get('filesystems') or []
            vals = [float(d.get('percent') or 0) for d in fs]
            return max(vals) if vals else float((m.get('disk') or {}).get('percent') or 0)
        return 0.0

    def tick(self):
        from services.monitoring import SystemMonitor
        try:
            from services import quota
            quota.tick(self.app, self.interval)
        except Exception:
            logger.exception('quota tick failed')
        rules = AlertRule.query.filter_by(enabled=True).all()
        servers = {s.id: s for s in Server.query.all()}
        wanted = {}                      # server_id -> [rules]
        for r in rules:
            targets = [r.server_id] if r.server_id else list(servers.keys())
            for sid in targets:
                if sid in servers:
                    wanted.setdefault(sid, []).append(r)

        self._close_orphans(rules, servers)

        # Servers without alert rules are still read once per check so their history graphs and the fleet page fill.
        try:
            from services import history
            if history.enabled():
                for sid in servers:
                    wanted.setdefault(sid, [])
        except Exception:
            logger.exception('history setup failed')

        for sid, rs in wanted.items():
            server = servers[sid]
            if server.is_codespace:
                # A stopped Codespace is not "down", and connecting to it would start it (and use quota).
                from services import codespace as _cs
                info = _cs.cached_state(server.id)
                if info is None or not info['available']:
                    continue
            try:
                metrics = SystemMonitor.get_quick_metrics(server, force=True)
            except Exception as e:
                metrics = {'error': str(e)}
            offline = 'error' in metrics
            try:
                server.is_online = not offline
                if not offline:
                    server.last_check = _now()
                db.session.commit()
            except Exception:
                db.session.rollback()
            if not offline:
                try:
                    from services import history
                    history.record(sid, metrics)
                except Exception:
                    logger.exception('history record failed')
            for r in rs:
                self._evaluate(r, server, metrics, offline)

    def _close_orphans(self, rules, servers):
        active = {}
        for r in rules:
            for sid in ([r.server_id] if r.server_id else servers.keys()):
                active[(r.id, sid)] = True
        for ev in AlertEvent.query.filter(AlertEvent.resolved_at.is_(None)).all():
            if (ev.rule_id, ev.server_id) not in active:
                ev.resolved_at = _now()
                ev.message = (ev.message or '') + ' (closed: rule disabled, deleted or server removed)'
                self._state.pop((ev.rule_id, ev.server_id), None)
        db.session.commit()

    def _evaluate(self, rule, server, metrics, offline):
        key = (rule.id, server.id)
        st = self._state.setdefault(key, {'breach': 0, 'ok': 0, 'firing': False, 'event_id': None, 'last_notified': 0})
        need = max(1, math.ceil(max(0, rule.duration_min) * 60 / self.interval))

        if rule.metric == 'offline':
            breached, value = offline, None
        else:
            if offline:
                return            # cannot judge a metric without data; the offline rule covers this
            value = self.metric_value(rule.metric, metrics)
            breached = value >= rule.threshold

        if breached:
            st['breach'] += 1
            st['ok'] = 0
            if not st['firing'] and st['breach'] >= need:
                self._fire(rule, server, st, value)
            elif st['firing']:
                self._update_open(rule, server, st, value)
        else:
            st['breach'] = 0
            if st['firing']:
                st['ok'] += 1
                if st['ok'] >= 2:        # two clean checks in a row, so a flapping value does not spam
                    self._resolve(rule, server, st)

    def _message(self, rule, server, value):
        label = METRIC_LABELS.get(rule.metric, rule.metric)
        if rule.metric == 'offline':
            return f"{server.name} has not answered SSH checks" + (f" for {rule.duration_min} min." if rule.duration_min else ".")
        unit = '' if rule.metric == 'load' else '%'
        span = f" for {rule.duration_min} min" if rule.duration_min else ""
        return f"{label} on {server.name} is {value:g}{unit}, at or above {rule.threshold:g}{unit}{span}."

    def _fire(self, rule, server, st, value):
        ev = AlertEvent(rule_id=rule.id, rule_name=rule.name, server_id=server.id, server_name=server.name,
                        metric=rule.metric, severity=rule.severity, value=value, peak=value,
                        message=self._message(rule, server, value))
        db.session.add(ev)
        db.session.commit()
        st.update(firing=True, event_id=ev.id, last_notified=time.time(), ok=0)
        try:
            from services.audit import audit
            audit('alert.fired', target=f"{rule.name} on {server.name}", detail=ev.message, ok=False, username='alerts')
        except Exception:
            pass
        notify_async(self.app, ev.id, 'firing')

    def _update_open(self, rule, server, st, value):
        ev = db.session.get(AlertEvent, st['event_id']) if st.get('event_id') else None
        if not ev or ev.resolved_at:
            st.update(firing=False, event_id=None)
            return
        ev.value = value
        if value is not None and (ev.peak is None or value > ev.peak):
            ev.peak = value
        db.session.commit()
        if rule.cooldown_min and time.time() - st['last_notified'] >= rule.cooldown_min * 60:
            st['last_notified'] = time.time()
            ev.message = self._message(rule, server, value) + ' Still firing.'
            db.session.commit()
            notify_async(self.app, ev.id, 'firing')

    def _resolve(self, rule, server, st):
        ev = db.session.get(AlertEvent, st['event_id']) if st.get('event_id') else None
        st.update(firing=False, event_id=None, breach=0, ok=0)
        if not ev or ev.resolved_at:
            return
        ev.resolved_at = _now()
        db.session.commit()
        notify_async(self.app, ev.id, 'resolved')


engine = AlertEngine()
