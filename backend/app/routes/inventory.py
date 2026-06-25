from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import uuid
from app.database import get_db_connection

router = APIRouter()

class ItemCreate(BaseModel):
    merchant_id: str
    item_name: str
    current_stock: float
    price: float

class StockAdjust(BaseModel):
    merchant_id: str
    quantity_change: float # Positive to add stock, negative to remove

@router.post("/item")
def create_item(item: ItemCreate):
    item_id = "item_" + str(uuid.uuid4().hex)[:10]
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO inventory (item_id, merchant_id, item_name, current_stock, price)
                VALUES (?, ?, ?, ?, ?)
            """, (item_id, item.merchant_id, item.item_name, item.current_stock, item.price))
            conn.commit()
            return {"status": "success", "item_id": item_id, "message": "Item added to inventory!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/item/{item_id}/adjust")
def adjust_stock(item_id: str, adjust: StockAdjust):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE inventory 
                SET current_stock = MAX(0, current_stock + ?) 
                WHERE item_id = ? AND merchant_id = ?
            """, (adjust.quantity_change, item_id, adjust.merchant_id))
            conn.commit()
            return {"status": "success", "message": "Stock adjusted successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/item/{item_id}")
def delete_item(item_id: str, merchant_id: str):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM inventory WHERE item_id = ? AND merchant_id = ?", (item_id, merchant_id))
            conn.commit()
            return {"status": "success", "message": "Item removed from inventory."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))