import os
import sys
from pathlib import Path
from unittest.mock import patch

# Set a dummy token before importing the application.
os.environ["CODIGOFLOW_API_TOKEN"] = "codigoflow-ci-test-token"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

HEADERS = {"X-API-Key": "codigoflow-ci-test-token"}


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_home():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"


def test_auth_missing_token():
    response = client.get("/api/auth-check")
    assert response.status_code == 401


def test_auth_invalid_token():
    response = client.get(
        "/api/auth-check",
        headers={"X-API-Key": "invalid-token"},
    )
    assert response.status_code == 401


def test_auth_valid_token():
    response = client.get("/api/auth-check", headers=HEADERS)
    assert response.status_code == 200
    assert response.json()["authenticated"] is True


def test_deploy_requires_auth():
    response = client.post("/api/deploy/deploy-nginx")
    assert response.status_code == 401


def test_invalid_deployment_action():
    response = client.post(
        "/api/deploy/invalid-action",
        headers=HEADERS,
    )
    assert response.status_code == 400


def test_successful_deployment():
    with patch(
        "main.run_playbook",
        return_value={"success": True},
    ) as mock_runner:
        response = client.post(
            "/api/deploy/deploy-nginx",
            headers=HEADERS,
        )

    assert response.status_code == 200
    assert response.json()["success"] is True
    mock_runner.assert_called_once_with("deploy-nginx")


def test_successful_rollback():
    with patch(
        "main.run_playbook",
        return_value={"success": True},
    ) as mock_runner:
        response = client.post(
            "/api/deploy/rollback-nginx",
            headers=HEADERS,
        )

    assert response.status_code == 200
    assert response.json()["success"] is True
    mock_runner.assert_called_once_with("rollback-nginx")


def test_deployment_failure():
    with patch(
        "main.run_playbook",
        return_value={"success": False},
    ):
        response = client.post(
            "/api/deploy/deploy-nginx",
            headers=HEADERS,
        )

    assert response.status_code == 500


def test_deployment_lock_conflict():
    with patch(
        "main.run_playbook",
        side_effect=RuntimeError("Deployment locked"),
    ):
        response = client.post(
            "/api/deploy/deploy-nginx",
            headers=HEADERS,
        )

    assert response.status_code == 409
