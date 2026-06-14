# Configuration Guide (Frontend Environment & Cognito)

[**English**](CONFIGURATION.md) ｜ [中文](zh-CN/CONFIGURATION.md)

[← Back to README](../README.md)

This repository **does not contain any real deployment identifiers**. The values in
the files below are all **placeholders** and must be replaced with your own
deployment's values before building/running.

> Note: The Cognito User Pool ID, App Client ID, API Gateway URL, and CloudFront
> Distribution ID all get bundled into the browser or into scripts, so they are
> **not secrets**; the purpose of using placeholders is simply to avoid binding
> this public repository to any specific AWS deployment.

## Placeholders to fill in

| Placeholder | Meaning | Where it appears |
|---|---|---|
| `us-east-1_XXXXXXXXX` | Cognito User Pool ID | `client/Admin/src/aws-exports.ts`, `client/Admin/script/auth-config.js` |
| `XXXXXXXXXXXXXXXXXXXXXXXXXX` | Cognito App Client ID | Same as above |
| `YOUR_API_ID` | REST API ID of the shared API Gateway | `src/environments/environment*.ts` in each app |
| `YOUR_CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution ID for each site | The `reset` script in each app's `package.json` |

## Option 1: Generate with a script (recommended, for environment.ts)

The repository already provides `scripts/generate-env-config.js`, which uses the
AWS CLI to query the shared API and generate the `environment.ts` for the
corresponding app:

```bash
# AWS CLI credentials and region must be configured first
node scripts/generate-env-config.js Admin prod
node scripts/generate-env-config.js Application prod
node scripts/generate-env-config.js Landing prod
```

## Option 2: Fill in manually

1. **Cognito** (`client/Admin/src/aws-exports.ts`): replace `us-east-1_XXXXXXXXX`
   and `XXXXXXXXXXXXXXXXXXXXXXXXXX` with your User Pool ID and App Client ID.
2. **API URL** (`client/*/src/environments/environment*.ts`): replace `YOUR_API_ID`
   with the REST API ID of the shared API Gateway.
3. **CloudFront** (the `reset` script in `client/*/package.json`): replace
   `YOUR_CLOUDFRONT_DISTRIBUTION_ID` with each site's distribution ID.

## ⚠️ Avoid committing real values again

After filling in real values, **do not commit them back to the repository**. We
recommend isolating them locally using one of the following approaches:

```bash
# Have git ignore your local changes to these files (without affecting others)
git update-index --skip-worktree \
  client/Admin/src/aws-exports.ts \
  client/Admin/src/environments/environment.ts \
  client/Admin/src/environments/environment.prod.ts \
  client/Application/src/environments/environment.ts \
  client/Application/src/environments/environment.prod.ts \
  client/Landing/src/environments/environment.ts \
  client/Landing/src/environments/environment.prod.ts
```

(To undo: `git update-index --no-skip-worktree <file>`)
