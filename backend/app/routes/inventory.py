from fastapi import APIRouter, HTTPException, Form, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
import uuid
from app.database import get_db
from app.models import Inventory
from app.services.auth_service import get_current_merchant_id

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
    quantity_change: float

@router.post("/item")
def create_item(item: ItemCreate, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    if item.merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    item_id = "item_" + str(uuid.uuid4().hex)[:10]
    try:
        new_item = Inventory(
            item_id=item_id,
            merchant_id=item.merchant_id,
            item_name=item.item_name,
            current_stock=item.current_stock,
            price=item.price,
            entry_source=item.entry_source
        )
        db.add(new_item)
        db.commit()
        return {"status": "success", "item_id": item_id, "message": "Item added to inventory!"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/item/{item_id}/adjust")
def adjust_stock(item_id: str, adjust: StockAdjust, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    if adjust.merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    try:
        item = db.query(Inventory).filter(Inventory.item_id == item_id, Inventory.merchant_id == adjust.merchant_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
            
        item.current_stock = max(0, item.current_stock + adjust.quantity_change)
        db.commit()
        return {"status": "success", "message": "Stock adjusted successfully!"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/item/{item_id}")
def update_item_full(item_id: str, update: ItemUpdate, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    if update.merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    try:
        item = db.query(Inventory).filter(Inventory.item_id == item_id, Inventory.merchant_id == update.merchant_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
            
        item.item_name = update.item_name
        item.category = update.category
        item.unit = update.unit
        item.current_stock = update.current_stock
        item.reorder_level = update.reorder_level
        item.price = update.price
        item.purchase_price = update.purchase_price
        db.commit()
        return {"status": "success", "message": "Item updated fully successfully!"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/item/{item_id}")
def delete_item(item_id: str, merchant_id: str, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    if merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    try:
        item = db.query(Inventory).filter(Inventory.item_id == item_id, Inventory.merchant_id == merchant_id).first()
        if item:
            db.delete(item)
            db.commit()
            return {"status": "success", "message": "Item removed from inventory."}
        return {"status": "error", "message": "Item not found"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{action_type}")
def process_stock_action(
    action_type: str,
    merchant_id: str = Form(...),
    item_id: str = Form(...),
    item_name: str = Form(...),
    quantity_change: float = Form(0.0),
    price: float = Form(0.0),
    entry_source: str = Form("Manual"),
    db: Session = Depends(get_db),
    jwt_merchant_id: str = Depends(get_current_merchant_id)
):
    if merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    if action_type not in ["ADD_STOCK", "REMOVE_STOCK", "SET_STOCK"]:
        raise HTTPException(status_code=404, detail="Not found")
        
    try:
        item = db.query(Inventory).filter(Inventory.merchant_id == merchant_id, Inventory.item_id == item_id).first()
        if not item:
            item = db.query(Inventory).filter(Inventory.merchant_id == merchant_id, Inventory.item_name.ilike(item_name.strip())).first()
            
        if item:
            if action_type == "ADD_STOCK":
                new_stock = item.current_stock + quantity_change
            elif action_type == "REMOVE_STOCK":
                new_stock = max(0, item.current_stock - abs(quantity_change))
            else: # SET_STOCK
                new_stock = quantity_change
                
            item.current_stock = new_stock
            if price > 0:
                item.price = price
        else:
            actual_item_id = f"item_{uuid.uuid4().hex[:6]}"
            new_stock = quantity_change if action_type in ["ADD_STOCK", "SET_STOCK"] else 0
            
            new_item = Inventory(
                item_id=actual_item_id,
                merchant_id=merchant_id,
                item_name=item_name,
                current_stock=new_stock,
                reorder_level=10.0,
                price=price,
                entry_source=entry_source
            )
            db.add(new_item)
            item = new_item
            
        db.commit()
        return {"status": "success", "item_id": item.item_id}
            
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
