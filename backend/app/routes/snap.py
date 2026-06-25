import os
import logging
import json
import uuid
import re
import base64
import difflib
import hashlib
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from sqlite3 import Connection
import google.generativeai as genai

from app.config import settings
from app.database import get_db_connection

logger = logging.getLogger("ShopSathiSnap")
router = APIRouter()

# Initialize Gemini Client
try:
    genai.configure(api_key=settings.GEMINI_API_KEY)
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

def find_closest_party(conn: Connection, merchant_id: str, parsed_name: str, party_type: str) -> str:
    cursor = conn.cursor()
    cursor.execute("SELECT party_id, name FROM parties WHERE merchant_id = ? AND party_type = ?", (merchant_id, party_type))
    rows = cursor.fetchall()
    
    party_names = [r["name"] for r in rows]
    matches = difflib.get_close_matches(parsed_name, party_names, n=1, cutoff=0.8)
    
    if matches:
        matched_name = matches[0]
        for r in rows:
            if r["name"] == matched_name:
                return r["party_id"]

    new_party_id = f"party_{uuid.uuid4().hex[:6]}"
    cursor.execute(
        "INSERT INTO parties (party_id, merchant_id, name, party_type, total_balance) VALUES (?, ?, ?, ?, 0.0)",
        (new_party_id, merchant_id, parsed_name, party_type)
    )
    return new_party_id

@router.post("/process", status_code=status.HTTP_200_OK)
async def process_notebook_image(merchant_id: str = Form(...), file: UploadFile = File(...)):
    logger.info(f"Processing KhataSnap image for merchant: {merchant_id}")
    try:
        image_bytes = await file.read()
        
        import tempfile
        filename = f"{uuid.uuid4().hex}_{file.filename}"
        filepath = os.path.join(tempfile.gettempdir(), filename)
        with open(filepath, "wb") as f:
            f.write(image_bytes)
            
        base64_image = base64.b64encode(image_bytes).decode('utf-8')
        image_url = f"data:{file.content_type};base64,{base64_image}"

        system_instruction = """
You are a highly accurate OCR system specialized in reading Indian Kirana (grocery) store bills, handwritten ledger pages, and printed invoices.

ANALYZE this image carefully.

STEP 1: Determine if this is a valid bill/invoice/ledger. If not (e.g., random photo, scenery, face), return: {"is_valid_bill": false}

STEP 2: If valid, read EVERY line item with extreme care:
- Read handwritten text character by character
- For Hindi/Devanagari text, transliterate to English (e.g., मैगी → Maggi, आटा → Atta, चीनी → Sugar)
- For quantities: look for numbers near items (e.g., "2 kg", "3 pkt", "500g")
- For rates/prices: look for ₹ symbol, "Rs", or numbers after items
- For amounts: quantity × rate, or the total next to each line
- Handle common kirana abbreviations: pkt=packet, kg=kilogram, ltr=litre, dz=dozen

STEP 3: MULTIPLE PARTIES & MISSING AMOUNTS:
- A single image may contain multiple sections for DIFFERENT parties (e.g., a customer on top, a supplier below).
- Identify the party name for EACH line item and assign it to "target_name".
- Determine if the party is buying from the merchant ("CUSTOMER_CREDIT") or selling to the merchant ("SUPPLIER_CREDIT").
- If amounts or rates are completely missing, set them to null. Do NOT hallucinate prices.

STEP 4: Estimate confidence for each item (0-100):
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
- READ the actual text in the image. Do NOT hallucinate or invent items or prices.
- If an image shows multiple parties, create entries for ALL of them and accurately tag their "target_name" and "action".
- Common Indian grocery items: Maggi, Parle-G, Amul, Britannia, Atta (flour), Chawal (rice), Dal, Chini (sugar), Tel (oil), Namak (salt), Doodh (milk), Sabun (soap), Masala.
- Each entry should have at minimum: item_name.
"""

        target_model = "models/gemini-2.0-flash"
        model = genai.GenerativeModel(model_name=target_model)
        
        response = model.generate_content([
            system_instruction, 
            {"mime_type": file.content_type, "data": image_bytes}
        ])
        
        raw_text = response.text.strip()
        
        # Robustly extract JSON block
        if "```json" in raw_text:
            raw_text = raw_text.split("```json")[1].split("```")[0].strip()
        elif "```" in raw_text:
            raw_text = raw_text.split("```")[1].split("```")[0].strip()
            
        start_idx = raw_text.find('{')
        end_idx = raw_text.rfind('}')
        if start_idx != -1 and end_idx != -1:
            raw_text = raw_text[start_idx:end_idx+1]
            
        try:
            extracted_data = json.loads(raw_text)
            if isinstance(extracted_data, list):
                extracted_data = {
                    "is_valid_bill": True,
                    "party_name": "General",
                    "bill_type": "UNKNOWN",
                    "total_amount": 0.0,
                    "entries": extracted_data
                }
            elif not isinstance(extracted_data, dict):
                extracted_data = {}
        except json.JSONDecodeError as je:
            logger.error(f"JSON Parse Error: {je} on text: {raw_text}")
            raise ValueError("Failed to parse JSON from AI response")
            
        extracted_data['image_path'] = filepath
        
        if not extracted_data.get('is_valid_bill', True): # Default to True if missing
            return {"status": "SUCCESS", "data": extracted_data}
            
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT item_name FROM inventory WHERE merchant_id = ?", (merchant_id,))
        inventory_items = [r["item_name"] for r in cursor.fetchall()]
        
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
        
        cursor.execute(
            "SELECT bill_id FROM bills WHERE merchant_id = ? AND total_amount = ? AND items_hash = ?",
            (merchant_id, extracted_data.get('total_amount'), items_hash)
        )
        if cursor.fetchone():
            is_duplicate = True
            
        extracted_data['is_duplicate'] = is_duplicate
        conn.close()

        return {"status": "SUCCESS", "data": extracted_data}
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Snap Process Error: {error_msg}")
        if "429" in error_msg or "quota" in error_msg.lower():
            raise HTTPException(status_code=429, detail="Gemini API rate limit exceeded. Please wait a minute and try again.")
        raise HTTPException(status_code=500, detail="Could not process the image via Gemini Vision.")

