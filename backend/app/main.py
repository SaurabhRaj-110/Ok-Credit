import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import get_db_connection

from app.routes import ai_voice
from app.routes import khata
from app.routes import inventory
from app.routes import snap  
from app.routes import sales

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

# Mount uploads directory for images
import os
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

def materialize_tables():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS merchants (
                merchant_id TEXT PRIMARY KEY,
                phone_number TEXT UNIQUE NOT NULL,
                shop_name TEXT NOT NULL,
                owner_name TEXT NOT NULL
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS parties (
                party_id TEXT PRIMARY KEY,
                merchant_id TEXT NOT NULL,
                name TEXT NOT NULL,
                phone_number TEXT,
                party_type TEXT CHECK(party_type IN ('CUSTOMER', 'SUPPLIER')) NOT NULL,
                total_balance REAL DEFAULT 0.0,
                notes TEXT DEFAULT '',
                FOREIGN KEY(merchant_id) REFERENCES merchants(merchant_id)
            );
        """)
        try:
            cursor.execute("ALTER TABLE parties ADD COLUMN notes TEXT DEFAULT ''")
        except:
            pass # Column already exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS inventory (
                item_id TEXT PRIMARY KEY,
                merchant_id TEXT NOT NULL,
                item_name TEXT NOT NULL,
                category TEXT DEFAULT 'General',
                unit TEXT DEFAULT 'items',
                current_stock REAL NOT NULL,
                reorder_level REAL DEFAULT 10.0,
                price REAL NOT NULL,
                purchase_price REAL DEFAULT 0.0,
                FOREIGN KEY(merchant_id) REFERENCES merchants(merchant_id)
            );
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS daily_sales (
                sale_id TEXT PRIMARY KEY,
                merchant_id TEXT NOT NULL,
                type TEXT NOT NULL,
                item TEXT,
                qty REAL,
                amount REAL NOT NULL,
                note TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(merchant_id) REFERENCES merchants(merchant_id)
            );
        """)
        
        # This adds the missing transactions table schema to keep tracks historical ---
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                transaction_id TEXT PRIMARY KEY,
                party_id TEXT NOT NULL,
                merchant_id TEXT NOT NULL,
                amount REAL NOT NULL,
                txn_type TEXT CHECK(txn_type IN ('GIVEN', 'GOT')) NOT NULL,
                entry_source TEXT NOT NULL,
                voice_transcript TEXT,
                image_path TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(party_id) REFERENCES parties(party_id),
                FOREIGN KEY(merchant_id) REFERENCES merchants(merchant_id)
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bills (
                bill_id TEXT PRIMARY KEY,
                merchant_id TEXT NOT NULL,
                party_id TEXT,
                bill_type TEXT,
                total_amount REAL,
                bill_date TEXT,
                image_path TEXT,
                items_hash TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(merchant_id) REFERENCES merchants(merchant_id),
                FOREIGN KEY(party_id) REFERENCES parties(party_id)
            );
        """)
        conn.commit()
        logger.info("Database schemas initialized successfully.")

@app.on_event("startup")
def on_startup():
    materialize_tables()

@app.get("/")
def read_root():
    return {"status": "ONLINE", "message": "ShopSathi Core API Gateway is live."}
