from pydantic_settings import BaseSettings, SettingsConfigDict
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        # Don't fail if .env doesn't exist
        case_sensitive=False
    )

    # Database configuration
    database_hostname: str
    database_port: str
    database_password: str
    database_name: str
    database_username: str
    
    # Security configuration
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Social Auth Configuration
    discord_client_id: str = ""
    discord_client_secret: str = ""
    discord_redirect_uri: str = ""
    
    # Email configuration (optional - email features won't work without these)
    mail_username: str = ""
    mail_password: str = ""
    mail_from: str = ""
    mail_port: int = 587
    mail_server: str = "smtp.gmail.com"
    mail_from_name: str = "LittleFounders"
    
    # API configuration
    api_title: str = "LittleFounders API"
    api_version: str = "1.0.0"
    api_description: str = "API para la plataforma educativa financiera LittleFounders"
    
    # CORS configuration - SECURITY: whitelist only allowed origins
    # Can be overridden via CORS_ORIGINS env var (comma-separated list) in Render dashboard
    _default_cors_origins: list[str] = [
        "https://littlefounders.ai",
        "https://www.littlefounders.ai",
        "https://littlefounders-ai.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8000",
        "http://localhost:8080",
    ]
    cors_allow_credentials: bool = True
    cors_allow_methods: list[str] = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    cors_allow_headers: list[str] = ["*"]

    # Security headers configuration
    coop_policy: str = "same-origin"
    coop_auth_override: str = "same-origin-allow-popups"
    coep_policy: str = "require-corp"

    @property
    def allowed_origins(self) -> list[str]:
        """
        Returns CORS origins from CORS_ORIGINS env var (comma-separated) if set,
        otherwise falls back to the default list above.
        Set this in Render's Environment Variables after you know your Vercel URL.
        """
        env_origins = os.getenv("CORS_ORIGINS", "")
        if env_origins:
            return [o.strip() for o in env_origins.split(",") if o.strip()]
        return self._default_cors_origins


settings = Settings()
