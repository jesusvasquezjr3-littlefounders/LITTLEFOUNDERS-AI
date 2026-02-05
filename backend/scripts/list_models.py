import os
from dotenv import load_dotenv
from pathlib import Path
from google import genai

load_dotenv(Path(__file__).parent.parent / ".env")
api_key = os.environ.get("GEMINI_API_KEY")

client = genai.Client(api_key=api_key)
try:
    models = client.models.list()
    print("Available Models:")
    for m in models:
        print(f"- {m.name} ({m.display_name})")
except Exception as e:
    print(f"Error listing models: {e}")
