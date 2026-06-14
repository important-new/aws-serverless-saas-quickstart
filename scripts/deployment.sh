#!/usr/bin/env bash
set -euo pipefail

# Run from the scripts/ directory: ./deployment.sh
# Resolve repo root relative to this script so it works from any CWD.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Validating server code using pylint"
cd "$ROOT_DIR/server"
python3 -m pylint -E -d E0401 $(find . -iname "*.py" -not -path "./.aws-sam/*" -not -path "./TenantPipeline/node_modules/*")
if [[ $? -ne 0 ]]; then
  echo "****ERROR: Please fix above code errors and then rerun script!!****"
  exit 1
fi

REGION=$(aws configure get region)

echo "Shared (control-plane) stack is getting deployed"
cd "$ROOT_DIR/server/shared"
sam build -t template.yaml --use-container --cached
sam deploy --config-file samconfig.toml --region="$REGION"

echo "Pooled tenant (application-plane) stack is getting deployed"
cd "$ROOT_DIR/server/services"
sam build -t template.yaml --use-container --cached
sam deploy --config-file samconfig.toml --region="$REGION"

echo "Deploying TenantPipeline for Platinum tier provisioning"
cd "$ROOT_DIR/server/TenantPipeline"
npm install
cdk bootstrap
cdk deploy --require-approval never

# Stack outputs come from the shared (control-plane) stack: saas-control-stack
CONTROL_STACK="saas-control-stack"
ADMIN_SITE_URL=$(aws cloudformation describe-stacks --stack-name "$CONTROL_STACK" --query "Stacks[0].Outputs[?OutputKey=='AdminAppSite'].OutputValue" --output text)
LANDING_APP_SITE_URL=$(aws cloudformation describe-stacks --stack-name "$CONTROL_STACK" --query "Stacks[0].Outputs[?OutputKey=='LandingApplicationSite'].OutputValue" --output text)
APP_SITE_URL=$(aws cloudformation describe-stacks --stack-name "$CONTROL_STACK" --query "Stacks[0].Outputs[?OutputKey=='ApplicationSite'].OutputValue" --output text)

echo "Admin site URL: https://$ADMIN_SITE_URL"
echo "Landing site URL: https://$LANDING_APP_SITE_URL"
echo "App site URL: https://$APP_SITE_URL"

# Get S3 Bucket names
ADMIN_SITE_BUCKET=$(aws cloudformation describe-stacks --stack-name "$CONTROL_STACK" --query "Stacks[0].Outputs[?OutputKey=='AdminSiteBucket'].OutputValue" --output text)
APP_SITE_BUCKET=$(aws cloudformation describe-stacks --stack-name "$CONTROL_STACK" --query "Stacks[0].Outputs[?OutputKey=='ApplicationSiteBucket'].OutputValue" --output text)
LANDING_SITE_BUCKET=$(aws cloudformation describe-stacks --stack-name "$CONTROL_STACK" --query "Stacks[0].Outputs[?OutputKey=='LandingApplicationSiteBucket'].OutputValue" --output text)

# Deploying Admin, Application and Landing UI code
echo "Deploying frontend applications..."
cd "$ROOT_DIR/client/Admin" && npm install && npm run build && aws s3 sync dist/ "s3://$ADMIN_SITE_BUCKET/" --delete
cd "$ROOT_DIR/client/Application" && npm install && npm run build && aws s3 sync dist/ "s3://$APP_SITE_BUCKET/" --delete
cd "$ROOT_DIR/client/Landing" && npm install && npm run build && aws s3 sync dist/ "s3://$LANDING_SITE_BUCKET/" --delete
