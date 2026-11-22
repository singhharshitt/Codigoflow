import os
import secrets
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Header, HTTPException, status

ENV_FILE = Path(__file__).resolve().parent / ".env"
load_dotenv(ENV_FILE)

API_TOKEN = os.getenv("CODIGOFLOW_API_TOKEN")

if not API_TOKEN:
    raise RuntimeError("CODIGOFLOW_API_TOKEN is missing")


def verify_api_key(x_api_key: str | None = Header(default=None)):
    if not x_api_key or not secrets.compare_digest(
        x_api_key, API_TOKEN
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
        )

    return True
