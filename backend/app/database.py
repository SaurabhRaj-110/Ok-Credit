import sqlite3
from app.config import settings

def get_db_connection():
    conn = sqlite3.connect(settings.DATABASE_FILE)
    # This row factory allows us to access data by column name like a dictionary
    conn.row_factory = sqlite3.Row
    return conn