import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings

# If a DATABASE_URL is set (e.g. from Render/Supabase for PostgreSQL), use it.
# Otherwise fallback to local SQLite
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # Handle postgres:// vs postgresql:// for older SQLALchemy
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
else:
    # Fallback to local sqlite
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{settings.DATABASE_FILE}"
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()