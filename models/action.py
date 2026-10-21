from datetime import datetime, timezone
from models import db

class CustomAction(db.Model):
    __tablename__ = 'custom_actions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255), default="")
    icon = db.Column(db.String(50), default="terminal")
    command = db.Column(db.Text, nullable=False)

    # Availability: 'files', 'folders', 'both', 'multiple'
    target_type = db.Column(db.String(20), default="both")
    file_extensions = db.Column(db.String(255), default="")  # Comma-separated, e.g. "zip,tar.gz"

    # Server Scope: NULL = all servers, or bound to a specific server_id
    server_id = db.Column(db.Integer, db.ForeignKey('servers.id'), nullable=True)

    # Output Routing: 'panel' or 'terminal'
    output_target = db.Column(db.String(20), default="panel")

    require_confirm = db.Column(db.Boolean, default=True)
    timeout = db.Column(db.Integer, default=30)
    is_builtin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'description': self.description or '',
            'icon': self.icon or 'terminal',
            'command': self.command,
            'target_type': self.target_type or 'both',
            'file_extensions': self.file_extensions or '',
            'server_id': self.server_id,
            'output_target': self.output_target or 'panel',
            'require_confirm': bool(self.require_confirm),
            'timeout': self.timeout or 30,
            'is_builtin': bool(self.is_builtin),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    @staticmethod
    def seed_default_actions():
        """Ensure standard built-in actions are available if table is empty."""
        defaults = [
            {
                'name': 'Deploy Website',
                'description': "Runs the user's deployment script on the server",
                'icon': 'deploy',
                'command': 'if [ -f ./deploy.sh ]; then bash ./deploy.sh; elif [ -f ./package.json ]; then npm run build; else echo "No deploy.sh or package.json found in directory"; exit 1; fi',
                'target_type': 'folders',
                'file_extensions': '',
                'output_target': 'panel',
                'require_confirm': True,
                'timeout': 60,
                'is_builtin': True
            },
            {
                'name': 'Check Permissions',
                'description': 'Checks selected file and folder permissions and POSIX attributes',
                'icon': 'shield',
                'command': 'ls -ld {{selected_path}} && stat {{selected_path}} 2>&1',
                'target_type': 'both',
                'file_extensions': '',
                'output_target': 'panel',
                'require_confirm': False,
                'timeout': 15,
                'is_builtin': True
            },
            {
                'name': 'Generate Checksum',
                'description': 'Calculates SHA-256 for selected files',
                'icon': 'checksum',
                'command': 'sha256sum {{selected_path}}',
                'target_type': 'files',
                'file_extensions': '',
                'output_target': 'panel',
                'require_confirm': False,
                'timeout': 30,
                'is_builtin': True
            },
            {
                'name': 'Extract Archive',
                'description': 'Safely extracts compressed archive into current directory',
                'icon': 'archive',
                'command': 'case "{{selected_name}}" in *.zip) unzip -o {{selected_path}} -d {{current_dir}} ;; *.tar.gz|*.tgz) tar -xzf {{selected_path}} -C {{current_dir}} ;; *.tar.bz2) tar -xjf {{selected_path}} -C {{current_dir}} ;; *.tar.xz) tar -xJf {{selected_path}} -C {{current_dir}} ;; *.tar) tar -xf {{selected_path}} -C {{current_dir}} ;; *) echo "Unsupported archive format" ; exit 1 ;; esac',
                'target_type': 'files',
                'file_extensions': 'zip,tar,tar.gz,tgz,tar.bz2,tar.xz',
                'output_target': 'panel',
                'require_confirm': True,
                'timeout': 60,
                'is_builtin': True
            },
            {
                'name': 'View Nginx Logs',
                'description': 'Inspects recent lines of Nginx access and error logs',
                'icon': 'file-text',
                'command': 'echo "=== Error Log (Last 40 lines) ===" && tail -n 40 /var/log/nginx/error.log 2>/dev/null || echo "No error log found" ; echo "" && echo "=== Access Log (Last 40 lines) ===" && tail -n 40 /var/log/nginx/access.log 2>/dev/null || echo "No access log found"',
                'target_type': 'both',
                'file_extensions': '',
                'output_target': 'panel',
                'require_confirm': False,
                'timeout': 15,
                'is_builtin': True
            }
        ]

        count = CustomAction.query.count()
        if count == 0:
            for item in defaults:
                act = CustomAction(
                    name=item['name'],
                    description=item['description'],
                    icon=item['icon'],
                    command=item['command'],
                    target_type=item['target_type'],
                    file_extensions=item['file_extensions'],
                    output_target=item['output_target'],
                    require_confirm=item['require_confirm'],
                    timeout=item['timeout'],
                    is_builtin=item['is_builtin']
                )
                db.session.add(act)
            db.session.commit()

