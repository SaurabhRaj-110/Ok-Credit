from fastapi import APIRouter, HTTPException
import sqlite3
from datetime import datetime, timedelta
from app.database import get_db_connection

router = APIRouter()

@router.get("/today_overview")
def get_today_overview(merchant_id: str):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Start of today
            today_str = datetime.now().strftime('%Y-%m-%d')
            
            counts = {
                "Voice": 0,
                "Manual": 0,
                "KhataSnap": 0,
                "Import": 0
            }
            
            # Query from transactions
            cursor.execute("""
                SELECT entry_source, COUNT(*) as cnt 
                FROM transactions 
                WHERE merchant_id = ? AND date(created_at) = ?
                GROUP BY entry_source
            """, (merchant_id, today_str))
            
            for row in cursor.fetchall():
                src = row['entry_source']
                if src in counts:
                    counts[src] += row['cnt']
                else:
                    counts["Other"] = counts.get("Other", 0) + row['cnt']
                    
            # Query from daily_sales
            cursor.execute("""
                SELECT entry_source, COUNT(*) as cnt 
                FROM daily_sales 
                WHERE merchant_id = ? AND date(timestamp) = ?
                GROUP BY entry_source
            """, (merchant_id, today_str))
            
            for row in cursor.fetchall():
                src = row['entry_source']
                if not src:
                    src = "Manual"
                if src in counts:
                    counts[src] += row['cnt']
                else:
                    counts["Other"] = counts.get("Other", 0) + row['cnt']
                    
            # Query from inventory (new items created today)
            # Inventory doesn't have created_at currently, but we added entry_source
            # To be 100% accurate without created_at, we might skip inventory or assume it's part of transactions/sales
            
            total_entries = sum(counts.values())
            
            return {
                "status": "success", 
                "data": {
                    "Voice Entries": counts["Voice"],
                    "Manual Entries": counts["Manual"],
                    "KhataSnap (OCR)": counts["KhataSnap"],
                    "Other / Import": counts["Import"] + counts.get("Other", 0),
                    "Total": total_entries
                }
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
