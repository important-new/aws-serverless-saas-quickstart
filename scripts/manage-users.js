#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('👥 SaaS User Management Tool\n');

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

// 显示菜单
const showMenu = () => {
  console.log('📋 Available Actions:');
  console.log('1. List all users');
  console.log('2. Create new admin user');
  console.log('3. Set admin password');
  console.log('4. Delete user');
  console.log('5. Show login information');
  console.log('6. Exit');
  console.log('');
};

// 列出所有用户
const listUsers = () => {
  try {
    console.log('📋 Current Users:');
    console.log('================');
    
    const output = execSync(`aws cognito-idp list-users --user-pool-id ${userPoolId} --query "Users[].{Username:Username,Status:UserStatus,Email:Attributes[?Name=='email'].Value|[0],Created:UserCreateDate}" --output table`, { encoding: 'utf8' });
    console.log(output);
  } catch (error) {
    console.error('❌ Error listing users:', error.message);
  }
};

// 创建新用户
const createUser = () => {
  rl.question('Enter username: ', (username) => {
    rl.question('Enter email: ', (email) => {
      rl.question('Enter password (min 8 characters): ', (password) => {
        if (password.length < 8) {
          console.error('❌ Password must be at least 8 characters long');
          return;
        }

        try {
          console.log('🔄 Creating user...');
          
          // 创建用户
          execSync(`aws cognito-idp admin-create-user --user-pool-id ${userPoolId} --username ${username} --user-attributes Name=email,Value=${email} Name=email_verified,Value=true --temporary-password "${password}"`, { stdio: 'pipe' });
          
          // 设置永久密码
          execSync(`aws cognito-idp admin-set-user-password --user-pool-id ${userPoolId} --username ${username} --password "${password}" --permanent`, { stdio: 'pipe' });
          
          console.log('✅ User created successfully!');
          console.log(`   Username: ${username}`);
          console.log(`   Email: ${email}`);
          console.log(`   Password: ${password}`);
        } catch (error) {
          console.error('❌ Error creating user:', error.message);
        }
      });
    });
  });
};

// 设置密码
const setPassword = () => {
  rl.question('Enter username: ', (username) => {
    rl.question('Enter new password (min 8 characters): ', (password) => {
      if (password.length < 8) {
        console.error('❌ Password must be at least 8 characters long');
        return;
      }

      try {
        console.log('🔄 Setting password...');
        execSync(`aws cognito-idp admin-set-user-password --user-pool-id ${userPoolId} --username ${username} --password "${password}" --permanent`, { stdio: 'pipe' });
        console.log('✅ Password set successfully!');
      } catch (error) {
        console.error('❌ Error setting password:', error.message);
      }
    });
  });
};

// 删除用户
const deleteUser = () => {
  rl.question('Enter username to delete: ', (username) => {
    rl.question(`Are you sure you want to delete user '${username}'? (yes/no): `, (confirm) => {
      if (confirm.toLowerCase() === 'yes') {
        try {
          console.log('🔄 Deleting user...');
          execSync(`aws cognito-idp admin-delete-user --user-pool-id ${userPoolId} --username ${username}`, { stdio: 'pipe' });
          console.log('✅ User deleted successfully!');
        } catch (error) {
          console.error('❌ Error deleting user:', error.message);
        }
      } else {
        console.log('❌ User deletion cancelled');
      }
    });
  });
};

// 显示登录信息
const showLoginInfo = () => {
  try {
    console.log('🔐 Login Information:');
    console.log('====================');
    
    const adminUrl = execSync('aws cloudformation describe-stacks --stack-name saas-control-stack --query "Stacks[0].Outputs[?OutputKey==\'AdminAppSite\'].OutputValue" --output text', { encoding: 'utf8' });
    const adminApi = execSync('aws cloudformation describe-stacks --stack-name saas-control-stack --query "Stacks[0].Outputs[?OutputKey==\'AdminApi\'].OutputValue" --output text', { encoding: 'utf8' });
    
    console.log(`🌐 Admin Application: https://${adminUrl.trim()}`);
    console.log(`🔗 API Gateway: ${adminApi.trim()}`);
    console.log(`📋 User Pool ID: ${userPoolId}`);
    console.log('');
    console.log('🔑 Default Admin User:');
    console.log('   Username: admin');
    console.log('   Email: test@test.com');
  } catch (error) {
    console.error('❌ Error getting login info:', error.message);
  }
};

// 主循环
const mainLoop = () => {
  showMenu();
  rl.question('Select an action (1-6): ', (choice) => {
    switch (choice) {
      case '1':
        listUsers();
        break;
      case '2':
        createUser();
        break;
      case '3':
        setPassword();
        break;
      case '4':
        deleteUser();
        break;
      case '5':
        showLoginInfo();
        break;
      case '6':
        console.log('👋 Goodbye!');
        rl.close();
        return;
      default:
        console.log('❌ Invalid choice. Please select 1-6.');
    }
    
    console.log('');
    setTimeout(mainLoop, 1000);
  });
};

// 启动程序
mainLoop(); 