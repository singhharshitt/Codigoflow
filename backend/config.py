from pathlib import Path

BASE_DIR = Path("/home/ubuntu/codigoflow")

ANSIBLE_INVENTORY = BASE_DIR / "ansible/inventory.ini"

ALLOWED_PLAYBOOKS = {
    "deploy-nginx": BASE_DIR / "ansible/deploy-auto-rollback.yml",
    "rollback-nginx": BASE_DIR / "ansible/rollback-nginx.yml",
}
