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
        self.whisper_model = "whisper-large-v3"

    def transcribe_audio(self, file_path: str) -> str:
        """
        Uses Groq Whisper API to transcribe Hindi/Hinglish audio accurately.
        """
        try:
            with open(file_path, "rb") as file:
                transcription = self.client.audio.transcriptions.create(
                    file=(file_path, file.read()),
                    model=self.whisper_model,
                    response_format="text",
                    language="hi"
                )
            # Remove common filler words
            text = transcription.strip()
            fillers = ["haan", "acha", "matlab", "sun", "ek minute", "hmmm", "uh", "um", "theek hai"]
            for filler in fillers:
                text = text.replace(filler, "")
            
            return text.strip()
        except Exception as e:
            logger.error(f"Whisper Transcription failed: {e}")
            raise e

    def extract_intent(self, text: str) -> dict:
        prompt = f"""
        You are an AI assistant for an Indian shopkeeper.
        Extract the intent from this text: "{text}"
        
        CRITICAL RULES:
        1. "CUSTOMER_PAYMENT": Customer paid money. (Subtracts from their balance).
        2. "CUSTOMER_CREDIT": Customer took items on Udhaar/baaki. (Adds to their balance).
        3. "SUPPLIER_PAYMENT": Shopkeeper paid money to supplier/distributor. (Subtracts from supplier balance).
        4. "SUPPLIER_CREDIT": Shopkeeper took maal on credit from supplier. (Adds to supplier balance).
        5. "ADD_STOCK" / "REDUCE_STOCK": For inventory changes. DO NOT confuse people's names with stock items.
        6. "GENERATE_BILL": If the user says "bill banana hai", "bill bana do", "receipt bana do", "invoice generate karo".
        7. For names, ALWAYS transliterate Hindi/regional words into English script (e.g., "सौरभ राज" -> "Saurabh Raj").
        8. If command contains "supplier", "distributor", "vendor", "company" -> classify as SUPPLIER_PAYMENT or SUPPLIER_CREDIT.
        9. If command contains "customer", "grahak", "uncle", "bhaiya", or just a person's name -> classify as CUSTOMER_PAYMENT or CUSTOMER_CREDIT.
        10. Pay close attention to multiple commands. Example: "5 packet maggi becha aur rahul ne 50 rupaye diye" -> Return two actions.

        Return a JSON object with an 'actions' key containing an array of objects representing each action:
        {{
          "actions": [
            {{
                "action": "CUSTOMER_PAYMENT" | "CUSTOMER_CREDIT" | "SUPPLIER_PAYMENT" | "SUPPLIER_CREDIT" | "ADD_STOCK" | "REDUCE_STOCK" | "GENERATE_BILL" | "UNKNOWN",
                "item_name": string or null,
                "quantity": float or null,
                "unit": string or null,
                "target_name": string or null (Name of customer or supplier),
                "party_type": "CUSTOMER" | "SUPPLIER" | null,
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
                response_format={"type": "json_object"}
            )
            raw_text = response.choices[0].message.content.strip()
            logger.info(f"Groq AI Extraction raw: {raw_text}")
            
            parsed = json.loads(raw_text)
            
            if isinstance(parsed, dict):
                for key in parsed:
                    if isinstance(parsed[key], list):
                        return parsed[key]
                if "action" in parsed:
                    return [parsed]
            
            return parsed
        except Exception as e:
            logger.error(f"Groq Engine crash. Reason: {e}")
            if "quota" in str(e).lower() or "429" in str(e) or "rate limit" in str(e).lower():
                return {"action": "RATE_LIMIT"}
            return {"action": "UNKNOWN"}
