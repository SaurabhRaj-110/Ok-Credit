import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.groq_engine import GroqEngine
from app.services.auth_service import get_current_merchant_id

logger = logging.getLogger("ShopSathiVoiceRoute")
router = APIRouter()

class VoiceRequest(BaseModel):
    merchant_id: str
    transcript: str

@router.post("/process", status_code=status.HTTP_200_OK)
async def process_voice_command(payload: VoiceRequest, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    if payload.merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    logger.info(f"Incoming voice text from merchant {payload.merchant_id}: {payload.transcript}")
    
    engine = GroqEngine()
    ai_result_array = engine.extract_intent(payload.transcript)
    logger.info(f"AI Extraction: {ai_result_array}")
    
    if not isinstance(ai_result_array, list):
        ai_result_array = [ai_result_array]
        
    if len(ai_result_array) == 0 or ai_result_array[0].get("action") == "RATE_LIMIT":
        return {"status": "TRY_AGAIN", "msg": "Gemini AI Rate Limit Reached! Please wait 1 minute and try again."}
        
    if ai_result_array[0].get("action") == "UNKNOWN":
        return {"status": "TRY_AGAIN", "msg": "Samajh nahi aaya. Kripya dobara bolein (Could not process statement)."}
        
    try:
        # Check if the user is asking to navigate
        if len(ai_result_array) == 1 and ai_result_array[0].get("action", "").startswith("NAVIGATE_"):
            target_tab = ai_result_array[0].get("action").replace("NAVIGATE_", "")
            return {"status": "NAVIGATE", "target": target_tab}
            
        actions_processed = []
        for ai_result in ai_result_array:
            action = ai_result.get("action", "UNKNOWN")
            
            if action in ["CUSTOMER_CREDIT", "CUSTOMER_PAYMENT", "CUSTOMER_REPAYMENT", "SUPPLIER_CREDIT", "SUPPLIER_PAYMENT"]:
                target_name = ai_result.get("target_name")
                amount = ai_result.get("amount")
                
                if not target_name or not amount:
                    continue
                
                party_type = ai_result.get("party_type")
                if not party_type:
                    party_type = "SUPPLIER" if "SUPPLIER" in action else "CUSTOMER"
                role_str = "Grahak" if party_type == "CUSTOMER" else "Supplier"
                actions_processed.append(f"{target_name} ({role_str}) ke khate mein ₹{amount} update honge.")
                
            elif action in ["ADD_STOCK", "REDUCE_STOCK"]:
                item_name = ai_result.get("item_name")
                try:
                    qty = float(ai_result.get("quantity") or 1)
                except (ValueError, TypeError):
                    qty = 1.0
                
                amount = ai_result.get("amount")
                rate = ai_result.get("rate")
                
                if not item_name:
                    continue
                
                verb = "becha" if action == "REDUCE_STOCK" else "stock mein aaya"
                amount_str = ""
                if amount:
                    amount_str = f" — ₹{amount} ka"
                elif rate:
                    amount_str = f" — ₹{rate} rate par"
                    
                change_str = f"-{qty}" if action == "REDUCE_STOCK" else f"+{qty}"
                actions_processed.append(f"{item_name} {verb}: {change_str} units{amount_str}.")
                
            elif action == "DAILY_SALES":
                amount = ai_result.get("amount")
                if not amount:
                    continue
                
                from app.models import DailySale
                new_sale = DailySale(
                    merchant_id=payload.merchant_id,
                    type="Cash Sale",
                    item="Daily Sales (Voice)",
                    qty=1.0,
                    amount=amount,
                    note="Added via Voice",
                    entry_source="Voice AI"
                )
                db.add(new_sale)
                db.flush()
                
                actions_processed.append(f"Aaj ki sales mein ₹{amount} add ho gaye.")
                
        if not actions_processed:
             return {"status": "TRY_AGAIN", "msg": "Saman ya naam samajh nahi aaya."}
             
        msg_hi = " Aur ".join(actions_processed)
        return {"status": "SUCCESS", "data": ai_result_array, "msg": msg_hi}
            
    except Exception as e:
        logger.error(f"Voice processing failure: {str(e)}")
        raise HTTPException(status_code=500, detail="Voice processing failed.")