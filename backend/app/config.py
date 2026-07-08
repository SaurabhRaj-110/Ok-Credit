import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# This forces Python to find and load the .env file before doing anything else
load_dotenv() 

class Settings(BaseSettings):
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY") or "MOCK_KEY_FOR_LOCAL_DEV"
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY") or "MOCK_KEY_FOR_LOCAL_DEV"
    
    # If the environment has a mounted persistent disk (like /data on Render), use it.
    # Otherwise, fallback to the local folder for local development.
    DATABASE_FILE: str = os.getenv("DATABASE_FILE", "/data/shopsathi.db" if os.path.exists("/data") else "shopsathi.db")
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "/data/uploads" if os.path.exists("/data") else "uploads")

settings = Settings()