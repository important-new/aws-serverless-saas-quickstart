const awsmobile = {
  aws_project_region: 'us-east-1',
  aws_cognito_region: 'us-east-1',
  aws_user_pools_id: 'us-east-1_XXXXXXXXX',
  aws_user_pools_web_client_id: 'XXXXXXXXXXXXXXXXXXXXXXXXXX',

  // 禁用认证
  auth: {
    mandatorySignIn: false,
    signUpVerificationMethod: 'none',
    userPoolId: 'us-east-1_XXXXXXXXX',
    userPoolWebClientId: 'XXXXXXXXXXXXXXXXXXXXXXXXXX',
    region: 'us-east-1',
    
    // 跳过认证
    authenticationFlowType: 'USER_SRP_AUTH',
    allowGuestAccess: true
  }

};

export default awsmobile;