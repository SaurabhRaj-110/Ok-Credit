import os
import time
import logging
import json
import uuid
import re
import base64
import difflib
import hashlib
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, Depends
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
import google.generativeai as genai
try:
    from groq import Groq
except ImportError:
    Groq = None
    logging.getLogger("ShopSathiSnap").warning("Groq SDK not installed. Groq OCR will be unavailable.")

from app.config import settings
from app.database import get_db
from app.models import Party, Inventory, DailySale, Transaction, Bill
from app.services.auth_service import get_current_merchant_id

logger = logging.getLogger("ShopSathiSnap")
router = APIRouter()

# Initialize Groq client (primary OCR provider - Llama 4 Scout Vision)
groq_client = None
if Groq is not None:
    try:
        api_key = settings.GROQ_API_KEY
        if api_key and api_key != "MOCK_KEY_FOR_LOCAL_DEV":
            groq_client = Groq(api_key=api_key)
            logger.info("Groq client initialized successfully.")
        else:
            logger.warning("GROQ_API_KEY not set, Groq OCR unavailable.")
    except Exception as e:
        logger.error(f"Groq AI Init Error: {e}")

# Initialize Gemini client (fallback OCR provider)
try:
    genai.configure(api_key=settings.GEMINI_API_KEY)
    logger.info("Gemini client initialized successfully.")
except Exception as e:
    logger.error(f"Gemini AI Init Error: {e}")

class SnapEntry(BaseModel):
    action: str
    target_name: Optional[str] = None
    item_name: Optional[str] = None
    quantity: Optional[float] = None
    rate: Optional[float] = None
    amount: Optional[float] = None
    confidence_score: Optional[float] = 100.0
    needs_verification: Optional[bool] = False

class ConfirmPayload(BaseModel):
    merchant_id: str
    image_path: Optional[str] = None
    total_amount: Optional[float] = 0.0
    bill_date: Optional[str] = None
    party_name: Optional[str] = None
    bill_type: Optional[str] = None
    entries: List[SnapEntry]

def find_closest_party(db: Session, merchant_id: str, parsed_name: str, party_type: str) -> str:
    parties = db.query(Party).filter(Party.merchant_id == merchant_id, Party.party_type == party_type).all()
    party_names = [p.name for p in parties]
    matches = difflib.get_close_matches(parsed_name, party_names, n=1, cutoff=0.8)
    
    if matches:
        matched_name = matches[0]
        for p in parties:
            if p.name == matched_name:
                return p.party_id

    new_party_id = f"party_{uuid.uuid4().hex[:6]}"
    new_party = Party(
        party_id=new_party_id,
        merchant_id=merchant_id,
        name=parsed_name,
        party_type=party_type,
        total_balance=0.0
    )
    db.add(new_party)
    db.flush()
    return new_party_id

