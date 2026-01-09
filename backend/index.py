import sys
import os

# Add backend directory to Python path for Vercel
# Vercel runs from project root, so we need to add backend/ to the path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Import the FastAPI app
# For Vercel Python runtime, the variable MUST be named 'app'
from main import app

# Vercel automatically detects FastAPI/ASGI apps when exported as 'app'
