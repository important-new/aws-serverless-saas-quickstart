#!/usr/bin/env bash
# Free, fully-local backend test for product-service:
#   DynamoDB Local (Docker) + `sam local invoke` against it. No AWS account needed.
#
# Requires: Docker running, SAM CLI, local python with boto3.
# Usage: bash scripts/local-test-product.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SVC="$ROOT/server/services/product-service"
NET="saas-local"
ENDPOINT="http://ddb-local:8000"
TABLE="Product-pooled"
TMP="$(mktemp -d)"

cleanup() {
  # always revert the temporary endpoint injection in the template
  git -C "$ROOT" checkout -- server/services/product-service/template.yaml 2>/dev/null || true
  rm -rf "$TMP"
}
trap cleanup EXIT

echo "== 1. DynamoDB Local (shared DB) =="
docker network inspect "$NET" >/dev/null 2>&1 || docker network create "$NET"
docker rm -f ddb-local >/dev/null 2>&1 || true
docker run -d --network "$NET" --name ddb-local -p 8000:8000 amazon/dynamodb-local \
  -jar DynamoDBLocal.jar -inMemory -sharedDb -port 8000 >/dev/null
for i in $(seq 1 20); do curl -s -o /dev/null http://localhost:8000 && break || sleep 1; done

echo "== 2. create table $TABLE =="
python - <<PY
import boto3
d=boto3.client('dynamodb',endpoint_url='http://localhost:8000',region_name='us-east-1',aws_access_key_id='x',aws_secret_access_key='y')
if '$TABLE' not in d.list_tables()['TableNames']:
    d.create_table(TableName='$TABLE',
        AttributeDefinitions=[{'AttributeName':'tenant_id','AttributeType':'S'},{'AttributeName':'product_id','AttributeType':'S'}],
        KeySchema=[{'AttributeName':'tenant_id','KeyType':'HASH'},{'AttributeName':'product_id','KeyType':'RANGE'}],
        ProvisionedThroughput={'ReadCapacityUnits':5,'WriteCapacityUnits':5})
    d.get_waiter('table_exists').wait(TableName='$TABLE')
print('table ready')
PY

echo "== 3. inject local DynamoDB endpoint into template (reverted on exit) =="
# SAM --env-vars only overrides env vars DECLARED in the template, so the local
# endpoint must be present in the template for the function's boto3 to pick it up.
cd "$SVC"
grep -q AWS_ENDPOINT_URL_DYNAMODB template.yaml || \
  sed -i 's#\(POWERTOOLS_METRICS_NAMESPACE: "ServerlessSaaS"\)#\1\n          AWS_ENDPOINT_URL_DYNAMODB: "'"$ENDPOINT"'"#' template.yaml

echo "== 4. build =="
[ -f samconfig.toml ] && mv samconfig.toml samconfig.toml.bak
sam build >/dev/null
[ -f samconfig.toml.bak ] && mv samconfig.toml.bak samconfig.toml

cat > "$TMP/env.json" <<JSON
{ "Parameters": { "PRODUCT_TABLE_NAME": "$TABLE", "IS_POOLED_DEPLOY": "false",
  "AWS_DEFAULT_REGION": "us-east-1", "AWS_REGION": "us-east-1",
  "AWS_ACCESS_KEY_ID": "dummy", "AWS_SECRET_ACCESS_KEY": "dummy",
  "POWERTOOLS_TRACE_DISABLED": "true" } }
JSON
AUTH='"requestContext":{"authorizer":{"tenantId":"tenant-local-1","userRole":"TenantAdmin"}}'
inv() { sam local invoke "$1" --event "$2" --env-vars "$TMP/env.json" --docker-network "$NET" 2>/dev/null; }

echo "== 5. CRUD =="
echo "{ $AUTH, \"body\": \"{\\\"sku\\\":\\\"SKU-1\\\",\\\"name\\\":\\\"Widget\\\",\\\"price\\\":9.99,\\\"category\\\":\\\"tools\\\"}\" }" > "$TMP/create.json"
OUT=$(inv CreateProductFunction "$TMP/create.json"); echo "create: $OUT"
PID=$(echo "$OUT" | python -c "import sys,json;print(json.loads(json.loads(sys.stdin.read())['body'])['product_id'])")
echo "{ $AUTH }" > "$TMP/list.json"
echo "{ $AUTH, \"pathParameters\":{\"id\":\"tenant-local-1:$PID\"} }" > "$TMP/get.json"
echo "{ $AUTH, \"pathParameters\":{\"id\":\"tenant-local-1:$PID\"}, \"body\":\"{\\\"sku\\\":\\\"SKU-1\\\",\\\"name\\\":\\\"Widget v2\\\",\\\"price\\\":12.5,\\\"category\\\":\\\"tools\\\"}\" }" > "$TMP/update.json"
echo "get:    $(inv GetProductFunction "$TMP/get.json")"
echo "update: $(inv UpdateProductFunction "$TMP/update.json")"
echo "list:   $(inv GetProductsFunction "$TMP/list.json")"
echo "delete: $(inv DeleteProductFunction "$TMP/get.json")"
echo "list after delete: $(inv GetProductsFunction "$TMP/list.json")"

echo "== done. To stop DynamoDB Local: docker rm -f ddb-local =="