@router.post("/process", status_code=status.HTTP_200_OK)
async def process_notebook_image(
    merchant_id: str = Form(...), 
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    jwt_merchant_id: str = Depends(get_current_merchant_id)
):
    if merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    logger.info(f"Processing KhataSnap image for merchant: {merchant_id}")
    try:
        file_ext = os.path.splitext(file.filename)[1]
        if not file_ext:
            file_ext = ".jpg"
        filename = f"ocr_{uuid.uuid4().hex[:10]}_{int(time.time())}{file_ext}"
        uploads_dir = os.path.join(settings.UPLOAD_DIR, "snap")
        os.makedirs(uploads_dir, exist_ok=True)
        
        filepath = os.path.join(uploads_dir, filename)
        
        image_url_path = f"/uploads/snap/{filename}"
        
        image_bytes = await file.read()
        with open(filepath, "wb") as buffer:
            buffer.write(image_bytes)

        system_instruction = """
You are a highly accurate OCR system. Your job is to extract ANY handwritten or printed grocery items, names, and phone numbers from the image.

ANALYZE this image carefully.

STEP 1: Read EVERY line item with extreme care:
- Read handwritten text character by character
- For Hindi/Devanagari text, transliterate to English (e.g., आटा -> Atta)
- For quantities: look for numbers near items (e.g., "2 kg", "3 pkt", "500g")
- For rates/prices: look for ₹ symbol, "Rs", or numbers after items
- For amounts: quantity x rate, or the total next to each line
- Handle common kirana abbreviations: pkt=packet, kg=kilogram, ltr=litre, dz=dozen

STEP 2: MULTIPLE PARTIES & MISSING AMOUNTS:
- A single image may contain multiple sections for DIFFERENT parties (e.g., a customer on top, a supplier below).
- Identify the party name for EACH line item and assign it to "target_name" (e.g. "Saurabh Raj").
- If a phone number is present, you may include it in the target_name (e.g. "Saurabh Raj 9142150520").
- If amounts or rates are missing, set them to 0.0 or null. Do NOT hallucinate prices.

STEP 3: Estimate confidence for each item (0-100):
- Clear printed text: 95-100
- Clear handwriting: 85-95  
- Unclear/smudged text: 60-84
- Guessed/inferred: below 60

Return ONLY valid JSON (no markdown wrappers, no ```json blocks):
{
  "is_valid_bill": true,
  "party_name": "string or null",
  "bill_type": "CUSTOMER" | "SUPPLIER" | "UNKNOWN",  
  "total_amount": float or null,
  "bill_date": "YYYY-MM-DD" or null,
  "entries": [
    {
      "action": "CUSTOMER_CREDIT" | "SUPPLIER_CREDIT" | "ADD_STOCK" | "REDUCE_STOCK",
      "target_name": "string or null",
      "amount": float or null,
      "item_name": "string (exact product name as written)",
      "quantity": float or null,
      "rate": float or null,
      "confidence_score": float (0 to 100)
    }
  ]
}

CRITICAL RULES:
- YOU MUST ALWAYS RETURN is_valid_bill: true if there is ANY readable text in the image.
- YOU MUST EXTRACT EVERY SINGLE LINE OF TEXT AS AN ENTRY.
- If action is unknown, use "REDUCE_STOCK".
- Do NOT hallucinate or invent items or prices.
- Each entry should have at minimum: item_name.
"""

        # ===== HELPER: Parse raw AI text into structured JSON =====
        def parse_ocr_response(raw_text):
            raw_text = raw_text.strip()
            if "```json" in raw_text:
                raw_text = raw_text.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_text:
                raw_text = raw_text.split("```")[1].split("```")[0].strip()
            start_idx = raw_text.find('{')
            end_idx = raw_text.rfind('}')
            if start_idx != -1 and end_idx != -1:
                raw_text = raw_text[start_idx:end_idx+1]
            data = json.loads(raw_text)
            if isinstance(data, list):
                data = {
                    "is_valid_bill": True,
                    "party_name": "General",
                    "bill_type": "UNKNOWN",
                    "total_amount": 0.0,
                    "entries": data
                }
            elif not isinstance(data, dict):
                data = {}
            return data

        extracted_data = None
        last_error = None
        ocr_provider_used = None

        # ===== PROVIDER 1: Groq (Llama 4 Scout Vision) - PRIMARY =====
        if groq_client:
            try:
                b64_image = base64.b64encode(image_bytes).decode("utf-8")
                # Force image/jpeg if vercel sets something odd like application/octet-stream
                mime = "image/jpeg"
                if file.content_type and "image" in file.content_type:
                    mime = file.content_type
                
                groq_response = groq_client.chat.completions.create(
                    model="meta-llama/llama-4-scout-17b-16e-instruct",
                    messages=[
                        {"role": "system", "content": system_instruction},
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:{mime};base64,{b64_image}"
                                    }
                                },
                                {
                                    "type": "text",
                                    "text": "Extract all items from this handwritten bill image. Return only valid JSON."
                                }
                            ]
                        }
                    ],
                    max_tokens=4096
                )
                raw_text = groq_response.choices[0].message.content
                extracted_data = parse_ocr_response(raw_text)
                ocr_provider_used = "groq_llama4_scout"
                logger.info("OCR successful via Groq Llama 4 Scout")
            except Exception as e:
                logger.warning(f"Groq OCR failed: {str(e)}")
                last_error = ("groq_failed", str(e))

        # ===== PROVIDER 2: Gemini (Fallback) =====
        if extracted_data is None:
            gemini_models = [
                "models/gemini-2.5-flash",
                "models/gemini-1.5-flash",
                "models/gemini-2.0-flash",
                "models/gemini-flash-latest"
            ]
            for target_model in gemini_models:
                try:
                    model = genai.GenerativeModel(model_name=target_model, system_instruction=system_instruction)
                    response = model.generate_content([
                        {"mime_type": file.content_type, "data": image_bytes}
                    ])
                    raw_text = response.text.strip()
                    extracted_data = parse_ocr_response(raw_text)
                    ocr_provider_used = f"gemini_{target_model}"
                    last_error = None
                    logger.info(f"OCR successful via Gemini ({target_model})")
                    break
                except json.JSONDecodeError as je:
                    if not last_error or last_error[0] not in ["rate_limit", "auth_error"]:
                        last_error = ("json_parse", f"Gemini returned invalid JSON: {str(je)}")
                except Exception as e:
                    error_str = str(e)
                    if "API_KEY_INVALID" in error_str or "invalid api key" in error_str.lower() or "401" in error_str or "403" in error_str or "UNAUTHENTICATED" in error_str:
                        last_error = ("auth_error", error_str)
                        break
                    elif "429" in error_str or "quota" in error_str.lower() or "rate_limit" in error_str.lower() or "RESOURCE_EXHAUSTED" in error_str:
                        last_error = ("rate_limit", error_str)
                    else:
                        if not last_error or last_error[0] not in ["rate_limit", "auth_error"]:
                            last_error = ("general", error_str)

        # ===== ERROR HANDLING =====
        if extracted_data is None and last_error is not None:
            err_type, err_msg = last_error
            if err_type == "auth_error":
                raise HTTPException(status_code=401, detail="API key is invalid. Please update your API key.")
            elif err_type == "rate_limit":
                raise HTTPException(status_code=429, detail="AI rate limit exceeded. Please wait a minute and try again.")
            else:
                raise HTTPException(status_code=500, detail=f"Could not process the image. Error: {err_msg}")
        
        if extracted_data is None:
            raise HTTPException(status_code=500, detail="No OCR provider available. Please try again later.")
                
        extracted_data['image_path'] = image_url_path
        
        if not extracted_data.get('is_valid_bill', True):
            return {"status": "SUCCESS", "data": extracted_data}
            
        inventory_items = [i.item_name for i in db.query(Inventory).filter(Inventory.merchant_id == merchant_id).all()]
        
        entries_list = extracted_data.get('entries') or []
        valid_entries = []
        for entry in entries_list:
            if not isinstance(entry, dict):
                continue
            conf = entry.get('confidence_score')
            if conf is None:
                conf = 100
            entry['needs_verification'] = bool(float(conf) < 85)
            
            if entry.get('item_name'):
                matches = difflib.get_close_matches(str(entry['item_name']), inventory_items, n=1, cutoff=0.7)
                if matches:
                    entry['item_name'] = matches[0]
                else:
                    entry['needs_verification'] = True
            valid_entries.append(entry)
            
        extracted_data['entries'] = valid_entries

        is_duplicate = False
        items_hash = hashlib.md5(json.dumps([str(e.get('item_name')) for e in valid_entries]).encode()).hexdigest()
        
        existing_bill = db.query(Bill).filter(
            Bill.merchant_id == merchant_id,
            Bill.total_amount == extracted_data.get('total_amount'),
            Bill.items_hash == items_hash
        ).first()
        
        if existing_bill:
            is_duplicate = True
            
        extracted_data['is_duplicate'] = is_duplicate

        return {"status": "SUCCESS", "data": extracted_data}
        
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Snap Process Error: {error_msg}")
        if "429" in error_msg or "quota" in error_msg.lower() or "RESOURCE_EXHAUSTED" in error_msg:
            raise HTTPException(status_code=429, detail="Gemini API rate limit exceeded. Please wait a minute and try again.")
        if "API_KEY_INVALID" in error_msg or "401" in error_msg:
            raise HTTPException(status_code=401, detail="GEMINI_API_KEY is invalid. Please update your API key.")
        raise HTTPException(status_code=500, detail="Could not process the image. Please try again.")

