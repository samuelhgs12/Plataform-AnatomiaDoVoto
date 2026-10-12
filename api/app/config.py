"""Configuração lida de variáveis de ambiente (ou do arquivo .env)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database: str = "md:bdr"                     # md:nome, md:_share/nome/codigo ou caminho de arquivo DuckDB
    motherduck_token: str | None = None          # só no servidor; nunca vai para o navegador
    cors_origins: str = "http://localhost:3000"
    cache_ttl_segundos: int = 3600

    @property
    def origens(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
