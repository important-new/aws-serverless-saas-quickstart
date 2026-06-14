"""Cross-platform tests for product-service (pytest + moto, no Docker/AWS)."""
import json
import boto3
import pytest
from moto import mock_aws

TABLE = "Product-pooled"
TENANT = "t1"


@pytest.fixture
def product_table():
    with mock_aws():
        ddb = boto3.resource("dynamodb", region_name="us-east-1")
        ddb.create_table(
            TableName=TABLE,
            AttributeDefinitions=[
                {"AttributeName": "tenant_id", "AttributeType": "S"},
                {"AttributeName": "product_id", "AttributeType": "S"},
            ],
            KeySchema=[
                {"AttributeName": "tenant_id", "KeyType": "HASH"},
                {"AttributeName": "product_id", "KeyType": "RANGE"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        yield ddb.Table(TABLE)


def _event(body=None, path_id=None):
    e = {"requestContext": {"authorizer": {"tenantId": TENANT, "userRole": "TenantAdmin"}}}
    if body is not None:
        e["body"] = json.dumps(body)
    if path_id is not None:
        e["pathParameters"] = {"id": path_id}
    return e


def _ok(resp):
    assert resp["statusCode"] == 200, resp
    return json.loads(resp["body"])


def _make(svc, name="Widget", price=9.99):
    return _ok(svc.create_product(_event(body={
        "sku": "SKU-1", "name": name, "price": price, "category": "tools"}), None))


def test_create_and_get(product_table):
    import product_service as svc
    created = _make(svc)
    assert created["name"] == "Widget" and created["tenant_id"] == TENANT
    pid = created["product_id"]
    got = _ok(svc.get_product(_event(path_id=f"{TENANT}:{pid}"), None))
    assert got["product_id"] == pid and got["sku"] == "SKU-1"


def test_list(product_table):
    import product_service as svc
    _make(svc, name="A")
    _make(svc, name="B")
    items = _ok(svc.get_products(_event(), None))
    assert len(items) == 2
    assert {i["name"] for i in items} == {"A", "B"}


def test_update_regression(product_table):
    """Regression: datetime misuse + ReturnValues=UPDATED_NEW used to crash update."""
    import product_service as svc
    pid = _make(svc)["product_id"]
    updated = _ok(svc.update_product(
        _event(path_id=f"{TENANT}:{pid}",
               body={"sku": "SKU-1", "name": "Widget v2", "price": 12.5, "category": "tools"}),
        None))
    assert updated["name"] == "Widget v2"
    assert updated["tenant_id"] == TENANT      # KeyError before the ALL_NEW fix
    assert updated["product_id"] == pid


def test_delete(product_table):
    import product_service as svc
    pid = _make(svc)["product_id"]
    _ok(svc.delete_product(_event(path_id=f"{TENANT}:{pid}"), None))
    assert _ok(svc.get_products(_event(), None)) == []
