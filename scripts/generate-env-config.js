#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 获取命令行参数
const args = process.argv.slice(2);
const projectName = args[0]; // 'Admin', 'Application', 'Landing'
const environment = args[1] || 'prod'; // 'dev', 'prod', 'stage'

if (!projectName) {
  console.error('Usage: node generate-env-config.js <projectName> [environment]');
  console.error('Example: node generate-env-config.js Admin prod');
  process.exit(1);
}

console.log(`Generating environment config for ${projectName} (${environment})...`);

try {
  // 从共享(控制平面)栈 saas-control-stack 读取 AdminApi 输出。
  // 该输出本身就是完整的 API Gateway URL，例如:
  //   https://<id>.execute-api.us-east-1.amazonaws.com/prod
  const result = execSync(
    'aws cloudformation describe-stacks --stack-name saas-control-stack --query "Stacks[0].Outputs[?OutputKey==\'AdminApi\'].OutputValue" --output text',
    { encoding: 'utf8' }
  );
  const apiGatewayUrl = result.trim();

  if (!apiGatewayUrl || apiGatewayUrl === 'None') {
    console.error('Could not find API Gateway URL (AdminApi output) on stack saas-control-stack');
    console.error('Make sure the shared stack is deployed (cd scripts && ./deployment.sh)');
    process.exit(1);
  }

  console.log(`Found API Gateway URL: ${apiGatewayUrl}`);

  // 生成环境配置
  const envConfig = `export const environment = {
  production: ${environment === 'prod'},
  apiUrl: '${apiGatewayUrl}',
  environment: '${environment}',
  buildTime: '${new Date().toISOString()}'
};
`;

  // 写入文件
  const envPath = path.join(__dirname, '..', 'client', projectName, 'src', 'environments', 'environment.ts');
  fs.writeFileSync(envPath, envConfig);
  
  console.log(`✅ Environment config generated: ${envPath}`);

} catch (error) {
  console.error('Error generating environment config:', error.message);
  console.error('Make sure you have AWS CLI configured and proper permissions');
  process.exit(1);
} 