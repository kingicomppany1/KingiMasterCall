from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    supabase_url: str
    supabase_service_role_key: str
    supabase_jwt_secret: str = ""
    at_username: str = ""
    at_api_key: str = ""
    at_phone_number: str = ""
    at_webhook_secret: str = ""
    at_rate_ngn_per_min: float = 15
    at_max_call_seconds: int = 1800
    cors_origins: str = "http://localhost:3000"


settings = Settings()  # type: ignore[call-arg]
