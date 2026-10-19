import unittest
from app import create_app
from config import Config
from models import db
from models.user import User
from models.server import Server, encrypt_value, decrypt_value

class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SECRET_KEY = 'test-secret-key'

class ShellManTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestConfig)
        self.client = self.app.test_client()
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_encryption(self):
        secret = "super_secret_ssh_key_or_password_123"
        enc = encrypt_value(secret)
        self.assertNotEqual(secret, enc)
        dec = decrypt_value(enc)
        self.assertEqual(secret, dec)

    def test_user_authentication(self):
        user = User(username='testadmin')
        user.set_password('securepass123')
        db.session.add(user)
        db.session.commit()

        self.assertTrue(user.check_password('securepass123'))
        self.assertFalse(user.check_password('wrongpass'))

    def test_first_time_setup_flow(self):
        # When no users exist, accessing / redirects to /setup
        resp = self.client.get('/')
        self.assertEqual(resp.status_code, 302)
        self.assertIn('/setup', resp.headers['Location'])

        # Accessing /login also redirects to /setup
        resp = self.client.get('/login')
        self.assertEqual(resp.status_code, 302)
        self.assertIn('/setup', resp.headers['Location'])

        # First-time setup post with mismatched passwords fails
        resp = self.client.post('/setup', data={
            'username': 'admin',
            'password': 'password123',
            'confirm_password': 'mismatch'
        }, follow_redirects=True)
        self.assertIn(b'Passwords do not match', resp.data)

        # Successful setup creates the admin account and logs in
        resp = self.client.post('/setup', data={
            'username': 'admin',
            'password': 'password123',
            'confirm_password': 'password123'
        }, follow_redirects=True)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(User.query.count(), 1)
        self.assertIn(b'created successfully', resp.data)

        # Subsequent attempts to access /setup redirect to /login
        resp = self.client.get('/setup')
        self.assertEqual(resp.status_code, 302)
        self.assertIn('/login', resp.headers['Location'])

    def test_mask_ip_filter(self):
        mask_ip = self.app.jinja_env.filters['mask_ip']
        self.assertEqual(mask_ip('20.219.23.4'), '20.219.2***')
        self.assertEqual(mask_ip('20.219.23.4:22'), '20.219.2***:22')
        self.assertEqual(mask_ip('192.168.1.1'), '192.168.***')
        self.assertEqual(mask_ip('1234'), '1234')
        self.assertEqual(mask_ip(''), '')

    def test_server_model_encrypted_fields(self):
        server = Server(
            name="VPS Prod",
            host="192.168.1.50",
            port=22,
            username="root",
            auth_type="password"
        )
        server.password = "ssh_remote_pass"
        db.session.add(server)
        db.session.commit()

        # Check raw stored value is encrypted
        saved = Server.query.filter_by(name="VPS Prod").first()
        self.assertNotEqual(saved.password_enc, "ssh_remote_pass")
        self.assertEqual(saved.password, "ssh_remote_pass")

        # Ensure to_dict does not leak password
        data = saved.to_dict()
        self.assertNotIn('password', data)
        self.assertNotIn('password_enc', data)
        self.assertTrue(data['has_password'])

    def test_batch_file_routes_validation(self):
        # Authenticate via first-time setup
        self.client.post('/setup', data={'username': 'admin', 'password': 'admin123', 'confirm_password': 'admin123'})

        # Add a server
        server = Server(name="Test Box", host="127.0.0.1", port=22, username="user", auth_type="password")
        server.password = "pass"
        db.session.add(server)
        db.session.commit()

        # Batch delete empty paths should fail validation
        res = self.client.post(f'/api/servers/{server.id}/files/batch-delete', json={'paths': []})
        self.assertEqual(res.status_code, 400)

        # Batch move missing dest_dir should fail validation
        res = self.client.post(f'/api/servers/{server.id}/files/batch-move', json={'paths': ['/a']})
        self.assertEqual(res.status_code, 400)

        # Batch copy missing dest_dir should fail validation
        res = self.client.post(f'/api/servers/{server.id}/files/batch-copy', json={'paths': ['/a']})
        self.assertEqual(res.status_code, 400)

        # Batch chmod missing mode should fail validation
        res = self.client.post(f'/api/servers/{server.id}/files/batch-chmod', json={'paths': ['/a']})
        self.assertEqual(res.status_code, 400)

        # Batch archive missing dest_dir should fail validation
        res = self.client.post(f'/api/servers/{server.id}/files/batch-archive', json={'paths': ['/a']})
        self.assertEqual(res.status_code, 400)

if __name__ == '__main__':
    unittest.main()
