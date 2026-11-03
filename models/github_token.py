from datetime import datetime, timezone
from models import db
from models.server import encrypt_value, decrypt_value


class GithubToken(db.Model):
    """A GitHub token the user saved under a name (account, purpose...), so it is picked instead of typed again.
    Stored encrypted like server passwords; the token itself is never sent back to the browser."""
    __tablename__ = 'github_tokens'

    id = db.Column(db.Integer, primary_key=True)
    label = db.Column(db.String(80), nullable=False)
    login = db.Column(db.String(80), nullable=True)           # the GitHub account the token belongs to
    token_enc = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    @property
    def token(self) -> str:
        return decrypt_value(self.token_enc)

    @token.setter
    def token(self, val: str):
        self.token_enc = encrypt_value(val)

    def to_dict(self):
        t = self.token or ''
        return {'id': self.id, 'label': self.label, 'login': self.login or '', 'hint': ('…' + t[-4:]) if len(t) >= 8 else ''}
