## Step 1: Bulletproof the Gemini Engine (`gemini_engine.py`)

import google.generativeai as genai
import json
import logging

from sympy import python
from app.config import settings

logger = logging.getLogger("ShopSathiAI")
genai.configure(api_key=settings.GEMINI_API_KEY)

class GeminiEngine:
    @staticmethod
    def parse_voice_command(transcript: str) -> dict:
        system_instruction = (
            "You are the core intelligence module for ShopSathi AI, an ERP for Indian Kirana stores. "
            "Your job is to read raw text transcripts from a shopkeeper and return a clean JSON object. "
            "Return exactly this JSON schema format:\n"
            "{\n"
            '  "action": "ADD_CREDIT" | "RECORD_REPAYMENT" | "ADD_STOCK" | "UNKNOWN",\n'
            '  "target_name": "string or null",\n'
            '  "amount": float_or_null,\n'
            '  "item_name": "string or null",\n'
            '  "quantity": float_or_null\n'
            "}\n\n"
            "Rules for classification:\n"
            "- 'Udhaar', 'baki', 'khata', 'diye' usually mean ADD_CREDIT\n"
            "- 'Jama kiye', 'mil gaye', 'paisa aaya' mean RECORD_REPAYMENT\n"
            "- 'Maal aaya', 'biscuit aaya', 'stock' mean ADD_STOCK\n"
            "Normalize names to clean proper case (e.g., 'ramesh ji' -> 'Ramesh')."
        )

        try:
            model = genai.GenerativeModel(
                model_name="gemini-1.5-flash",
                generation_config={"response_mime_type": "application/json"},
                system_instruction=system_instruction
            )
            
            response = model.generate_content(transcript)
            raw_text = response.text.strip()
            
            # Clean up sneaky Markdown formatting ---
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            if raw_text.startswith("```"):
                raw_text = raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
                
            return json.loads(raw_text.strip())
            
        except Exception as e:
            logger.error(f"Gemini Engine crash: {str(e)}")
            return {"action": "UNKNOWN"}


#Force-Load the `.env` file (`config.py`)
    
import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Force Python to find and load the .env file in the current directory
load_dotenv()

class Settings(BaseSettings):
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "MOCK_KEY_FOR_LOCAL_DEV")
    DATABASE_FILE: str = "shopsathi.db"
    
settings = Settings()

