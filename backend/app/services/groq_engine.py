import os
import json
import logging
from groq import Groq

from app.config import settings

logger = logging.getLogger("ShopSathiGroq")

class GroqEngine:
    def __init__(self):
        # Configure API key safely
        api_key = settings.GROQ_API_KEY
        if not api_key or api_key == "MOCK_KEY_FOR_LOCAL_DEV":
            logger.warning("GROQ_API_KEY is not set in environment variables.")
            raise ValueError("GROQ_API_KEY is not set")
            
        self.client = Groq(api_key=api_key)
        self.model = "llama-3.3-70b-versatile"

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
        Return a JSON object with an 'actions' key containing an array of objects representing each action:
        {{
          "actions": [
            {{
                "action": "CUSTOMER_PAYMENT" | "CUSTOMER_CREDIT" | "SUPPLIER_PAYMENT" | "SUPPLIER_CREDIT" | "ADD_STOCK" | "REDUCE_STOCK" | "UNKNOWN",
                "item_name": string or null,
                "quantity": float or null,
                "unit": string or null,
                "target_name": string or null (Name of customer or supplier),
                "amount": float or null
            }}
          ]
        }}
        Do not wrap in markdown, return raw JSON object.
        """
        try:
            response = self.client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that strictly outputs JSON arrays based on the prompt instructions."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                model=self.model,
                temperature=0,
                response_format={"type": "json_object"} # We will actually ask it to return a json object with an 'actions' array to be safe since groq json mode requires an object.
            )
            raw_text = response.choices[0].message.content.strip()
            logger.info(f"Groq AI Extraction raw: {raw_text}")
            
            parsed = json.loads(raw_text)
            
            # Since JSON mode requires an object, if the model returned an object with a key (like {"actions": [...]}) we extract it.
            if isinstance(parsed, dict):
                for key in parsed:
                    if isinstance(parsed[key], list):
                        return parsed[key]
                # If it's a single object that matches the schema, wrap it in a list
                if "action" in parsed:
                    return [parsed]
            
            return parsed
        except Exception as e:
            logger.error(f"Groq Engine crash. Reason: {e}")
            if "quota" in str(e).lower() or "429" in str(e) or "rate limit" in str(e).lower():
                return {"action": "RATE_LIMIT"}
            return {"action": "UNKNOWN"}
