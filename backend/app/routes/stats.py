from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from app.database import get_db
from app.models import Transaction, DailySale
from app.services.auth_service import get_current_merchant_id

router = APIRouter()

@router.get("/today_overview")
def get_today_overview(merchant_id: str, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    if merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    try:
        today_date = datetime.now().date()
        
        counts = {
            "Voice": 0,
            "Manual": 0,
            "KhataSnap": 0,
            "Import": 0,
            "Other": 0
        }
        
        # Transactions
        tx_stats = db.query(Transaction.entry_source, func.count(Transaction.transaction_id)).filter(
            Transaction.merchant_id == merchant_id,
            func.date(Transaction.created_at) == today_date
        ).group_by(Transaction.entry_source).all()
        
        for src, cnt in tx_stats:
            if src in counts:
                counts[src] += cnt
            else:
                counts["Other"] += cnt
                
        # Sales
        sale_stats = db.query(DailySale.entry_source, func.count(DailySale.sale_id)).filter(
            DailySale.merchant_id == merchant_id,
            func.date(DailySale.timestamp) == today_date
        ).group_by(DailySale.entry_source).all()
        
        for src, cnt in sale_stats:
            src = src if src else "Manual"
            if src in counts:
                counts[src] += cnt
            else:
                counts["Other"] += cnt
                
        total_entries = sum(counts.values())
        
        return {
            "status": "success", 
            "data": {
                "Voice Entries": counts["Voice"],
                "Manual Entries": counts["Manual"],
                "KhataSnap (OCR)": counts["KhataSnap"],
                "Other / Import": counts["Import"] + counts["Other"],
                "Total": total_entries
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
