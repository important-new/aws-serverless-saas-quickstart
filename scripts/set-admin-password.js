#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔐 Setting admin password...\n');

// 获取用户池ID
const getUserPoolId = () => {
  try {
    const output = execSync('aws cloudformation describe-stacks --stack-name saas-control-stack --query "Stacks[0].Outputs[?OutputKey==\'CognitoOperationUsersUserPoolId\'].OutputValue" --output text', { encoding: 'utf8' });
    return output.trim();
  } catch (error) {
    console.error('❌ Error getting user pool ID:', error.message);
    process.exit(1);
  }
};

const userPoolId = getUserPoolId();
console.log(`📋 User Pool ID: ${userPoolId}`);

// 提示用户输入新密码
rl.question('Enter new password for admin user (min 8 characters): ', (password) => {
  if (password.length < 8) {
    console.error('❌ Password must be at least 8 characters long');
    rl.close();
    return;
  }

  try {
    console.log('🔄 Setting new password...');
    
    // 设置新密码
    execSync(`aws cognito-idp admin-set-user-password --user-pool-id ${userPoolId} --username admin --password "${password}" --permanent`, { stdio: 'pipe' });
    
    console.log('✅ Password set successfully!');
    console.log('');
    console.log('🔑 Login Information:');
    console.log('   Username: admin');
    console.log('   Password: ' + password);
    console.log('');
    console.log('🌐 Admin Application URL:');
    
    // 获取Admin应用URL
    const adminUrl = execSync('aws cloudformation describe-stacks --stack-name saas-control-stack --query "Stacks[0].Outputs[?OutputKey==\'AdminAppSite\'].OutputValue" --output text', { encoding: 'utf8' });
    console.log(`   https://${adminUrl.trim()}`);
    console.log('');
    console.log('🔧 You can now login to the admin application!');
    
  } catch (error) {
    console.error('❌ Error setting password:', error.message);
  }
  
  rl.close();
}); 