# Free Local Backend Testing (No AWS Account Required)

[**English**](LOCAL_TESTING.md) ｜ [中文](zh-CN/LOCAL_TESTING.md)

[← Back to README](../README.md)

Run the backend services for real, locally, to verify the Lambda handler + DAL +
DynamoDB reads/writes — at zero cost, without touching real AWS. Two approaches
are provided.

> Note: neither approach includes **Cognito**. Real login depends on Cognito
> (there is no free local alternative — see `docs/MIGRATION_VERIFICATION.md`).
> Both bypass the authorizer by injecting a fake auth context
> (`tenantId`/`userRole`) through `requestContext.authorizer`.

## Approach 1 (Recommended, Cross-Platform): pytest + moto

Pure Python, **works on Windows/macOS/Linux, no Docker and no AWS required**.
`moto` simulates DynamoDB in memory. Two commands:

```bash
pip install -r requirements-test.txt
pytest
```

- Tests live in `server/services/*/tests/test_*.py`: they import the handler
  directly, mock DynamoDB with moto, and assert CRUD (including update
  regression tests that lock in the 3 fixed bugs).
- Shared setup is in `server/conftest.py` (adds the shared layer and each
  service's `src/` to `sys.path`, and sets environment variables before import).
- CI: `.github/workflows/backend-tests.yml` runs `pytest` on all three
  platforms — ubuntu/windows/macOS.

This is the preferred approach for writing test suites and running CI. The
DynamoDB Local approach below is higher fidelity but heavier, depends on Docker
and Git Bash (not cross-platform), and suits occasional high-fidelity
verification.

## Approach 2 (High Fidelity): DynamoDB Local + sam local invoke

### Prerequisites
- Docker running
- SAM CLI (`pip install aws-sam-cli`)
- Local Python + boto3 (`pip install boto3`)

## One-Command Run (product-service full CRUD)
```bash
bash scripts/local-test-product.sh
```
The script will: start DynamoDB Local (`-sharedDb`) → create the `Product-pooled`
table → build → invoke create/get/update/list/delete in sequence, and finally
automatically revert the temporary changes.
Stop the local database: `docker rm -f ddb-local`.

## Key Pitfalls (Be Careful When Doing This Manually)

1. **DynamoDB Local needs `-sharedDb`**: otherwise it isolates the database file
   by "credentials + region", so the table creator and the function don't see
   the same database.
   ```bash
   docker run -d --network saas-local --name ddb-local -p 8000:8000 \
     amazon/dynamodb-local -jar DynamoDBLocal.jar -inMemory -sharedDb -port 8000
   ```

2. **`sam local invoke --env-vars` can only override environment variables
   already declared in the template**. `AWS_ENDPOINT_URL_DYNAMODB` (which points
   the function's boto3 at the local database) won't be injected if it's not in
   the template. So you need to temporarily add it to
   `Globals.Function.Environment` in `template.yaml`:
   ```yaml
   AWS_ENDPOINT_URL_DYNAMODB: "http://ddb-local:8000"
   ```
   (The script adds it automatically and reverts with `git checkout` when done.)

3. **The function container must join the same Docker network**:
   `sam local invoke ... --docker-network saas-local`, so that the hostname
   `ddb-local` used inside the function resolves to the DynamoDB Local container.

4. **Turn off X-Ray**: set `POWERTOOLS_TRACE_DISABLED=true` in the env, to avoid
   noisy errors from the missing local X-Ray daemon.

## Verified Results (2026-06-14)

All five product-service operations returned `statusCode 200`: create / get /
get_products / update / delete. Local testing also **found and fixed two
pre-existing bugs in update** (misuse of `datetime`,
`ReturnValues=UPDATED_NEW`) — see commit `b61c780`.

order-service follows the same code pattern and has had the same fixes applied
(you can verify it the same way by creating an `Order-pooled` table following
this script).

---

## Frontend: Playwright Runtime Smoke Test (Cross-Platform)

`e2e/` is a standalone Playwright project that **works on
Windows/macOS/Linux**. It serves the build artifacts of all three apps, loads
them with headless Chromium, and asserts: Angular 20 bootstraps correctly, the
app shell and key elements render (Admin verifies that
`<amplify-authenticator>` appears), and there are no fatal JS errors.

```bash
# First build the three apps (each in its own directory): npx ng build --configuration production
cd e2e
npm install
npx playwright install chromium      # Speed up in mainland China: PLAYWRIGHT_DOWNLOAD_HOST=https://cdn.npmmirror.com/binaries/playwright
npx playwright test
```

- Does not test real login (no free local Cognito); expected network/auth
  errors against the placeholder config are ignored.
- CI: `.github/workflows/frontend-e2e.yml` builds the three apps and then runs
  Playwright.
