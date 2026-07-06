from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from app.database import get_db_connection
import uuid
import datetime

router = APIRouter()

ADMIN_PHONES = ['+919142150520', '9142150520']
ADMIN_EMAILS = ['saurabh24@iitk.ac.in']

class LoginRequest(BaseModel):
    identifier: str # phone or email

@router.post("/login")
def login(req: LoginRequest):
    identifier = req.identifier.strip()
    
    # Check Admin
    if identifier in ADMIN_PHONES or identifier in ADMIN_EMAILS:
        return {"status": "SUCCESS", "role": "admin", "merchant_id": "admin-1"}
    
    # Check Merchant
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT merchant_id, shop_name, owner_name FROM merchants WHERE phone_number = ?", (identifier,))
        merchant = cursor.fetchone()
        
        if merchant:
            m_id = merchant['merchant_id']
        else:
            # Create new merchant
            m_id = f"m-{uuid.uuid4().hex[:6]}"
            cursor.execute(
                "INSERT INTO merchants (merchant_id, phone_number, shop_name, owner_name) VALUES (?, ?, ?, ?)",
                (m_id, identifier, "My Shop", "Owner")
            )
            # Initialize usage tracking
            cursor.execute(
                "INSERT INTO merchant_usage (merchant_id, role, first_login, last_login, total_sessions) VALUES (?, ?, ?, ?, ?)",
                (m_id, "merchant", datetime.datetime.now().isoformat(), datetime.datetime.now().isoformat(), 0)
            )
            conn.commit()
            
    return {"status": "SUCCESS", "role": "merchant", "merchant_id": m_id}
