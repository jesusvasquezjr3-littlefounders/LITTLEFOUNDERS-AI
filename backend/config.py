from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        # Don't fail if .env doesn't exist (for Vercel)
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
    
    # CORS configuration
    cors_origins: list[str] = ["*"]
    cors_allow_credentials: bool = True
    cors_allow_methods: list[str] = ["*"]
    cors_allow_headers: list[str] = ["*"]


settings = Settings()
