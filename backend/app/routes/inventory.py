from fastapi import APIRouter, HTTPException, Form
from pydantic import BaseModel
from typing import Optional
import uuid
from app.database import get_db_connection

router = APIRouter()

class ItemCreate(BaseModel):
    merchant_id: str
    item_name: str
    current_stock: float
    price: float
    entry_source: Optional[str] = "Manual"

class ItemUpdate(BaseModel):
    merchant_id: str
    item_name: str
    category: str
    unit: str
    current_stock: float
    reorder_level: float
    price: float
    purchase_price: float

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
                INSERT INTO inventory (item_id, merchant_id, item_name, current_stock, price, entry_source)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (item_id, item.merchant_id, item.item_name, item.current_stock, item.price, item.entry_source))
            conn.commit()
            
            from app.routes.notifications import generate_notification
            generate_notification(
                merchant_id=item.merchant_id,
                title="New Item Created",
                message=f"Created {item.item_name} with {item.current_stock} stock.",
                type="success",
                category="Stock",
                reference_id=item_id,
                reference_type="INVENTORY"
            )
            
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

@router.put("/item/{item_id}")
def update_item_full(item_id: str, update: ItemUpdate):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE inventory 
                SET item_name = ?, category = ?, unit = ?, current_stock = ?, reorder_level = ?, price = ?, purchase_price = ?
                WHERE item_id = ? AND merchant_id = ?
            """, (update.item_name, update.category, update.unit, update.current_stock, update.reorder_level, update.price, update.purchase_price, item_id, update.merchant_id))
            conn.commit()
            return {"status": "success", "message": "Item updated fully successfully!"}
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

@router.post("/{action_type}")
def process_stock_action(
    action_type: str,
    merchant_id: str = Form(...),
    item_id: str = Form(...),
    item_name: str = Form(...),
    quantity_change: float = Form(0.0),
    price: float = Form(0.0),
    entry_source: str = Form("Manual")
):
    if action_type not in ["ADD_STOCK", "REMOVE_STOCK", "SET_STOCK"]:
        raise HTTPException(status_code=404, detail="Not found")
        
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check if item exists
            cursor.execute("SELECT item_id, current_stock FROM inventory WHERE merchant_id = ? AND item_id = ?", (merchant_id, item_id))
            row = cursor.fetchone()
            
            if not row:
                # Fallback check by name (in case frontend generated a fake timestamp ID)
                cursor.execute("SELECT item_id, current_stock FROM inventory WHERE merchant_id = ? AND LOWER(item_name) = ?", (merchant_id, item_name.lower().strip()))
                row = cursor.fetchone()
                
            if row:
                actual_item_id = row["item_id"]
                current_stock = row["current_stock"]
                
                if action_type == "ADD_STOCK":
                    new_stock = current_stock + quantity_change
                elif action_type == "REMOVE_STOCK":
                    new_stock = max(0, current_stock - abs(quantity_change))
                else: # SET_STOCK
                    new_stock = quantity_change
                    
                cursor.execute("""
                    UPDATE inventory 
                    SET current_stock = ?, price = ?
                    WHERE item_id = ?
                """, (new_stock, price if price > 0 else 0, actual_item_id))
            else:
                # Create new item
                actual_item_id = f"item_{uuid.uuid4().hex[:6]}"
                
                if action_type == "ADD_STOCK" or action_type == "SET_STOCK":
                    new_stock = quantity_change
                else:
                    new_stock = 0
                    
                cursor.execute("""
                    INSERT INTO inventory (item_id, merchant_id, item_name, current_stock, reorder_level, price, entry_source)
                    VALUES (?, ?, ?, ?, 10.0, ?, ?)
                """, (actual_item_id, merchant_id, item_name, new_stock, price, entry_source))
                
            conn.commit()
            
            from app.routes.notifications import generate_notification
            
            if action_type == "ADD_STOCK" and quantity_change > 0:
                generate_notification(
                    merchant_id=merchant_id,
                    title="Stock Increased",
                    message=f"Added {quantity_change} to {item_name}.",
                    type="success",
                    category="Stock",
                    reference_id=actual_item_id,
                    reference_type="INVENTORY"
                )
            elif action_type == "REMOVE_STOCK" and quantity_change > 0:
                generate_notification(
                    merchant_id=merchant_id,
                    title="Stock Reduced",
                    message=f"Removed {quantity_change} from {item_name}.",
                    type="info",
                    category="Stock",
                    reference_id=actual_item_id,
                    reference_type="INVENTORY"
                )
                
            if new_stock == 0:
                generate_notification(
                    merchant_id=merchant_id,
                    title="Out of Stock",
                    message=f"{item_name} is now out of stock!",
                    type="alert",
                    category="Stock",
                    reference_id=actual_item_id,
                    reference_type="INVENTORY"
                )
            elif new_stock <= 10.0: # Assuming default reorder_level is 10.0
                generate_notification(
                    merchant_id=merchant_id,
                    title="Low Stock Alert",
                    message=f"{item_name} is running low ({new_stock} remaining).",
                    type="alert",
                    category="Stock",
                    reference_id=actual_item_id,
                    reference_type="INVENTORY"
                )
                
            return {"status": "success", "item_id": actual_item_id}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))