import os
import json
import logging
import warnings

warnings.filterwarnings("ignore", category=FutureWarning)

import google.generativeai as genai

logger = logging.getLogger("ShopSathiAI")

class GeminiEngine:
    def __init__(self):
        # Configure API key safely
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.warning("GEMINI_API_KEY is not set in environment variables.")
            raise ValueError("GEMINI_API_KEY is not set")
        genai.configure(api_key=api_key)
        
        # Hardcoded to 2.0-flash 
        self.model = genai.GenerativeModel('models/gemini-2.0-flash')

    def extract_intent(self, text: str) -> dict:
        prompt = f"""
        You are an AI assistant for an Indian shopkeeper.
        Extract the intent from this text: "{text}"
        
        CRITICAL RULES:
        1. "CUSTOMER_PAYMENT": Customer paid money (e.g., Advance, Jama kiya, de diya, account clear, jama kar lo). This subtracts from their balance.
        2. "CUSTOMER_CREDIT": Customer took items on Udhaar/baaki (e.g., udhaar likh do, baki hai, baaki). This adds to their balance.
        3. "SUPPLIER_PAYMENT": Shopkeeper paid money to supplier/distributor. Subtracts from supplier balance.
        4. "SUPPLIER_CREDIT": Shopkeeper took maal on credit from supplier. Adds to supplier balance.
        5. "ADD_STOCK" / "REDUCE_STOCK": For inventory changes. DO NOT confuse people's names with stock items.
        6. For names of items or people, ALWAYS transliterate Hindi/regional words into English script (e.g., "सौरभ राज" -> "Saurabh Raj", "सलोनी" -> "Saloni"). Do NOT return text in Devanagari.
        7. Pay close attention to multiple commands for different parties in the same sentence. 
           Example: "सलोनी के खाते में 2000 एडवांस और सौरव राज के खाते में 200 रुपए उधार लिख दो" 
           MUST return TWO actions: 
           - {{"action": "CUSTOMER_PAYMENT", "target_name": "Saloni", "amount": 2000}}
           - {{"action": "CUSTOMER_CREDIT", "target_name": "Saurabh Raj", "amount": 200}}

        The user may speak multiple commands at once (e.g., "5 packet maggi becha aur rahul ne 50 rupaye diye").
        Return EXACTLY a JSON array of objects representing each action:
        [
            {{
                "action": "CUSTOMER_PAYMENT" | "CUSTOMER_CREDIT" | "SUPPLIER_PAYMENT" | "SUPPLIER_CREDIT" | "ADD_STOCK" | "REDUCE_STOCK" | "UNKNOWN",
                "item_name": string or null,
                "quantity": float or null,
                "unit": string or null,
                "target_name": string or null (Name of customer or supplier),
                "amount": float or null
            }}
        ]
        Do not wrap in markdown, return raw JSON array.
        """
        try:
            response = self.model.generate_content(prompt)
            raw_json = response.text.replace("```json", "").replace("```", "").strip()
            logger.info(f"AI Extraction: {raw_json}")
            return json.loads(raw_json)
        except Exception as e:
            logger.error(f"Gemini Engine crash. Reason: {e}")
            if "quota" in str(e).lower() or "429" in str(e):
                return {"action": "RATE_LIMIT"}
            return {"action": "UNKNOWN"}