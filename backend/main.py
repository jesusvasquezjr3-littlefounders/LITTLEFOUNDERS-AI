import os
import sys
import time as _time

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from utils.limiter import limiter

# ── ANSI colors (solo en TTY) ──────────────────────────────────────
if sys.stdout.isatty():
    _GREEN = "\033[92m"
    _RED = "\033[91m"
    _YELLOW = "\033[93m"
    _CYAN = "\033[96m"
    _BOLD = "\033[1m"
    _RESET = "\033[0m"
else:
    _GREEN = _RED = _YELLOW = _CYAN = _BOLD = ""
    _RESET = ""
# ────────────────────────────────────────────────────────────────────

# ── Startup banner ──────────────────────────────────────────────────
_ASCII_BANNER = r"""
+-------------------------------------------------------------------+
  _     _ _   _   _        _____                    _               
 | |   (_) | | | | |      |  ___|                  | |              
 | |    _| |_| |_| | ___  | |_ ___  _   _ _ __   __| | ___ _ __ ___  
 | |   | | __| __| |/ _ \ |  _/ _ \| | | | '_ \ / _` |/ _ \ '__/ __| 
 | |___| | |_| |_| |  __/ | || (_) | |_| | | | | (_| |  __/ |  \__ \ 
 |_____|_|\__|\__|_|\___| |_| \___/ \__,_|_| |_|\__,_|\___|_|  |___/ 
+-------------------------------------------------------------------+
"""
print(f"\n{_CYAN}{_ASCII_BANNER}{_RESET}")
print(f"  {_BOLD}LittleFounders API{_RESET} — Inicializando...\n")
# ────────────────────────────────────────────────────────────────────

from admin.endpoints import router as admin_router
from assets.endpoints import router as assets_router

# Import routers
from auth.endpoints import router as auth_router
from config import settings
from dashboard.endpoints import router as dashboard_router
from lesson_engine.endpoints import router as lesson_engine_router
from notifications.endpoints import router as notifications_router
from reports.endpoints import router as reports_router
from social.endpoints import router as social_router

# Create database tables
# DISABLED for Vercel: Tables should already exist in Supabase
# In serverless environments, this fails because it runs on every cold start
# models.Base.metadata.create_all(bind=engine)

# Rate limiter is configured in utils.limiter

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description=settings.api_description
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Startup checks ──────────────────────────────────────────────────
def _print_check(name: str, ok: bool, detail: str = ""):
    icon = f"{_GREEN}✓{_RESET}" if ok else f"{_RED}✗{_RESET}"
    status = f"{_GREEN}OK{_RESET}" if ok else f"{_RED}FAIL{_RESET}"
    msg = f"  {icon}  {name:<35} {status}"
    if detail:
        msg += f"  →  {_YELLOW}{detail}{_RESET}"
    print(msg)


@app.on_event("startup")
async def _startup_system_check():
    _start = _time.time()
    print(f"\n  {'─' * 55}")
    print(f"  {_BOLD}System Status Check{_RESET}")
    print(f"  {'─' * 55}\n")

    # 1. Configuration
    _required = [
        "database_hostname", "database_port", "database_username",
        "database_password", "database_name", "secret_key",
    ]
    _missing = [v for v in _required if not getattr(settings, v, "")]
    if _missing:
        _print_check("Configuración", False, f"Faltan: {', '.join(_missing)}")
    else:
        _print_check("Configuración", True, f"{settings.api_title} v{settings.api_version}")

    # 2. Database
    try:
        from sqlalchemy import text

        from database import get_db
        db = next(get_db())
        db.execute(text("SELECT 1"))
        db.close()
        _print_check("Base de datos", True, f"{settings.database_name}@{settings.database_hostname}")
    except Exception as _e:
        _print_check("Base de datos", False, str(_e))

    # 3. Supabase
    if settings.supabase_url and settings.supabase_key:
        try:
            import requests
            _r = requests.get(
                f"{settings.supabase_url.rstrip('/')}/rest/v1/",
                timeout=5,
                headers={"apikey": settings.supabase_key},
            )
            # 401 is expected (anon key can't list tables), but means auth is working
            _ok = _r.status_code in (200, 401)
            _detail = f"HTTP {_r.status_code}" if not _ok else "configurado"
            _print_check("Supabase", _ok, _detail)
        except Exception as _e:
            _print_check("Supabase", False, str(_e))
    else:
        _print_check("Supabase", True, "no configurado")

    # 4. Routes
    _n_routes = len(app.routes)
    _print_check("Routers", _n_routes > 0, f"{_n_routes} rutas registradas")

    # 5. Rate limiter
    _print_check("Rate limiter", True, "60 req/min")

    # 6. CORS
    _print_check("CORS", True, f"{len(settings.allowed_origins)} orígenes permitidos")

    _elapsed = _time.time() - _start
    print(f"\n  {'─' * 55}")
    print(f"  {_BOLD}Startup completo{_RESET} — {_elapsed:.2f}s")
    print(f"  {'─' * 55}\n")
# ────────────────────────────────────────────────────────────────────

# Custom exception handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Log validation errors for debugging
    print(f"[VALIDATION ERROR] {request.method} {request.url.path}: {len(exc.errors())} error(s)")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()}
    )

# Request logging middleware
@app.middleware("http")
async def log_requests(request, call_next):
    method = request.method
    path = request.url.path
    print(f"[REQUEST] {method} {path}")
    response = await call_next(request)
    print(f"[RESPONSE] {response.status_code}")
    return response

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)

    # COOP: OAuth routes need popup support; everything else is same-origin
    if request.url.path.startswith("/auth/") or request.url.path.startswith("/api/auth/"):
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
    else:
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"

    # Standard security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    return response

# Include routers
app.include_router(auth_router)
app.include_router(dashboard_router)

app.include_router(lesson_engine_router)
app.include_router(admin_router)
app.include_router(reports_router)

app.include_router(social_router)
app.include_router(notifications_router)
app.include_router(assets_router)

@app.get("/")
async def root():
    return {
        "message": "LittleFounders API",
        "version": settings.api_version,
        "status": "online",
        "doc_url": "/docs"  # Hint for user
    }

@app.get("/health")
async def health_check():
    """Health check endpoint to verify backend is running"""
    try:
        from sqlalchemy import text

        from database import get_db
        db = next(get_db())
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "error"

    return {
        "status": "ok",
        "database": db_status,
    }

# Legacy file-based auth code removed for Vercel/Supabase migration


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
