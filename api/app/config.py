"""Configuração lida de variáveis de ambiente (ou do arquivo .env)."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# banco gerado pela carga, com os dois repositórios lado a lado: .../load_BDR e .../Plataform-AnatomiaDoVoto
BANCO_DA_CARGA = Path(__file__).resolve().parents[3] / "load_BDR" / "dados_bdr" / "bdr_final.duckdb"
# fotos dos candidatos (load_BDR/fotos_baixar.py): banco à parte, ligado às candidaturas por (ano, ue, sequencial)
BANCO_DAS_FOTOS = BANCO_DA_CARGA.parent / "fotos" / "bdr_fotos.duckdb"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database: str = "md:bdr"                     # md:nome, md:_share/nome/codigo ou caminho de arquivo DuckDB
    motherduck_token: str | None = None          # só no servidor; nunca vai para o navegador
    # usado quando o MotherDuck falha (sem token, fora da organização...); vazio desliga o fallback
    database_local: str = str(BANCO_DA_CARGA)
    fotos_database: str = "md:bdr_fotos"          # mesmas opções de DATABASE
    fotos_database_local: str = str(BANCO_DAS_FOTOS)   # fallback das fotos; vazio desliga
    cors_origins: str = "http://localhost:3000"
    cache_ttl_segundos: int = 3600

    @property
    def origens(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
