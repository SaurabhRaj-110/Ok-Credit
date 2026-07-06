import uuid
import logging
import os
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel, Field

from app.database import get_db_connection
from app.services.groq_engine import GroqEngine
from app.services.transaction_engine import TransactionEngine

logger = logging.getLogger("ShopSathiVoiceRoute")
router = APIRouter()

class VoiceRequest(BaseModel):
    merchant_id: str
    transcript: str

class ExecutePreviewRequest(BaseModel):
    merchant_id: str
    preview: dict

@router.post("/transcribe", status_code=status.HTTP_200_OK)
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Receives audio blob, saves it temporarily, transcribes with Whisper, and returns transcript.
    """
    temp_file = f"temp_{uuid.uuid4().hex}.webm"
    try:
        with open(temp_file, "wb") as f:
            content = await audio.read()
            f.write(content)
            
        engine = GroqEngine()
        transcript = engine.transcribe_audio(temp_file)
        
        return {"status": "SUCCESS", "transcript": transcript}
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail="Audio transcription failed.")
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)

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
        
    try:
        # Check if the user is asking to navigate
        if len(ai_result_array) == 1 and ai_result_array[0].get("action", "").startswith("NAVIGATE_"):
            target_tab = ai_result_array[0].get("action").replace("NAVIGATE_", "")
            return {"status": "NAVIGATE", "target": target_tab}
            
        txn_engine = TransactionEngine()
        preview = txn_engine.validate_entities(payload.merchant_id, ai_result_array)
        
        if not preview.get("actions") and not preview.get("generate_bill"):
             return {"status": "TRY_AGAIN", "msg": "Saman ya naam samajh nahi aaya."}
             
        msg_hi = "Samajh liya, kripya verify karein."
        if not preview["is_valid"]:
            msg_hi = "Kuch dikkat hai: " + " ".join(preview["validation_errors"])
            
        return {"status": "SUCCESS", "preview": preview, "msg": msg_hi}
            
    except Exception as e:
        logger.error(f"Voice processing failure: {str(e)}")
        raise HTTPException(status_code=500, detail="Voice processing failed.")

@router.post("/execute", status_code=status.HTTP_200_OK)
async def execute_voice_command(payload: ExecutePreviewRequest):
    logger.info(f"Executing voice transaction for merchant {payload.merchant_id}")
    try:
        txn_engine = TransactionEngine()
        result = txn_engine.execute_preview(payload.merchant_id, payload.preview)
        return result
    except Exception as e:
        logger.error(f"Execution failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Execution failed.")