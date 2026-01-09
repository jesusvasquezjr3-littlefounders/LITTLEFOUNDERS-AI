import sys
import os

# Add backend directory to Python path for Vercel
# Vercel runs from project root, so we need to add backend/ to the path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from main import app

# This is the entry point for Vercel serverless functions
# Vercel expects a handler function or the app instance directly
# The app instance is automatically used as the ASGI handler

# For Vercel Python runtime
handler = app
