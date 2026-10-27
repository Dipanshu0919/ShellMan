from models import db


class MetricSample(db.Model):
    """One CPU / memory / disk reading of one server (about one per minute). Powers history graphs and the fleet page."""
    __tablename__ = 'metric_samples'

    id = db.Column(db.Integer, primary_key=True)
    server_id = db.Column(db.Integer, nullable=False, index=True)
    ts = db.Column(db.Integer, nullable=False, index=True)     # unix seconds (UTC)
    cpu = db.Column(db.Float, nullable=True)                    # percent
    mem = db.Column(db.Float, nullable=True)                    # percent
    disk = db.Column(db.Float, nullable=True)                   # percent of the fullest filesystem
    load1 = db.Column(db.Float, nullable=True)


class AppSetting(db.Model):
    """Small key/value settings (history on/off and how long to keep it)."""
    __tablename__ = 'app_settings'

    key = db.Column(db.String(40), primary_key=True)
    value = db.Column(db.String(80), nullable=False, default='')
