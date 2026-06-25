import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# This forces Python to find and load the .env file before doing anything else
load_dotenv() 

class Settings(BaseSettings):
    # It will now definitely pull the real key from the environment
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY") or "MOCK_KEY_FOR_LOCAL_DEV"
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY") or "MOCK_KEY_FOR_LOCAL_DEV"
    DATABASE_FILE: str = "shopsathi.db"

settings = Settings()