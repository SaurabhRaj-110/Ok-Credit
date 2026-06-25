# Manages real time stock balance and inventory details

import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List

from app.database import get_db_connection

logger = logging.getLogger("ShopSathiInventory")
router = APIRouter()

class InventoryItem(BaseModel):
    merchant_id: str
    item_name: str
    current_stock: float
    reorder_level: float = 10.0
    price: float = 0.0

@router.get("/items/{merchant_id}", status_code=status.HTTP_200_OK)
def get_inventory(merchant_id: str):
    """
    Through this we fetch all inventory items for a specific merchant.
    Calculates a 'status' (ok, low, reorder) on the fly based on current stock.
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT item_id, item_name, current_stock, reorder_level, price FROM inventory WHERE merchant_id = ? ORDER BY current_stock ASC",
            (merchant_id,)
        )
        rows = cursor.fetchall()
        
        items = []
        for row in rows:
            item_dict = dict(row)
            
            # It safely force values into floats ---
            try:
                c_stock = float(item_dict["current_stock"])
                r_level = float(item_dict["reorder_level"])
            except (ValueError, TypeError):
                c_stock = 0.0
                r_level = 10.0
                
            item_dict["current_stock"] = c_stock
            item_dict["reorder_level"] = r_level
            
            # Add dynamic status for the frontend UI dots (Red/Yellow/Green)
            if c_stock <= (r_level * 0.5):
                item_dict["status"] = "low"      # Red
            elif c_stock <= r_level:
                item_dict["status"] = "reorder"  # Yellow
            else:
                item_dict["status"] = "ok"       # Green
            items.append(item_dict)
            
        return {"status": "SUCCESS", "data": items}
        
    except Exception as e:
        logger.error(f"Failed to fetch inventory: {str(e)}")
        raise HTTPException(status_code=500, detail="Could not retrieve inventory records.")
    finally:
        conn.close()

@router.post("/items", status_code=status.HTTP_201_CREATED)
def add_manual_inventory(payload: InventoryItem):
    """
    Manual fallback route to add/update stock without using voice.
    """
    import uuid
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Check if item exists
        cursor.execute(
            "SELECT item_id FROM inventory WHERE merchant_id = ? AND LOWER(item_name) = ?",
            (payload.merchant_id, payload.item_name.lower().strip())
        )
        row = cursor.fetchone()
        
        if row:
            # Update existing
            cursor.execute(
                "UPDATE inventory SET current_stock = current_stock + ?, price = ? WHERE item_id = ?",
                (payload.current_stock, payload.price, row["item_id"])
            )
            msg = "Stock updated successfully."
        else:
            # Insert new
            new_item_id = f"item_{uuid.uuid4().hex[:6]}"
            cursor.execute(
                "INSERT INTO inventory (item_id, merchant_id, item_name, current_stock, reorder_level, price) VALUES (?, ?, ?, ?, ?, ?)",
                (new_item_id, payload.merchant_id, payload.item_name, payload.current_stock, payload.reorder_level, payload.price)
            )
            msg = "New item added to inventory."
            
        conn.commit()
        return {"status": "SUCCESS", "msg": msg}
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to update inventory manually: {str(e)}")
        raise HTTPException(status_code=500, detail="Database write error.")
    finally:
        conn.close()