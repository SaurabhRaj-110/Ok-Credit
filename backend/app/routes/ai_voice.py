import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlite3 import Connection

from app.database import get_db_connection
from app.database import get_db_connection
from app.services.groq_engine import GroqEngine

logger = logging.getLogger("ShopSathiVoiceRoute")
router = APIRouter()

class VoiceRequest(BaseModel):
    merchant_id: str
    transcript: str

def find_closest_party(conn: Connection, merchant_id: str, parsed_name: str, party_type: str) -> str:
    """Looks up or auto-creates a customer/supplier"""
    cursor = conn.cursor()
    normalized_name = parsed_name.strip()
    
    cursor.execute(
        "SELECT party_id FROM parties WHERE merchant_id = ? AND LOWER(name) = ? AND party_type = ?",
        (merchant_id, normalized_name.lower(), party_type)
    )
    row = cursor.fetchone()
    
    if row:
        return row["party_id"]
        
    new_party_id = f"party_{uuid.uuid4().hex[:6]}"
    cursor.execute(
        "INSERT INTO parties (party_id, merchant_id, name, party_type, total_balance) VALUES (?, ?, ?, ?, 0.0)",
        (new_party_id, merchant_id, normalized_name, party_type)
    )
    return new_party_id

@router.post("/process", status_code=status.HTTP_200_OK)
async def process_voice_command(payload: VoiceRequest):
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
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if the user is asking to navigate
        if len(ai_result_array) == 1 and ai_result_array[0].get("action", "").startswith("NAVIGATE_"):
            target_tab = ai_result_array[0].get("action").replace("NAVIGATE_", "")
            return {"status": "NAVIGATE", "target": target_tab}
            
        actions_processed = []
        for ai_result in ai_result_array:
            action = ai_result.get("action", "UNKNOWN")
            
            # HANDLE CREDIT / REPAYMENT (GRAHAK & SUPPLIER) ----
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
                
            # ---- HANDLE STOCK / INVENTORY MANAGEMENT ----
            elif action in ["ADD_STOCK", "REDUCE_STOCK"]:
                item_name = ai_result.get("item_name")
                
                try:
                    qty = float(ai_result.get("quantity"))
                except (ValueError, TypeError):
                    qty = 1.0  # Default to 1 if the AI returns weird text
                
                if not item_name:
                    continue
                    
                change_str = f"+{qty}" if action == "ADD_STOCK" else f"-{qty}"
                actions_processed.append(f"{item_name} ka stock update hoga: {change_str} units.")
                
        if not actions_processed:
             return {"status": "TRY_AGAIN", "msg": "Saman ya naam samajh nahi aaya."}
             
        msg_hi = " Aur ".join(actions_processed)
        return {"status": "SUCCESS", "data": ai_result_array, "msg": msg_hi}
            
    except Exception as e:
        logger.error(f"Voice processing failure: {str(e)}")
        raise HTTPException(status_code=500, detail="Voice processing failed.")