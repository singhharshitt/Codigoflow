from fastapi import FastAPI

app = FastAPI(
    title="CodigoFlow API",
    description="DevOps orchestration platform",
    version="0.1.0"
)

@app.get("/")
def home():
    return {
        "application": "CodigoFlow",
        "status": "running"
    }

@app.get("/health")
def health():
    return {
        "status": "healthy"
    }

from fastapi import Depends
from auth import verify_api_key

@app.get("/api/auth-check")
def auth_check(authenticated: bool = Depends(verify_api_key)):
    return {
        "authenticated": authenticated,
        "message": "CodigoFlow API authentication successful"
    }

from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool
from ansible_runner import run_playbook
from config import ALLOWED_PLAYBOOKS


@app.post("/api/deploy/{action}")
async def deploy(
    action: str,
    authenticated: bool = Depends(verify_api_key)
):
    if action not in ALLOWED_PLAYBOOKS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported deployment action"
        )

    try:
        result = await run_in_threadpool(run_playbook, action)
    except RuntimeError as error:
        raise HTTPException(
            status_code=409,
            detail="Deployment already in progress"
        ) from error

    if not result["success"]:
        raise HTTPException(
            status_code=500,
            detail="Deployment failed; check server logs"
        )

    return {
        "action": action,
        "success": True,
        "message": "Deployment completed successfully"
    }