@router.post("/confirm", status_code=status.HTTP_200_OK)
async def confirm_snap_entries(payload: ConfirmPayload):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        party_id = None
        if payload.party_name and payload.bill_type and payload.bill_type != 'UNKNOWN':
            party_id = find_closest_party(conn, payload.merchant_id, payload.party_name, payload.bill_type)
            
        items_hash = hashlib.md5(json.dumps([e.item_name for e in payload.entries]).encode()).hexdigest()
        bill_id = f"bill_{uuid.uuid4().hex[:8]}"
        
        cursor.execute(
            "INSERT INTO bills (bill_id, merchant_id, party_id, bill_type, total_amount, bill_date, image_path, items_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (bill_id, payload.merchant_id, party_id, payload.bill_type or 'UNKNOWN', payload.total_amount, payload.bill_date or datetime.now().strftime('%Y-%m-%d'), payload.image_path, items_hash)
        )
        
        party_khata_updates = {}
        
        for entry in payload.entries:
            qty = float(entry.quantity) if entry.quantity else 1.0
            amt = float(entry.amount) if entry.amount is not None else (qty * float(entry.rate or 0.0))

            # 1. Update Stock Inventory
            cursor.execute(
                "SELECT item_id, item_name, current_stock FROM inventory WHERE merchant_id = ?",
                (payload.merchant_id,)
            )
            rows = cursor.fetchall()
            item_names = [r["item_name"] for r in rows]
            matches = difflib.get_close_matches(entry.item_name, item_names, n=1, cutoff=0.8)
            
            is_addition = entry.action in ["ADD_STOCK", "SUPPLIER_CREDIT"]
            qty_change = qty if is_addition else -qty
            
            if matches:
                matched_name = matches[0]
                for r in rows:
                    if r["item_name"] == matched_name:
                        new_stock = max(0, r["current_stock"] + qty_change)
                        cursor.execute("UPDATE inventory SET current_stock = ? WHERE item_id = ?", (new_stock, r["item_id"]))
                        break
            else:
                new_item_id = f"item_{uuid.uuid4().hex[:6]}"
                new_stock = qty if is_addition else 0
                cursor.execute(
                    "INSERT INTO inventory (item_id, merchant_id, item_name, current_stock, reorder_level, price) VALUES (?, ?, ?, ?, 10.0, ?)",
                    (new_item_id, payload.merchant_id, entry.item_name, new_stock, float(entry.rate or 0.0))
                )

            # 2. Track Khata Updates
            if "CREDIT" in entry.action or "REPAYMENT" in entry.action:
                p_type = "SUPPLIER" if "SUPPLIER" in entry.action else "CUSTOMER"
                p_name_target = entry.target_name if entry.target_name else (payload.party_name or "General")
                p_id = party_id if party_id else find_closest_party(conn, payload.merchant_id, p_name_target, p_type)
                
                if p_id not in party_khata_updates:
                    party_khata_updates[p_id] = {
                        'amount': 0.0,
                        'is_credit': "CREDIT" in entry.action,
                        'txn_type': "GIVEN" if (entry.action == "CUSTOMER_CREDIT" or entry.action == "SUPPLIER_PAYMENT") else "GOT"
                    }
                party_khata_updates[p_id]['amount'] += amt

        # 3. Apply consolidated Khata Updates
        for p_id, p_data in party_khata_updates.items():
            if p_data['amount'] > 0:
                balance_change = p_data['amount'] if p_data['is_credit'] else -p_data['amount']
                txn_id = f"txn_{uuid.uuid4().hex[:6]}"
                cursor.execute(
                    "INSERT INTO transactions (transaction_id, party_id, merchant_id, amount, txn_type, entry_source, voice_transcript) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (txn_id, p_id, payload.merchant_id, p_data['amount'], p_data['txn_type'], "LLAMA_OCR", f"Bill ID: {bill_id}")
                )
                cursor.execute(
                    "UPDATE parties SET total_balance = total_balance + ? WHERE party_id = ?",
                    (balance_change, p_id)
                )
                
        conn.commit()
        return {"status": "SUCCESS", "msg": "Bill successfully digitized.", "bill_id": bill_id}
    except Exception as e:
        conn.rollback()
        logger.error(f"KhataSnap DB Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save bill entries.")
    finally:
        conn.close()