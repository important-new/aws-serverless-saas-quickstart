#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('👤 Creating new admin user...\n');

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

// 收集用户信息
rl.question('Enter username for new admin user: ', (username) => {
  rl.question('Enter email for new admin user: ', (email) => {
    rl.question('Enter password (min 8 characters): ', (password) => {
      if (password.length < 8) {
        console.error('❌ Password must be at least 8 characters long');
        rl.close();
        return;
      }

      try {
        console.log('🔄 Creating new admin user...');
        
        // 创建用户
        const createUserCmd = `aws cognito-idp admin-create-user --user-pool-id ${userPoolId} --username ${username} --user-attributes Name=email,Value=${email} Name=email_verified,Value=true --temporary-password "${password}"`;
        execSync(createUserCmd, { stdio: 'pipe' });
        
        // 设置永久密码
        const setPasswordCmd = `aws cognito-idp admin-set-user-password --user-pool-id ${userPoolId} --username ${username} --password "${password}" --permanent`;
        execSync(setPasswordCmd, { stdio: 'pipe' });
        
        console.log('✅ Admin user created successfully!');
        console.log('');
        console.log('🔑 New User Information:');
        console.log(`   Username: ${username}`);
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
        console.log('');
        console.log('🌐 Admin Application URL:');
        
        // 获取Admin应用URL
        const adminUrl = execSync('aws cloudformation describe-stacks --stack-name saas-control-stack --query "Stacks[0].Outputs[?OutputKey==\'AdminAppSite\'].OutputValue" --output text', { encoding: 'utf8' });
        console.log(`   https://${adminUrl.trim()}`);
        console.log('');
        console.log('🔧 The new user can now login to the admin application!');
        
      } catch (error) {
        console.error('❌ Error creating user:', error.message);
      }
      
      rl.close();
    });
  });
}); 