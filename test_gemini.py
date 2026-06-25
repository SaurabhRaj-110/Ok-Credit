import google.generativeai as genai
import os
import json

from dotenv import load_dotenv

load_dotenv('backend/.env')

genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))
model = genai.GenerativeModel('models/gemini-2.0-flash')

system_instruction = '''
You are a highly accurate OCR system specialized in reading Indian Kirana (grocery) store bills, handwritten ledger pages, and printed invoices.

ANALYZE this image carefully.

STEP 1: Determine if this is a valid bill/invoice/ledger. If not (e.g., random photo, scenery, face), return: {"is_valid_bill": false}

STEP 2: If valid, read EVERY line item with extreme care:
- Read handwritten text character by character
- For quantities: look for numbers near items
- For rates/prices: look for ₹ symbol, "Rs", or numbers after items
- For amounts: quantity × rate, or the total next to each line

STEP 3: MULTIPLE PARTIES & MISSING AMOUNTS:
- A single image may contain multiple sections for DIFFERENT parties (e.g., a customer on top, a supplier below).
- Identify the party name for EACH line item and assign it to "target_name".
- Determine if the party is buying from the merchant ("CUSTOMER_CREDIT") or selling to the merchant ("SUPPLIER_CREDIT").
- If amounts or rates are completely missing, set them to null. Do NOT hallucinate prices.

STEP 4: Estimate confidence for each item (0-100)

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
      "item_name": "string",
      "quantity": float or null,
      "rate": float or null,
      "confidence_score": float
    }
  ]
}
'''

with open('dummy.jpg', 'wb') as f:
    f.write(b'\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xFF\xDB\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0C\x14\r\x0C\x0B\x0B\x0C\x19\x12\x13\x0F\x14\x1D\x1A\x1F\x1E\x1D\x1A\x1C\x1C $.\' ",#\x1C\x1C(7),01444\x1F\'9=82<.342\xFF\xDB\x00C\x01\t\t\t\x0C\x0B\x0C\x18\r\r\x182!\x1C!22222222222222222222222222222222222222222222222222\xFF\xC0\x00\x11\x08\x00\x0A\x00\x0A\x03\x01"\x00\x02\x11\x01\x03\x11\x01\xFF\xC4\x00\x15\x00\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08\xFF\xC4\x00\x14\x10\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xFF\xC4\x00\x14\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xFF\xC4\x00\x14\x11\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xFF\xDA\x00\x0C\x03\x01\x00\x02\x11\x03\x11\x00?\x00\xBA\x1A\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xFF\xD9')

response = model.generate_content([system_instruction, {'mime_type': 'image/jpeg', 'data': open('dummy.jpg', 'rb').read()}])
print(response.text)
