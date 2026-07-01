from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import uuid
import sqlite3
from app.database import get_db_connection

router = APIRouter()

class NotificationCreate(BaseModel):
    merchant_id: str
    title: str
    message: str
    type: str  # alert, success, info
    category: str # All, Sales, Khata, Stock, System
    reference_id: Optional[str] = None
    reference_type: Optional[str] = None

@router.get("/")
def get_notifications(merchant_id: str):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM notifications 
                WHERE merchant_id = ? 
                ORDER BY timestamp DESC
            """, (merchant_id,))
            rows = cursor.fetchall()
            return {"status": "success", "data": [dict(row) for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def create_notification(payload: NotificationCreate):
    notif_id = "notif_" + str(uuid.uuid4().hex)[:10]
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO notifications (id, merchant_id, title, message, type, category, reference_id, reference_type)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (notif_id, payload.merchant_id, payload.title, payload.message, payload.type, payload.category, payload.reference_id, payload.reference_type))
            conn.commit()
            return {"status": "success", "id": notif_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{notif_id}/read")
def mark_read(notif_id: str, merchant_id: str):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE notifications SET is_read = 1 WHERE id = ? AND merchant_id = ?", (notif_id, merchant_id))
            conn.commit()
            return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/read_all")
def mark_all_read(merchant_id: str):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE notifications SET is_read = 1 WHERE merchant_id = ?", (merchant_id,))
            conn.commit()
            return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{notif_id}")
def delete_notification(notif_id: str, merchant_id: str):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM notifications WHERE id = ? AND merchant_id = ?", (notif_id, merchant_id))
            conn.commit()
            return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/")
def clear_all(merchant_id: str):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM notifications WHERE merchant_id = ?", (merchant_id,))
            conn.commit()
            return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def generate_notification(merchant_id: str, title: str, message: str, type: str, category: str, reference_id: str = None, reference_type: str = None):
    # A synchronous helper function to trigger notifications from other routes
    notif_id = "notif_" + str(uuid.uuid4().hex)[:10]
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO notifications (id, merchant_id, title, message, type, category, reference_id, reference_type)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (notif_id, merchant_id, title, message, type, category, reference_id, reference_type))
            conn.commit()
    except Exception as e:
        print("Failed to generate notification:", e)
