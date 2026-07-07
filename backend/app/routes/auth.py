from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Merchant
from app.services.auth_service import create_access_token
import uuid

router = APIRouter()

ADMIN_PHONES = ['+919142150520', '9142150520']
ADMIN_EMAILS = ['saurabh24@iitk.ac.in']

class OTPRequest(BaseModel):
    phone: str

@router.post("/send-otp")
def send_otp(req: OTPRequest):
    phone = req.phone.strip()
    if len(phone) < 10:
        return {"status": "ERROR", "message": "Invalid phone number"}
    # In a real app, integrate MSG91, Firebase, or Twilio here.
    return {"status": "SUCCESS", "message": "OTP sent successfully"}

class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str

@router.post("/verify-otp")
def verify_otp(req: VerifyOTPRequest, db: Session = Depends(get_db)):
    identifier = req.phone.strip()
    
    # In a real app, verify OTP from Redis/DB here.
    # Currently treating all OTPs as valid for development
    
    role = "merchant"
    if identifier in ADMIN_PHONES or identifier in ADMIN_EMAILS:
        role = "admin"
        
    merchant = db.query(Merchant).filter(Merchant.phone_number == identifier).first()
    
    if merchant:
        m_id = merchant.merchant_id
    else:
        m_id = f"m-{uuid.uuid4().hex[:6]}"
        new_merchant = Merchant(
            merchant_id=m_id,
            phone_number=identifier,
            shop_name="My Shop",
            owner_name="Owner"
        )
        db.add(new_merchant)
        db.commit()
        db.refresh(new_merchant)
        
    # Generate JWT Access Token
    access_token = create_access_token(data={"sub": m_id, "role": role})
        
    return {
        "status": "SUCCESS", 
        "role": role, 
        "merchant_id": m_id, 
        "id": m_id, 
        "name": "Merchant", 
        "phone": identifier,
        "access_token": access_token
    }
