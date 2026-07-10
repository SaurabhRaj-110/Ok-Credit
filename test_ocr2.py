import google.generativeai as genai
import os
import json
api_key = open('backend/.env', encoding='utf-8').read().split('GEMINI_API_KEY=')[1].split('\n')[0].strip('"')
genai.configure(api_key=api_key)

system_instruction = """
You are a highly accurate OCR system specialized in reading Indian Kirana (grocery) store bills, handwritten ledger pages, and printed invoices.

ANALYZE this image carefully.

STEP 1: Determine if this is a valid bill/invoice/ledger. If not (e.g., random photo, scenery, face), return: {"is_valid_bill": false, "entries": []}

STEP 2: If valid, read EVERY line item with extreme care:
- Read handwritten text character by character
- For Hindi/Devanagari text, transliterate to English (e.g., आटा -> Atta)
- For quantities: look for numbers near items (e.g., "2 kg", "3 pkt", "500g")
- For rates/prices: look for ₹ symbol, "Rs", or numbers after items
- For amounts: quantity x rate, or the total next to each line
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
- If NO valid items are found, YOU MUST RETURN "is_valid_bill": false and an empty "entries" array.
"""

model = genai.GenerativeModel(model_name="models/gemini-1.5-flash", system_instruction=system_instruction)
try:
    with open('C:/Users/saura/.gemini/antigravity/brain/37a860ad-573b-43cc-a9c2-8fecc9ea6f48/media__1783680419560.png', 'rb') as f:
        img_data = f.read()
    print('Calling API...')
    res = model.generate_content([{'mime_type': 'image/png', 'data': img_data}])
    with open('output.json', 'w', encoding='utf-8') as f:
        f.write(res.text)
    print('SUCCESS')
except Exception as e:
    print('ERROR:', type(e).__name__, str(e))
