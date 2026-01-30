import sys
import os
from fastapi import FastAPI
from fastapi.responses import JSONResponse

# Add backend directory to Python path so we can import from it
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, backend_dir)

# Try to import the main app, catch any errors for debugging
try:
    from main import app as application
    app = application
except Exception as e:
    # If the main app fails to import, create a minimal app that returns the error
    app = FastAPI()
    startup_error = str(e)
    
    @app.get("/{path:path}")
    @app.post("/{path:path}")
    async def catch_all(path: str):
        return JSONResponse(
            status_code=500,
            content={
                "error": "Application failed to start",
                "detail": startup_error,
                "path": path
            }
        )
