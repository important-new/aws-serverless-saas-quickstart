#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔐 Getting login information for your SaaS application...\n');

try {
  // 获取Stack输出
  const stackOutput = execSync('aws cloudformation describe-stacks --stack-name saas-control-stack --query "Stacks[0].Outputs" --output json', { encoding: 'utf8' });
  const outputs = JSON.parse(stackOutput);

  // 提取关键信息
  const adminAppSite = outputs.find(o => o.OutputKey === 'AdminAppSite')?.OutputValue;
  const adminApi = outputs.find(o => o.OutputKey === 'AdminApi')?.OutputValue;
  const cognitoUserPoolId = outputs.find(o => o.OutputKey === 'CognitoOperationUsersUserPoolId')?.OutputValue;
  const cognitoAppClientId = outputs.find(o => o.OutputKey === 'CognitoOperationUsersUserPoolClientId')?.OutputValue;

  console.log('📋 Login Information:');
  console.log('=====================');
  console.log('');
  console.log('🌐 Admin Application URL:');
  console.log(`   ${adminAppSite}`);
  console.log('');
  console.log('🔑 Default Login Credentials:');
  console.log('   Username: admin');
  console.log('   Email: test@test.com');
  console.log('   Password: (You will be prompted to change on first login)');
  console.log('');
  console.log('⚙️ API Configuration:');
  console.log(`   API Gateway URL: ${adminApi}`);
  console.log(`   Cognito User Pool ID: ${cognitoUserPoolId}`);
  console.log(`   Cognito App Client ID: ${cognitoAppClientId}`);
  console.log('');
  console.log('📱 Other Application URLs:');
  
  const applicationSite = outputs.find(o => o.OutputKey === 'ApplicationSite')?.OutputValue;
  const landingSite = outputs.find(o => o.OutputKey === 'LandingApplicationSite')?.OutputValue;
  
  if (applicationSite) {
    console.log(`   Tenant Application: ${applicationSite}`);
  }
  if (landingSite) {
    console.log(`   Landing Page: ${landingSite}`);
  }
  
  console.log('');
  console.log('🔧 Next Steps:');
  console.log('   1. Open the Admin Application URL in your browser');
  console.log('   2. Login with username: admin');
  console.log('   3. You will be prompted to change your password');
  console.log('   4. After login, you can manage tenants and users');
  console.log('');
  console.log('⚠️ Security Note:');
  console.log('   - Change the default password immediately');
  console.log('   - Consider creating additional admin users');
  console.log('   - Review and configure your security settings');

} catch (error) {
  console.error('❌ Error getting login information:', error.message);
  console.error('Make sure your stack is deployed and you have proper AWS permissions');
} 