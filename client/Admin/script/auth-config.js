module.exports = {
    // 认证配置
    auth: {
      // 预配置用户
      preConfiguredUser: {
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'CHANGE_ME'
      },
      
      // 认证方法优先级
      methods: ['api', 'ui'],
      
      // 跳过验证
      skipVerification: true,
      
      // 自动登录
      autoLogin: true
    },
    
    // AWS 配置
    aws: {
      region: 'us-east-1',
      userPoolId: 'us-east-1_XXXXXXXXX',
      userPoolWebClientId: process.env.USER_POOL_CLIENT_ID || 'XXXXXXXXXXXXXXXXXXXXXXXXXX'
    }
  };