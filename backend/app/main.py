import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import engine
from app.models import Base
import os

# Initialize SQLAlchemy Database Schema
Base.metadata.create_all(bind=engine)

from app.routes import ai_voice
from app.routes import khata
from app.routes import inventory
from app.routes import snap  
from app.routes import sales
from app.routes import notifications
from app.routes import stats
from app.routes import evidence
from app.routes import auth
from app.routes import usage
from app.routes import admin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ShopSathiCore")

app = FastAPI(title="ShopSathi AI API Gateway", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai_voice.router, prefix="/api/voice", tags=["Voice Engine"])
app.include_router(khata.router, prefix="/api/khata", tags=["Khata Management"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["Stock Management"])
app.include_router(snap.router, prefix="/api/snap", tags=["Vision OCR"])
app.include_router(sales.router, prefix="/api/sales", tags=["Daily Sales"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(stats.router, prefix="/api/stats", tags=["Stats"])
app.include_router(evidence.router, prefix="/api/evidence", tags=["Evidence"])
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(usage.router, prefix="/api/usage", tags=["Usage Tracking"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin Dashboard"])

from app.config import settings
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

@app.on_event("startup")
def on_startup():
    logger.info("Database schemas initialized successfully via SQLAlchemy.")

@app.get("/")
def read_root():
    return {"status": "ONLINE", "message": "ShopSathi Core API Gateway is live."}

@app.get("/api/migrate-db")
def migrate_db():
    try:
        from sqlalchemy import text
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE bills ADD COLUMN IF NOT EXISTS image_path VARCHAR;"))
        return {"status": "SUCCESS", "message": "Migration applied"}
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}
