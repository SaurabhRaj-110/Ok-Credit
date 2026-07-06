from fastapi import APIRouter
from app.database import get_db_connection
import datetime

router = APIRouter()

@router.get("/dashboard")
def get_admin_dashboard():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Total Merchants
        cursor.execute("SELECT COUNT(*) as count FROM merchants")
        total_merchants = cursor.fetchone()['count']
        
        # Today's Active Merchants
        today_date = datetime.datetime.now().date().isoformat()
        cursor.execute("SELECT COUNT(*) as count FROM merchant_usage WHERE last_active LIKE ?", (today_date + '%',))
        today_active = cursor.fetchone()['count']
        
        # Current Online (Active in last 15 mins)
        fifteen_mins_ago = (datetime.datetime.now() - datetime.timedelta(minutes=15)).isoformat()
        cursor.execute("SELECT COUNT(*) as count FROM merchant_usage WHERE last_active >= ?", (fifteen_mins_ago,))
        current_online = cursor.fetchone()['count']
        
        # Avg Streak
        cursor.execute("SELECT AVG(current_streak) as avg_streak FROM merchant_usage")
        avg_streak_row = cursor.fetchone()['avg_streak']
        avg_streak = round(avg_streak_row, 1) if avg_streak_row else 0
        
        # Total Transactions
        cursor.execute("SELECT COUNT(*) as count FROM transactions")
        total_txn = cursor.fetchone()['count']
        
        # Total OCR Bills
        cursor.execute("SELECT SUM(ocr_scans) as count FROM merchant_usage")
        total_ocr_row = cursor.fetchone()['count']
        total_ocr = total_ocr_row if total_ocr_row else 0
        
        # Total Voice Commands
        cursor.execute("SELECT SUM(voice_commands) as count FROM merchant_usage")
        total_voice_row = cursor.fetchone()['count']
        total_voice = total_voice_row if total_voice_row else 0
        
        # Fetch Top Merchants (by streak)
        cursor.execute("""
            SELECT u.*, m.shop_name, m.owner_name, m.phone_number,
            (SELECT COUNT(*) FROM transactions t WHERE t.merchant_id = u.merchant_id) as txn_count
            FROM merchant_usage u
            JOIN merchants m ON u.merchant_id = m.merchant_id
            ORDER BY u.current_streak DESC
            LIMIT 20
        """)
        merchants = [dict(row) for row in cursor.fetchall()]
        
        # Format the merchants list
        for m in merchants:
            m['status'] = 'Active' if m['last_active'] and m['last_active'] >= fifteen_mins_ago else 'Offline'
            # Fake accuracy for now
            m['voice_accuracy'] = 94
            m['ocr_accuracy'] = 91
            
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
def get_all_merchants():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT u.*, m.shop_name, m.owner_name, m.phone_number,
            (SELECT COUNT(*) FROM transactions t WHERE t.merchant_id = u.merchant_id) as txn_count
            FROM merchant_usage u
            JOIN merchants m ON u.merchant_id = m.merchant_id
            ORDER BY u.last_active DESC
        ''')
        merchants = [dict(row) for row in cursor.fetchall()]
        
        fifteen_mins_ago = (datetime.datetime.now() - datetime.timedelta(minutes=15)).isoformat()
        for m in merchants:
            m['status'] = 'Active' if m['last_active'] and m['last_active'] >= fifteen_mins_ago else 'Offline'
            
        return {"status": "SUCCESS", "data": merchants}

@router.get("/streaks")
def get_streaks():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT u.*, m.shop_name
            FROM merchant_usage u
            JOIN merchants m ON u.merchant_id = m.merchant_id
            ORDER BY u.current_streak DESC
        ''')
        return {"status": "SUCCESS", "data": [dict(row) for row in cursor.fetchall()]}

@router.get("/transactions")
def get_all_transactions():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM transactions
            ORDER BY created_at DESC
            LIMIT 500
        ''')
        return {"status": "SUCCESS", "data": [dict(row) for row in cursor.fetchall()]}

@router.get("/bills")
def get_all_bills():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM bills
            ORDER BY created_at DESC
            LIMIT 500
        ''')
        return {"status": "SUCCESS", "data": [dict(row) for row in cursor.fetchall()]}

@router.get("/voice-commands")
def get_voice_commands():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM transactions
            WHERE voice_transcript IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 500
        ''')
        return {"status": "SUCCESS", "data": [dict(row) for row in cursor.fetchall()]}

@router.get("/inventory")
def get_all_inventory():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM inventory
            ORDER BY merchant_id
            LIMIT 500
        ''')
        return {"status": "SUCCESS", "data": [dict(row) for row in cursor.fetchall()]}

@router.get("/alerts")
def get_alerts():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        # Find low stock alerts
        cursor.execute('''
            SELECT * FROM inventory
            WHERE current_stock < reorder_level
            LIMIT 100
        ''')
        return {"status": "SUCCESS", "data": [dict(row) for row in cursor.fetchall()]}