@router.post("/confirm", status_code=status.HTTP_200_OK)
async def confirm_snap_entries(payload: ConfirmPayload, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    if payload.merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    try:
        party_id = None
        if payload.party_name and payload.bill_type and payload.bill_type != 'UNKNOWN':
            party_id = find_closest_party(db, payload.merchant_id, payload.party_name, payload.bill_type)
            
        items_hash = hashlib.md5(json.dumps([e.item_name for e in payload.entries]).encode()).hexdigest()
        bill_id = f"bill_{uuid.uuid4().hex[:8]}"
        
        new_bill = Bill(
            bill_id=bill_id,
            merchant_id=payload.merchant_id,
            party_id=party_id,
            bill_type=payload.bill_type or 'UNKNOWN',
            total_amount=payload.total_amount,
            bill_date=payload.bill_date or datetime.now().strftime('%Y-%m-%d'),
            image_path=payload.image_path,
            items_hash=items_hash
        )
        db.add(new_bill)
        
        party_khata_updates = {}
        
        inventory_items = db.query(Inventory).filter(Inventory.merchant_id == payload.merchant_id).all()
        item_names = [i.item_name for i in inventory_items]
        
        for entry in payload.entries:
            qty = float(entry.quantity) if entry.quantity else 1.0
            amt = float(entry.amount) if entry.amount is not None else (qty * float(entry.rate or 0.0))

            matches = difflib.get_close_matches(entry.item_name, item_names, n=1, cutoff=0.8)
            is_addition = entry.action in ["ADD_STOCK", "SUPPLIER_CREDIT"]
            qty_change = qty if is_addition else -qty
            
            if matches:
                matched_name = matches[0]
                for r in inventory_items:
                    if r.item_name == matched_name:
                        r.current_stock = max(0, r.current_stock + qty_change)
                        break
            else:
                new_item_id = f"item_{uuid.uuid4().hex[:6]}"
                new_stock = qty if is_addition else 0
                new_item = Inventory(
                    item_id=new_item_id,
                    merchant_id=payload.merchant_id,
                    item_name=entry.item_name,
                    current_stock=new_stock,
                    reorder_level=10.0,
                    price=float(entry.rate or 0.0),
                    entry_source="KhataSnap"
                )
                db.add(new_item)
                inventory_items.append(new_item)
                item_names.append(entry.item_name)

            sale_id = f"sale_{uuid.uuid4().hex[:10]}"
            sale_type = "PURCHASE" if is_addition else "SALE"
            note = f"Bill Snap {sale_type}" + (f" ({payload.party_name})" if payload.party_name else "")
            
            new_sale = DailySale(
                sale_id=sale_id,
                merchant_id=payload.merchant_id,
                type=sale_type,
                item=entry.item_name,
                qty=qty,
                amount=amt,
                note=note,
                entry_source="KhataSnap"
            )
            db.add(new_sale)

            if "CREDIT" in entry.action or "REPAYMENT" in entry.action:
                p_type = "SUPPLIER" if "SUPPLIER" in entry.action else "CUSTOMER"
                p_name_target = entry.target_name if entry.target_name else (payload.party_name or "General")
                p_id = party_id if party_id else find_closest_party(db, payload.merchant_id, p_name_target, p_type)
                
                if p_id not in party_khata_updates:
                    party_khata_updates[p_id] = {
                        'amount': 0.0,
                        'is_credit': "CREDIT" in entry.action,
                        'txn_type': "GIVEN" if (entry.action == "CUSTOMER_CREDIT" or entry.action == "SUPPLIER_PAYMENT") else "GOT"
                    }
                party_khata_updates[p_id]['amount'] += amt
                
            elif entry.action in ["ADD_STOCK", "REDUCE_STOCK"]:
                if party_id and payload.party_name:
                    is_supplier_purchase = payload.bill_type == "SUPPLIER" and entry.action == "ADD_STOCK"
                    is_customer_sale = payload.bill_type == "CUSTOMER" and entry.action == "REDUCE_STOCK"
                    
                    if is_supplier_purchase or is_customer_sale:
                        if party_id not in party_khata_updates:
                            party_khata_updates[party_id] = {
                                'amount': 0.0,
                                'is_credit': True,
                                'txn_type': "GIVEN" if is_customer_sale else "GOT"
                            }
                        party_khata_updates[party_id]['amount'] += amt

        for p_id, p_data in party_khata_updates.items():
            if p_data['amount'] > 0:
                balance_change = p_data['amount'] if p_data['is_credit'] else -p_data['amount']
                txn_id = f"txn_{uuid.uuid4().hex[:6]}"
                txn_type = "GIVEN" if payload.bill_type == "CUSTOMER" else "GOT"
                
                new_txn = Transaction(
                    transaction_id=txn_id,
                    party_id=p_id,
                    merchant_id=payload.merchant_id,
                    amount=p_data['amount'],
                    txn_type=txn_type,
                    entry_source="KhataSnap",
                    voice_transcript=f"Bill ID: {bill_id}",
                    image_path=payload.image_path
                )
                db.add(new_txn)
                
                party = db.query(Party).filter(Party.party_id == p_id).first()
                if party:
                    party.total_balance += balance_change
                
        db.commit()
        
        return {"status": "SUCCESS", "msg": "Bill successfully digitized.", "bill_id": bill_id}
    except Exception as e:
        db.rollback()
        logger.error(f"KhataSnap DB Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save bill entries.")