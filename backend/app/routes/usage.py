from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import MerchantUsage
from app.services.auth_service import get_current_merchant_id
import datetime

router = APIRouter()

class TrackRequest(BaseModel):
    merchant_id: str
    action: str

@router.post("/track")
def track_usage(req: TrackRequest, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    m_id = req.merchant_id
    if m_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    if m_id.startswith('admin'):
        return {"status": "SUCCESS", "message": "Admin not tracked"}
        
    now = datetime.datetime.now()
    now_str = now.isoformat()
    today_date = now.date().isoformat()
    
    try:
        usage = db.query(MerchantUsage).filter(MerchantUsage.merchant_id == m_id).first()
        
        if not usage:
            usage = MerchantUsage(merchant_id=m_id, role='merchant', first_login=now_str, last_login=now_str)
            db.add(usage)
            db.commit()
            db.refresh(usage)
            
        current_streak = usage.current_streak or 0
        highest_streak = usage.highest_streak or 0
        total_days = usage.total_login_days or 0
        total_sessions = usage.total_sessions or 0
        last_login_str = usage.last_login
        
        if req.action == "login":
            usage.total_sessions = total_sessions + 1
            
            last_login_date = "1970-01-01"
            if last_login_str:
                try:
                    last_login_date = datetime.datetime.fromisoformat(last_login_str).date().isoformat()
                except:
                    pass
                    
            if current_streak == 0:
                usage.current_streak = 1
                usage.total_login_days = total_days + 1
                usage.last_login = now_str
                if usage.current_streak > highest_streak:
                    usage.highest_streak = usage.current_streak
            elif last_login_date != today_date:
                usage.total_login_days = total_days + 1
                
                last_dt = datetime.datetime.strptime(last_login_date, "%Y-%m-%d")
                curr_dt = datetime.datetime.strptime(today_date, "%Y-%m-%d")
                if (curr_dt - last_dt).days == 1:
                    usage.current_streak = current_streak + 1
                else:
                    usage.current_streak = 1
                    
                if usage.current_streak > highest_streak:
                    usage.highest_streak = usage.current_streak
                    
                usage.last_login = now_str
                
        elif req.action == "voice":
            usage.voice_commands = (usage.voice_commands or 0) + 1
        elif req.action == "ocr":
            usage.ocr_scans = (usage.ocr_scans or 0) + 1
        elif req.action == "sale":
            usage.sales_entries = (usage.sales_entries or 0) + 1
        elif req.action == "stock":
            usage.stock_updates = (usage.stock_updates or 0) + 1
        elif req.action == "khata":
            usage.khata_updates = (usage.khata_updates or 0) + 1
            
        usage.last_active = now_str
        usage.updated_at = now
        
        db.commit()
        db.refresh(usage)
        
        return {
            "status": "SUCCESS", 
            "current_streak": usage.current_streak, 
            "total_login_days": usage.total_login_days,
            "voice_commands": usage.voice_commands,
            "ocr_scans": usage.ocr_scans,
            "sales_entries": usage.sales_entries,
            "khata_updates": usage.khata_updates,
            "stock_updates": usage.stock_updates
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
        
@router.get("/stats/{merchant_id}")
def get_usage_stats(merchant_id: str, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    if merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    try:
        usage = db.query(MerchantUsage).filter(MerchantUsage.merchant_id == merchant_id).first()
        if not usage:
            return {"status": "SUCCESS", "data": {
                "current_streak": 0, "total_login_days": 0, "voice_commands": 0, "ocr_scans": 0, "khata_updates": 0, "stock_updates": 0, "sales_entries": 0
            }}
            
        data = {
            "current_streak": usage.current_streak,
            "total_login_days": usage.total_login_days,
            "voice_commands": usage.voice_commands,
            "ocr_scans": usage.ocr_scans,
            "khata_updates": usage.khata_updates,
            "stock_updates": usage.stock_updates,
            "sales_entries": usage.sales_entries
        }
        return {"status": "SUCCESS", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
