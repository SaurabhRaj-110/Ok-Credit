from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.services.auth_service import get_current_merchant_id
import datetime

router = APIRouter()

def verify_admin(merchant_id: str):
    if merchant_id != 'admin':
        raise HTTPException(status_code=403, detail="Access Denied")

@router.get("/dashboard")
def get_admin_dashboard(db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    verify_admin(jwt_merchant_id)
    # Total Merchants
    total_merchants = db.execute(text("SELECT COUNT(*) FROM merchants")).scalar() or 0
    
    # Today's Active Merchants
    today_date = datetime.datetime.now().date().isoformat()
    today_active = db.execute(text("SELECT COUNT(*) FROM merchant_usage WHERE last_active LIKE :td"), {"td": today_date + '%'}).scalar() or 0
    
    # Current Online (Active in last 15 mins)
    fifteen_mins_ago = (datetime.datetime.now() - datetime.timedelta(minutes=15)).isoformat()
    current_online = db.execute(text("SELECT COUNT(*) FROM merchant_usage WHERE last_active >= :fm"), {"fm": fifteen_mins_ago}).scalar() or 0
    
    # Avg Streak
    avg_streak_row = db.execute(text("SELECT AVG(current_streak) FROM merchant_usage")).scalar()
    avg_streak = round(avg_streak_row, 1) if avg_streak_row else 0
    
    # Total Transactions
    total_txn = db.execute(text("SELECT COUNT(*) FROM transactions")).scalar() or 0
    
    # Total OCR Bills
    total_ocr = db.execute(text("SELECT SUM(ocr_scans) FROM merchant_usage")).scalar() or 0
    
    # Total Voice Commands
    total_voice = db.execute(text("SELECT SUM(voice_commands) FROM merchant_usage")).scalar() or 0
    
    # Fetch Top Merchants (by streak)
    merchants_rows = db.execute(text("""
        SELECT u.merchant_id, u.last_active, u.current_streak, m.shop_name, m.owner_name, m.phone_number,
        (SELECT COUNT(*) FROM transactions t WHERE t.merchant_id = u.merchant_id) as txn_count
        FROM merchant_usage u
        JOIN merchants m ON u.merchant_id = m.merchant_id
        ORDER BY u.current_streak DESC
        LIMIT 20
    """)).fetchall()
    
    merchants = []
    for r in merchants_rows:
        m_dict = dict(r._mapping)
        m_dict['status'] = 'Active' if m_dict.get('last_active') and m_dict['last_active'] >= fifteen_mins_ago else 'Offline'
        m_dict['voice_accuracy'] = 94
        m_dict['ocr_accuracy'] = 91
        merchants.append(m_dict)
        
    return {
        "status": "SUCCESS",
        "overview": {
            "total_merchants": total_merchants,
            "today_active": today_active,
            "current_online": current_online,
            "avg_streak": avg_streak,
            "total_transactions": total_txn,
            "total_ocr": total_ocr,
            "total_voice": total_voice,
            "voice_accuracy": 94,
            "ocr_accuracy": 91
        },
        "merchants": merchants
    }

@router.get("/merchants")
def get_all_merchants(db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    verify_admin(jwt_merchant_id)
    rows = db.execute(text("""
        SELECT u.merchant_id, u.last_active, u.current_streak, m.shop_name, m.owner_name, m.phone_number,
        (SELECT COUNT(*) FROM transactions t WHERE t.merchant_id = u.merchant_id) as txn_count
        FROM merchant_usage u
        JOIN merchants m ON u.merchant_id = m.merchant_id
        ORDER BY u.last_active DESC
    """)).fetchall()
    
    merchants = []
    fifteen_mins_ago = (datetime.datetime.now() - datetime.timedelta(minutes=15)).isoformat()
    for r in rows:
        m_dict = dict(r._mapping)
        m_dict['status'] = 'Active' if m_dict.get('last_active') and m_dict['last_active'] >= fifteen_mins_ago else 'Offline'
        merchants.append(m_dict)
        
    return {"status": "SUCCESS", "data": merchants}

@router.get("/streaks")
def get_streaks(db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    verify_admin(jwt_merchant_id)
    rows = db.execute(text("""
        SELECT u.merchant_id, u.current_streak, m.shop_name
        FROM merchant_usage u
        JOIN merchants m ON u.merchant_id = m.merchant_id
        ORDER BY u.current_streak DESC
    """)).fetchall()
    return {"status": "SUCCESS", "data": [dict(r._mapping) for r in rows]}

@router.get("/transactions")
def get_all_transactions(db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    verify_admin(jwt_merchant_id)
    rows = db.execute(text("""
        SELECT * FROM transactions
        ORDER BY created_at DESC
        LIMIT 500
    """)).fetchall()
    return {"status": "SUCCESS", "data": [dict(r._mapping) for r in rows]}

@router.get("/bills")
def get_all_bills(db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    verify_admin(jwt_merchant_id)
    rows = db.execute(text("""
        SELECT * FROM bills
        ORDER BY created_at DESC
        LIMIT 500
    """)).fetchall()
    return {"status": "SUCCESS", "data": [dict(r._mapping) for r in rows]}

@router.get("/voice-commands")
def get_voice_commands(db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    verify_admin(jwt_merchant_id)
    rows = db.execute(text("""
        SELECT * FROM transactions
        WHERE voice_transcript IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 500
    """)).fetchall()
    return {"status": "SUCCESS", "data": [dict(r._mapping) for r in rows]}

@router.get("/inventory")
def get_all_inventory(db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    verify_admin(jwt_merchant_id)
    rows = db.execute(text("""
        SELECT * FROM inventory
        ORDER BY merchant_id
        LIMIT 500
    """)).fetchall()
    return {"status": "SUCCESS", "data": [dict(r._mapping) for r in rows]}

@router.get("/alerts")
def get_alerts(db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    verify_admin(jwt_merchant_id)
    rows = db.execute(text("""
        SELECT * FROM inventory
        WHERE current_stock < reorder_level
        LIMIT 100
    """)).fetchall()
    return {"status": "SUCCESS", "data": [dict(r._mapping) for r in rows]}
