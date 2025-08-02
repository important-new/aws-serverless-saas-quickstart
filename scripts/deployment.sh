echo "server code is getting deployed"
cd ../server


echo "Validating server code using pylint"
python3 -m pylint -E -d E0401 $(find . -iname "*.py" -not -path "./.aws-sam/*" -not -path "./TenantPipeline/node_modules/*")
if [[ $? -ne 0 ]]; then
  echo "****ERROR: Please fix above code errors and then rerun script!!****"
  exit 1
fi

REGION=$(aws configure get region)
sam build -t shared-template.yaml --use-container --cached 
sam deploy --config-file shared-samconfig.toml --region=$REGION

    
echo "Pooled tenant server code is getting deployed"
sam build -t tenant-template.yaml --use-container --cached
sam deploy --config-file tenant-samconfig.toml --region=$REGION

echo "Deploying TenantPipeline for Platinum tier provisioning"
cd TenantPipeline
npm install
cdk bootstrap
cdk deploy --require-approval never
cd ..

cd ../scripts

ADMIN_SITE_URL=$(aws cloudformation describe-stacks --stack-name saas-control-stack --query "Stacks[0].Outputs[?OutputKey=='AdminAppSite'].OutputValue" --output text)
LANDING_APP_SITE_URL=$(aws cloudformation describe-stacks --stack-name saas-control-stack --query "Stacks[0].Outputs[?OutputKey=='LandingApplicationSite'].OutputValue" --output text)
APP_SITE_URL=$(aws cloudformation describe-stacks --stack-name saas-control-stack --query "Stacks[0].Outputs[?OutputKey=='ApplicationSite'].OutputValue" --output text)

echo "Admin site URL: https://$ADMIN_SITE_URL"
echo "Landing site URL: https://$LANDING_APP_SITE_URL"
echo "App site URL: https://$APP_SITE_URL"
  
# Get S3 Bucket names
ADMIN_SITE_BUCKET=$(aws cloudformation describe-stacks --stack-name saas-control-stack --query "Stacks[0].Outputs[?OutputKey=='AdminSiteBucket'].OutputValue" --output text)
APP_SITE_BUCKET=$(aws cloudformation describe-stacks --stack-name saas-control-stack --query "Stacks[0].Outputs[?OutputKey=='ApplicationSiteBucket'].OutputValue" --output text)
LANDING_SITE_BUCKET=$(aws cloudformation describe-stacks --stack-name saas-control-stack --query "Stacks[0].Outputs[?OutputKey=='LandingApplicationSiteBucket'].OutputValue" --output text)

# Deploying Admin, Application and Landing UI code
echo "Deploying frontend applications..."
cd ../client/Admin && npm install && npm run build && aws s3 sync dist/ s3://$ADMIN_SITE_BUCKET/ --delete
cd ../Application && npm install && npm run build && aws s3 sync dist/ s3://$APP_SITE_BUCKET/ --delete  
cd ../Landing && npm install && npm run build && aws s3 sync dist/ s3://$LANDING_SITE_BUCKET/ --delete






