from main import app

# This is the entry point for Vercel serverless functions
# Vercel expects a handler function or the app instance directly
# The app instance is automatically used as the ASGI handler

# For Vercel Python runtime
handler = app
