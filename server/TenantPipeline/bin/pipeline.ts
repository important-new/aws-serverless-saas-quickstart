#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ServerlessSaaSStack } from '../lib/serverless-saas-stack';

const app = new cdk.App();

// GitHub配置参数
const githubOwner = app.node.tryGetContext('githubOwner');
const githubRepo = app.node.tryGetContext('githubRepo');
const githubBranch = app.node.tryGetContext('githubBranch');
const githubTokenSecretName = app.node.tryGetContext('githubTokenSecretName');

console.log('Env Props:', {
     githubOwner,githubRepo,githubBranch,githubTokenSecretName
    });

new ServerlessSaaSStack(app, 'serverless-saas-pipeline', {
  githubOwner,
  githubRepo,
  githubBranch,
  githubTokenSecretName
});
