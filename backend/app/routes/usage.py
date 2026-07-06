from fastapi import APIRouter
from pydantic import BaseModel
from app.database import get_db_connection
import datetime

router = APIRouter()

class TrackRequest(BaseModel):
    merchant_id: str
    action: str

@router.post("/track")
def track_usage(req: TrackRequest):
    m_id = req.merchant_id
    if m_id.startswith('admin'):
        return {"status": "SUCCESS", "message": "Admin not tracked"}
        
    now = datetime.datetime.now()
    now_str = now.isoformat()
    today_date = now.date().isoformat()
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM merchant_usage WHERE merchant_id = ?", (m_id,))
        usage = cursor.fetchone()
        
        if not usage:
            # Create if missing
            cursor.execute(
                "INSERT INTO merchant_usage (merchant_id, role, first_login, last_login) VALUES (?, 'merchant', ?, ?)",
                (m_id, now_str, now_str)
            )
            conn.commit()
            cursor.execute("SELECT * FROM merchant_usage WHERE merchant_id = ?", (m_id,))
            usage = cursor.fetchone()
            
        # Extract fields
        current_streak = usage['current_streak'] or 0
        highest_streak = usage['highest_streak'] or 0
        total_days = usage['total_login_days'] or 0
        total_sessions = usage['total_sessions'] or 0
        last_login_str = usage['last_login']
        
        updates = []
        params = []
        
        if req.action == "login":
            total_sessions += 1
            updates.append("total_sessions = ?")
            params.append(total_sessions)
            
            # Check streak
            last_login_date = "1970-01-01"
            if last_login_str:
                try:
                    last_login_date = datetime.datetime.fromisoformat(last_login_str).date().isoformat()
                except:
                    pass
                    
            if last_login_date != today_date:
                total_days += 1
                
                # Check if consecutive
                last_dt = datetime.datetime.strptime(last_login_date, "%Y-%m-%d")
                curr_dt = datetime.datetime.strptime(today_date, "%Y-%m-%d")
                if (curr_dt - last_dt).days == 1:
                    current_streak += 1
                else:
                    current_streak = 1
                    
                if current_streak > highest_streak:
                    highest_streak = current_streak
                    updates.append("highest_streak = ?")
                    params.append(highest_streak)
                    
                updates.append("total_login_days = ?")
                params.append(total_days)
                updates.append("current_streak = ?")
                params.append(current_streak)
                updates.append("last_login = ?")
                params.append(now_str)
                
        elif req.action == "voice":
            updates.append("voice_commands = voice_commands + 1")
        elif req.action == "ocr":
            updates.append("ocr_scans = ocr_scans + 1")
        elif req.action == "sale":
            updates.append("sales_entries = sales_entries + 1")
        elif req.action == "stock":
            updates.append("stock_updates = stock_updates + 1")
        elif req.action == "khata":
            updates.append("khata_updates = khata_updates + 1")
            
        updates.append("last_active = ?")
        params.append(now_str)
        updates.append("updated_at = ?")
        params.append(now_str)
        params.append(m_id)
        
        query = f"UPDATE merchant_usage SET {', '.join(updates)} WHERE merchant_id = ?"
        cursor.execute(query, tuple(params))
        conn.commit()
        
        return {
            "status": "SUCCESS", 
            "current_streak": current_streak, 
            "total_login_days": total_days,
            "voice_commands": usage['voice_commands'] if req.action != "voice" else (usage['voice_commands'] or 0) + 1,
            "ocr_scans": usage['ocr_scans'] if req.action != "ocr" else (usage['ocr_scans'] or 0) + 1,
            "sales_entries": usage['sales_entries'] if req.action != "sale" else (usage['sales_entries'] or 0) + 1,
            "khata_updates": usage['khata_updates'] if req.action != "khata" else (usage['khata_updates'] or 0) + 1,
            "stock_updates": usage['stock_updates'] if req.action != "stock" else (usage['stock_updates'] or 0) + 1
        }
        
@router.get("/stats/{merchant_id}")
def get_usage_stats(merchant_id: str):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM merchant_usage WHERE merchant_id = ?", (merchant_id,))
        usage = cursor.fetchone()
        if not usage:
            return {"status": "SUCCESS", "data": {
                "current_streak": 0, "total_login_days": 0, "voice_commands": 0, "ocr_scans": 0, "khata_updates": 0, "stock_updates": 0, "sales_entries": 0
            }}
        return {"status": "SUCCESS", "data": dict(usage)}
