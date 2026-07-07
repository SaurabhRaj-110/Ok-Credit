from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
import uuid
from app.database import get_db
from app.models import DailySale, Inventory
from app.services.auth_service import get_current_merchant_id

router = APIRouter()

class SalesEdit(BaseModel):
    merchant_id: str
    item: str
    qty: float
    amount: float
    note: Optional[str] = ""
    entry_source: Optional[str] = "Manual"

@router.put("/{sale_id}")
def update_sale(sale_id: str, payload: SalesEdit, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    if payload.merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    try:
        sale = db.query(DailySale).filter(DailySale.sale_id == sale_id, DailySale.merchant_id == payload.merchant_id).first()
        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found")
            
        old_qty = sale.qty if sale.qty else 0
        old_item = sale.item if sale.item else ""
        
        if old_item.lower() == payload.item.lower() and old_item != "Udhaar Clearance":
            diff = old_qty - payload.qty
            inventory = db.query(Inventory).filter(
                Inventory.merchant_id == payload.merchant_id, 
                Inventory.item_name.ilike(payload.item)
            ).first()
            if inventory:
                inventory.current_stock += diff
                
        sale.item = payload.item
        sale.qty = payload.qty
        sale.amount = payload.amount
        sale.note = payload.note
        sale.entry_source = payload.entry_source
        
        db.commit()
        return {"status": "success", "message": "Sale updated atomically"}
    except Exception as e:
        db.rollback()
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
def create_sale(payload: SaleCreate, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    if payload.merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    sale_id = "sale_" + str(uuid.uuid4().hex)[:10]
    try:
        new_sale = DailySale(
            sale_id=sale_id,
            merchant_id=payload.merchant_id,
            type=payload.type,
            item=payload.item,
            qty=payload.qty,
            amount=payload.amount,
            note=payload.note,
            entry_source=payload.entry_source
        )
        db.add(new_sale)
        db.commit()
        return {"status": "success", "sale_id": sale_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
