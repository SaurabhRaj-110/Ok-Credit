from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
import uuid
from datetime import datetime
from app.database import get_db
from app.models import Party, Transaction
from app.services.auth_service import get_current_merchant_id

router = APIRouter()

class PartyCreate(BaseModel):
    name: str
    phone_number: Optional[str] = ""
    party_type: str
    initial_balance: float = 0.0
    notes: str = ""

class PartyNotesUpdate(BaseModel):
    notes: str

class TransactionCreate(BaseModel):
    party_id: str
    amount: float
    txn_type: str
    entry_source: str = "Manual"
    voice_transcript: Optional[str] = ""

@router.put("/party/{party_id}/notes")
def update_party_notes(party_id: str, update: PartyNotesUpdate, db: Session = Depends(get_db), merchant_id: str = Depends(get_current_merchant_id)):
    try:
        party = db.query(Party).filter(Party.party_id == party_id, Party.merchant_id == merchant_id).first()
        if not party:
            raise HTTPException(status_code=404, detail="Party not found")
        party.notes = update.notes
        db.commit()
        return {"status": "success", "message": "Notes saved successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/party")
def create_party(party: PartyCreate, db: Session = Depends(get_db), merchant_id: str = Depends(get_current_merchant_id)):
    party_id = "p_" + str(uuid.uuid4().hex)[:10]
    try:
        new_party = Party(
            party_id=party_id,
            merchant_id=merchant_id,
            name=party.name,
            phone_number=party.phone_number,
            party_type=party.party_type,
            total_balance=party.initial_balance,
            notes=party.notes
        )
        db.add(new_party)
        
        if party.initial_balance != 0:
            txn_id = "tx_" + str(uuid.uuid4().hex)[:10]
            txn_type = 'GIVEN' if party.initial_balance > 0 else 'GOT'
            new_txn = Transaction(
                transaction_id=txn_id,
                party_id=party_id,
                merchant_id=merchant_id,
                amount=abs(party.initial_balance),
                txn_type=txn_type,
                entry_source="Opening Balance"
            )
            db.add(new_txn)
            
        db.commit()
        return {"status": "success", "party_id": party_id, "message": "Account created!"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transaction")
def add_transaction(tx: TransactionCreate, db: Session = Depends(get_db), merchant_id: str = Depends(get_current_merchant_id)):
    txn_id = "tx_" + str(uuid.uuid4().hex)[:10]
    try:
        new_txn = Transaction(
            transaction_id=txn_id,
            party_id=tx.party_id,
            merchant_id=merchant_id,
            amount=tx.amount,
            txn_type=tx.txn_type,
            entry_source=tx.entry_source,
            voice_transcript=tx.voice_transcript
        )
        db.add(new_txn)
        
        party = db.query(Party).filter(Party.party_id == tx.party_id, Party.merchant_id == merchant_id).first()
        if party:
            balance_change = tx.amount if tx.txn_type == 'GIVEN' else -tx.amount
            party.total_balance += balance_change
            
        db.commit()
        return {"status": "success", "transaction_id": txn_id, "message": "Transaction saved!"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/party/{party_id}")
def delete_party(party_id: str, merchant_id: str, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    if merchant_id != jwt_merchant_id: raise HTTPException(status_code=403, detail="Access Denied")
    try:
        party = db.query(Party).filter(Party.party_id == party_id, Party.merchant_id == merchant_id).first()
        if party:
            db.delete(party)
            db.commit()
            return {"status": "success", "message": "Account completely deleted"}
        return {"status": "error", "message": "Not found"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sync/{merchant_id}")
def sync_all_data(merchant_id: str, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    if merchant_id != jwt_merchant_id: raise HTTPException(status_code=403, detail="Access Denied")
    try:
        from app.models import Inventory, Bill, DailySale
        from datetime import date, timedelta
        parties = db.query(Party).filter(Party.merchant_id == merchant_id).all()
        transactions = db.query(Transaction).filter(Transaction.merchant_id == merchant_id).order_by(Transaction.created_at.desc()).all()
        inventory = db.query(Inventory).filter(Inventory.merchant_id == merchant_id).all()
        
        # Fetch daily sales for the last 7 days to avoid huge payloads, ordered newest first
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        daily_sales = db.query(DailySale).filter(
            DailySale.merchant_id == merchant_id,
            DailySale.timestamp >= seven_days_ago
        ).order_by(DailySale.timestamp.desc()).all()
        
        parties_data = []
        for p in parties:
            p_dict = {
                "party_id": p.party_id,
                "name": p.name,
                "phone_number": p.phone_number,
                "party_type": p.party_type,
                "total_balance": p.total_balance,
                "notes": p.notes,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "transactions": [
                    {
                        "transaction_id": t.transaction_id,
                        "amount": t.amount,
                        "txn_type": t.txn_type,
                        "entry_source": t.entry_source,
                        "created_at": t.created_at.isoformat() if t.created_at else None
                    } for t in transactions if t.party_id == p.party_id
                ]
            }
            parties_data.append(p_dict)
            
        inv_data = [
            {
                "item_id": i.item_id,
                "item_name": i.item_name,
                "category": i.category,
                "current_stock": i.current_stock,
                "reorder_level": i.reorder_level,
                "unit": i.unit,
                "price": i.price,
                "purchase_price": i.purchase_price
            } for i in inventory
        ]
        
        sales_data = [
            {
                "sale_id": s.sale_id,
                "type": s.type,
                "item": s.item or "Item",
                "qty": s.qty or 0,
                "amount": s.amount,
                "note": s.note or "",
                "entry_source": s.entry_source or "Manual",
                "timestamp": s.timestamp.isoformat() if s.timestamp else datetime.utcnow().isoformat()
            } for s in daily_sales
        ]
        
        return {
            "status": "success",
            "parties": parties_data,
            "inventory": inv_data,
            "daily_sales": sales_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

