# YTPortfolio Backend App Package

# Fix macOS SSL certificate issue - must run before any httpx/supabase imports
import os
from pathlib import Path

import certifi
from dotenv import load_dotenv

os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()

# Load .env early so all modules see the vars
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
