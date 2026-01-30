import sys
import os

# Add backend directory to Python path so we can import from it
# The backend folder is at the root level alongside the api folder
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.append(backend_dir)

from main import app as app
