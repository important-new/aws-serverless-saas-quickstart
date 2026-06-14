"""Cross-platform tests for order-service (pytest + moto, no Docker/AWS)."""
import json
import boto3
import pytest
from moto import mock_aws

TABLE = "Order-pooled"
TENANT = "t1"


@pytest.fixture
def order_table():
    with mock_aws():
        ddb = boto3.resource("dynamodb", region_name="us-east-1")
        ddb.create_table(
            TableName=TABLE,
            AttributeDefinitions=[
                {"AttributeName": "tenant_id", "AttributeType": "S"},
                {"AttributeName": "order_id", "AttributeType": "S"},
            ],
            KeySchema=[
                {"AttributeName": "tenant_id", "KeyType": "HASH"},
                {"AttributeName": "order_id", "KeyType": "RANGE"},
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


def _make(svc, name="Order-A"):
    return _ok(svc.create_order(_event(body={
        "orderName": name,
        "orderProducts": [{"productId": "p1", "price": 9.99, "quantity": 2}]}), None))


def test_create_and_get(order_table):
    import order_service as svc
    created = _make(svc)
    assert created["order_name"] == "Order-A" and created["tenant_id"] == TENANT
    assert created["order_products"][0]["productId"] == "p1"
    oid = created["order_id"]
    got = _ok(svc.get_order(_event(path_id=f"{TENANT}:{oid}"), None))
    assert got["order_id"] == oid


def test_list(order_table):
    import order_service as svc
    _make(svc, name="O1")
    _make(svc, name="O2")
    items = _ok(svc.get_orders(_event(), None))
    assert len(items) == 2


def test_update_regression(order_table):
    """Regression: datetime, ReturnValues, and vars()-on-dict bugs used to crash update."""
    import order_service as svc
    oid = _make(svc)["order_id"]
    updated = _ok(svc.update_order(
        _event(path_id=f"{TENANT}:{oid}",
               body={"orderName": "Order-A v2",
                     "orderProducts": [{"productId": "p1", "price": 12.5, "quantity": 5}]}),
        None))
    assert updated["order_name"] == "Order-A v2"
    assert updated["tenant_id"] == TENANT       # KeyError before the ALL_NEW fix
    assert updated["order_products"][0]["quantity"] == 5   # vars()-on-dict fix


def test_delete(order_table):
    import order_service as svc
    oid = _make(svc)["order_id"]
    _ok(svc.delete_order(_event(path_id=f"{TENANT}:{oid}"), None))
    assert _ok(svc.get_orders(_event(), None)) == []
