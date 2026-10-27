"""Data layer entry point: `from models import db`. See models/orm.py for the API (SQLite via the standard library)."""
from models.orm import Database

db = Database()
