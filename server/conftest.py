"""Shared pytest setup for the backend service tests.

Makes the Lambda handlers importable outside of AWS:
  * puts the shared layer (utils/logger/metrics_manager) and each service's
    src/ on sys.path, and
  * sets the environment variables the handlers/DAL read AT IMPORT TIME.

Both must happen before any test module imports a handler, so they run here at
module load (conftest is imported before test collection).
"""
import os
import sys
from pathlib import Path

SERVER = Path(__file__).resolve().parent

# --- environment (read at import time by *_service_dal.py) ---
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("AWS_REGION", "us-east-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")
os.environ.setdefault("AWS_SESSION_TOKEN", "testing")
os.environ.setdefault("IS_POOLED_DEPLOY", "false")          # silo path -> default boto3 (moto-mocked)
os.environ.setdefault("PRODUCT_TABLE_NAME", "Product-pooled")
os.environ.setdefault("ORDER_TABLE_NAME", "Order-pooled")
os.environ.setdefault("POWERTOOLS_TRACE_DISABLED", "true")  # no X-Ray locally
os.environ.setdefault("POWERTOOLS_METRICS_NAMESPACE", "ServerlessSaaS")
os.environ.setdefault("POWERTOOLS_SERVICE_NAME", "test")

# --- import paths ---
for p in (
    SERVER / "shared" / "layers",
    SERVER / "services" / "product-service" / "src",
    SERVER / "services" / "order-service" / "src",
):
    sys.path.insert(0, str(p))
