import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "").strip()
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'dev.db'}")
UPLOAD_ROOT = Path(os.getenv("UPLOAD_ROOT", str(BASE_DIR / "uploads")))
ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()
]

UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

MODEL_LITE = "gemini-3.1-flash-lite-preview"
MODEL_FLASH = "gemini-3-flash-preview"
MODEL_PRO = "gemini-3-pro-preview"