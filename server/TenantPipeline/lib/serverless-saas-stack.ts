// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';

import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';

import { Function, Runtime, AssetCode } from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Duration } from 'aws-cdk-lib';


interface ServerlessSaaSStackProps extends cdk.StackProps {
  githubOwner: string;
  githubRepo: string;
  githubBranch?: string;
  githubTokenSecretName: string;
}

export class ServerlessSaaSStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ServerlessSaaSStackProps) {
    super(scope, id, props);

    console.log('Stack Props:', {
      githubOwner: props.githubOwner,
      githubRepo: props.githubRepo,
      githubBranch: props.githubBranch,
      githubTokenSecretName: props.githubTokenSecretName
    });

    const artifactsBucket = new s3.Bucket(this, "ArtifactsBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    //Since this lambda is invoking cloudformation which is inturn deploying AWS resources, we are giving overly permissive permissions to this lambda. 
    //You can limit this based upon your use case and AWS Resources you need to deploy.
    const lambdaPolicy = new PolicyStatement()
    lambdaPolicy.addActions("*")
    lambdaPolicy.addResources("*")

    const lambdaFunction = new Function(this, "deploy-tenant-stack", {
      handler: "lambda-deploy-tenant-stack.lambda_handler",
      runtime: Runtime.PYTHON_3_13,
      code: new AssetCode(`./resources`),
      memorySize: 512,
      timeout: Duration.seconds(10),
      environment: {
        BUCKET: artifactsBucket.bucketName,
      },
      initialPolicy: [lambdaPolicy],
    })

    // Pipeline creation starts
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'serverless-saas-pipeline',
      artifactBucket: artifactsBucket
    });

    // Import GitHub token from Secrets Manager


    const githubToken = secretsmanager.Secret.fromSecretAttributes(this, 'GitHubToken', {
      secretCompleteArn: `arn:aws:secretsmanager:us-east-1:390403879075:secret:github-aws-workshop-token3-V1daum`,
      // Alternatively, you can use secretName if you know the name and region  
    });
    
    console.log('githubToken:',  {
      secretName: githubToken.secretName,
      secretArn: githubToken.secretArn,
      secretValue: githubToken.secretValue.toString()
    }

    );

    // Declare source code as an artifact
    const sourceOutput = new codepipeline.Artifact();

    // Add source stage to pipeline
    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipeline_actions.GitHubSourceAction({
          actionName: 'GitHub_Source',
          owner: props.githubOwner,
          repo: props.githubRepo,
          branch: props.githubBranch,
          oauthToken: githubToken.secretValue,
          output: sourceOutput,
          variablesNamespace: 'SourceVariables'
        }),
      ],
    });

    // Declare build output as artifacts
    const buildOutput = new codepipeline.Artifact();



    //Declare a new CodeBuild project
    const buildProject = new codebuild.PipelineProject(this, 'Build', {
      buildSpec: codebuild.BuildSpec.fromSourceFilename("server/tenant-buildspec.yml"),
      environment: { buildImage: codebuild.LinuxBuildImage.STANDARD_7_0 },
      environmentVariables: {
        'PACKAGE_BUCKET': {
          value: artifactsBucket.bucketName
        }
      }
    });



    // Add the build stage to our pipeline
    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Build-Serverless-SaaS',
          project: buildProject,
          input: sourceOutput,
          outputs: [buildOutput],
        }),
      ],
    });

    const deployOutput = new codepipeline.Artifact();


    //Add the Lambda function that will deploy the tenant stack in a multitenant way
    pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        new codepipeline_actions.LambdaInvokeAction({
          actionName: 'DeployTenantStack',
          lambda: lambdaFunction,
          inputs: [buildOutput],
          outputs: [deployOutput],
          userParameters: {
            'artifact': 'Artifact_Build_Build-Serverless-SaaS',
            'template_file': 'packaged.yaml',
            'commit_id': '#{SourceVariables.CommitId}'
          }
        }),
      ],
    });
  }
}
