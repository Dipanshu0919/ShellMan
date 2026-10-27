"""Terminal session recording: the commands a person typed, one audit entry per Enter.

What it records is the typed line, not the screen. That keeps it small and readable, and it means a program's
output (which may hold secrets) is never stored. Things that cannot be known from keystrokes alone are marked:
  * Tab completion      -> the line gets "[Tab]" because the shell finished the word, not the user.
  * Up/Down arrow       -> "[history recall]" because the line came from shell history.
  * Password prompts    -> the input is never stored; "[hidden input]" is written instead.
Common secret-looking values (password=..., -pSECRET, --token ...) are replaced by ***.
"""
import re
import time

_SECRET_PROMPT = re.compile(r'(pass(word|phrase|code)|pin|secret|token|verification code|otp)[^\n]{0,60}:\s*$', re.I)
_SECRET_ARG = re.compile(
    r'(?i)((?:--?(?:password|passwd|pass|token|secret|api[-_]?key)[= ]|\b(?:password|passwd|token|secret|api[-_]?key)=|-p))'
    r'(?=\S)(\S+)')
MAX_LINE = 1500
MAX_LINES_PER_SESSION = 3000


def redact(text):
    return _SECRET_ARG.sub(lambda m: m.group(1) + '***', text)


class LineRecorder:
    """Feed it what the client types (feed) and what the server prints (note_output); it calls on_line(text)."""

    def __init__(self, on_line):
        self.on_line = on_line
        self.buf = []
        self.esc = ''            # escape sequence being skipped
        self.tab = False
        self.recall = False
        self.hidden = False      # the last screen text looked like a password prompt
        self.tail = ''           # last screen text, for prompt detection
        self.count = 0
        self.started = time.time()

    # -- what the server printed
    def note_output(self, text):
        if not text:
            return
        self.tail = (self.tail + text)[-200:]
        self.hidden = bool(_SECRET_PROMPT.search(self.tail.replace('\r', '\n').split('\n')[-1]))

    # -- what the user typed
    def feed(self, data):
        for ch in data or '':
            if self.esc:
                self.esc += ch
                if self._escape_done():
                    self._finish_escape()
                continue
            if ch == '\x1b':
                self.esc = ch
            elif ch in '\r\n':
                self._enter()
            elif ch in '\x7f\b':
                if self.buf:
                    self.buf.pop()
            elif ch == '\x15' or ch == '\x03':        # Ctrl-U / Ctrl-C: line thrown away
                self._reset()
            elif ch == '\x17':                        # Ctrl-W: delete last word
                while self.buf and self.buf[-1] == ' ':
                    self.buf.pop()
                while self.buf and self.buf[-1] != ' ':
                    self.buf.pop()
            elif ch == '\t':
                self.tab = True
            elif ch >= ' ':
                if len(self.buf) < MAX_LINE:
                    self.buf.append(ch)

    def _escape_done(self):
        e = self.esc
        if len(e) == 2:
            return e[1] not in '[O'                   # ESC x (alt key); ESC [ and ESC O continue
        if e[1] == 'O':
            return len(e) >= 3
        last = e[-1]
        return len(e) > 2 and '@' <= last <= '~'      # CSI ends on a letter or ~

    def _finish_escape(self):
        e, self.esc = self.esc, ''
        if e.endswith('A') or e.endswith('B') or e in ('\x1bOA', '\x1bOB'):
            self.recall = True

    def _reset(self):
        self.buf, self.tab, self.recall = [], False, False

    def _enter(self):
        text = ''.join(self.buf).strip()
        notes = []
        if self.hidden:
            text, notes = '[hidden input]', []
        else:
            text = redact(text)
            if self.tab:
                notes.append('[Tab]')
            if self.recall:
                notes.append('[history recall]')
        if self.hidden or text or self.recall:
            if not text:
                text = '(empty)'
            if self.count < MAX_LINES_PER_SESSION:
                self.count += 1
                self.on_line((text + ' ' + ' '.join(notes)).strip())
        self.hidden = False
        self.tail = ''
        self._reset()
