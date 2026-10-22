import secrets
from datetime import datetime, timezone
from models import db

class GitDeployment(db.Model):
    __tablename__ = 'git_deployments'

    id = db.Column(db.Integer, primary_key=True)
    server_id = db.Column(db.Integer, db.ForeignKey('servers.id'), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    repo_url = db.Column(db.String(512), nullable=False)
    target_path = db.Column(db.String(512), nullable=False)
    branch = db.Column(db.String(100), default='main', nullable=False)
    post_deploy_cmd = db.Column(db.Text, nullable=True)
    webhook_token = db.Column(db.String(64), unique=True, nullable=False, default=lambda: secrets.token_urlsafe(32))
    last_status = db.Column(db.String(20), default='pending')  # 'success', 'failed', 'pending'
    last_log = db.Column(db.Text, nullable=True)
    last_deployed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    server = db.relationship('Server', backref=db.backref('git_deployments', cascade='all, delete-orphan'))

    def to_dict(self):
        return {
            'id': self.id,
            'server_id': self.server_id,
            'name': self.name,
            'repo_url': self.repo_url,
            'target_path': self.target_path,
            'branch': self.branch or 'main',
            'post_deploy_cmd': self.post_deploy_cmd or '',
            'webhook_token': self.webhook_token,
            'webhook_url': f"/api/deploy/webhook/{self.webhook_token}",
            'last_status': self.last_status,
            'last_log': self.last_log,
            'last_deployed_at': self.last_deployed_at.isoformat() if self.last_deployed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

