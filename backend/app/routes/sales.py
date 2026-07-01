import sqlite3
from fastapi import APIRouter, HTTPException, Form
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime
from app.database import get_db_connection

router = APIRouter()

class SalesEdit(BaseModel):
    merchant_id: str
    item: str
    qty: float
    amount: float
    note: Optional[str] = ""
    entry_source: Optional[str] = "Manual"

@router.put("/{sale_id}")
def update_sale(sale_id: str, payload: SalesEdit):
    try:
        with get_db_connection() as conn:
            conn.isolation_level = "EXCLUSIVE"
            cursor = conn.cursor()
            
            cursor.execute("SELECT * FROM daily_sales WHERE sale_id = ? AND merchant_id = ?", (sale_id, payload.merchant_id))
            conn.row_factory = sqlite3.Row
            row = cursor.fetchone()
            
            if not row:
                raise HTTPException(status_code=404, detail="Sale not found")
                
            old_qty = row[4] # qty is index 4 if select *
            old_item = row[3] # item is index 3
            
            if old_item.lower() == payload.item.lower() and old_item != "Udhaar Clearance":
                diff = old_qty - payload.qty
                cursor.execute("""
                    UPDATE inventory 
                    SET current_stock = current_stock + ? 
                    WHERE merchant_id = ? AND LOWER(item_name) = ?
                """, (diff, payload.merchant_id, payload.item.lower()))
            
            cursor.execute("""
                UPDATE daily_sales
                SET item = ?, qty = ?, amount = ?, note = ?, entry_source = ?
                WHERE sale_id = ? AND merchant_id = ?
            """, (payload.item, payload.qty, payload.amount, payload.note, payload.entry_source, sale_id, payload.merchant_id))
            
            conn.commit()
            
            from app.routes.notifications import generate_notification
            generate_notification(
                merchant_id=payload.merchant_id,
                title="Sale Updated",
                message=f"Updated sale: {payload.item} for ₹{payload.amount}",
                type="info",
                category="Sales",
                reference_id=sale_id,
                reference_type="SALE"
            )
            
            return {"status": "success", "message": "Sale updated atomically"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SaleCreate(BaseModel):
    merchant_id: str
    type: str
    item: str
    qty: float
    amount: float
    note: Optional[str] = ""
    entry_source: Optional[str] = "Manual"

@router.post("/")
def create_sale(payload: SaleCreate):
    sale_id = "sale_" + str(uuid.uuid4().hex)[:10]
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO daily_sales (sale_id, merchant_id, type, item, qty, amount, note, entry_source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (sale_id, payload.merchant_id, payload.type, payload.item, payload.qty, payload.amount, payload.note, payload.entry_source))
            conn.commit()
            
            from app.routes.notifications import generate_notification
            if payload.entry_source == "Voice":
                title = "Voice Entry Added"
                message = f"New voice entry of ₹{payload.amount} added to sale."
            elif payload.entry_source == "KhataSnap":
                title = "OCR Sale Added"
                message = f"New OCR scanned sale of ₹{payload.amount} added."
            else:
                title = "New Sale Recorded"
                message = f"₹{payload.amount} sale added successfully."
                
            generate_notification(
                merchant_id=payload.merchant_id,
                title=title,
                message=message,
                type="success",
                category="Sales",
                reference_id=sale_id,
                reference_type="SALE"
            )
            
            return {"status": "success", "sale_id": sale_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
