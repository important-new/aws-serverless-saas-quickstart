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
  // 获取API Gateway URL
  let apiGatewayUrl = '';
  
  if (environment === 'prod') {
    // 查询生产环境的API Gateway
    const result = execSync('aws apigateway get-rest-apis --query "items[?name==\'saas-quickstart-shared\'].id" --output text', { encoding: 'utf8' });
    const apiId = result.trim();
    if (apiId) {
      apiGatewayUrl = `https://${apiId}.execute-api.us-east-1.amazonaws.com/prod`;
    }
  } else {
    // 查询开发环境的API Gateway
    const result = execSync('aws apigateway get-rest-apis --query "items[?name==\'saas-quickstart-shared-dev\'].id" --output text', { encoding: 'utf8' });
    const apiId = result.trim();
    if (apiId) {
      apiGatewayUrl = `https://${apiId}.execute-api.us-east-1.amazonaws.com/dev`;
    }
  }

  if (!apiGatewayUrl) {
    console.error('Could not find API Gateway URL');
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