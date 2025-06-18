# AWS Lambda Deployment Guide

This guide covers deploying the SB Email Generator to AWS Lambda using the Serverless Framework.

## Prerequisites

1. **AWS CLI** installed and configured
2. **Node.js 18+** installed
3. **Serverless Framework** installed globally: `npm install -g serverless`
4. **AWS credentials** configured with appropriate permissions
5. **Route 53 hosted zone** for `springbot.com` domain

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# BrandDev Configuration
BRANDDEV_API_KEY=your_branddev_api_key

# AWS S3 Configuration (for image hosting)
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your_s3_access_key
S3_SECRET_ACCESS_KEY=your_s3_secret_key
S3_BUCKET_NAME=your_bucket_name

# Supabase Configuration (alternative to S3)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
```

## Deployment Steps

### 1. Install Dependencies

```bash
yarn install
```

### 2. Create Custom Domain (First Time Only)

```bash
serverless create_domain --stage production
```

This will:
- Create a custom domain: `mjml-generator-service.springbot.com`
- Provision SSL certificate
- Configure Route 53 DNS records

### 3. Deploy to Lambda

```bash
serverless deploy --stage production
```

This will:
- Package the application
- Create/update Lambda function
- Configure API Gateway
- Set up environment variables
- Deploy to production stage

### 4. Verify Deployment

```bash
serverless info --stage production
```

This will show:
- Lambda function ARN
- API Gateway endpoints
- Custom domain information

## GitHub Actions CI/CD

The repository includes automated deployment via GitHub Actions. To enable:

### 1. Add GitHub Secrets

Go to your repository Settings → Secrets and variables → Actions and add:

**AWS Credentials:**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

**Application Secrets:**
- `OPENAI_API_KEY`
- `BRANDDEV_API_KEY`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_BUCKET_NAME`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

### 2. Automated Deployment

Once secrets are configured:
- **Push to main branch** → Automatic deployment to Lambda
- **Pull requests** → Validation only (no deployment)
- **Health checks** → Automatic testing after deployment

## Configuration

### Serverless Configuration

The `serverless.yml` file configures:

- **Runtime**: Node.js 18.x
- **Memory**: 1024 MB (configurable)
- **Timeout**: 300 seconds (5 minutes)
- **Region**: us-east-1 (configurable)
- **CORS**: Enabled for all origins
- **IAM Permissions**: S3, CloudWatch, and Route 53 access
- **Custom Domain**: `mjml-generator-service.springbot.com`

### Lambda Handler

The application uses `serverless-express` to handle HTTP requests in Lambda:

```javascript
// handler.js
const serverless = require('serverless-http');
const app = require('./src/app');

module.exports.handler = serverless(app);
```

## Health Checks

The application includes health check endpoints:

- `GET /` - Root health check (returns service info)
- `GET /health` - Detailed health status

**Custom Domain Endpoints:**
- `https://mjml-generator-service.springbot.com/` - Health check
- `https://mjml-generator-service.springbot.com/api/generate-emails` - Email generation
- `https://mjml-generator-service.springbot.com/api/brand-info` - Brand info

## Troubleshooting

### Build Hangs at "Linking dependencies"
- Ensure all dependencies are in `package.json`
- Check for missing environment variables
- Verify `serverless.yml` configuration

### Environment Variables Not Working
- Ensure variables are set in Lambda console (not just locally)
- Variables starting with `AWS_` are reserved
- Redeploy after adding new environment variables

### Port Issues
- Lambda sets `PORT` environment variable automatically
- Application uses `process.env.PORT || 3000`

### Custom Domain Issues
- Ensure Route 53 hosted zone exists for `springbot.com`
- Check IAM permissions for Route 53 access
- Verify SSL certificate is provisioned (takes 5-10 minutes)

### AWS Credentials Error
- Ensure `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set in GitHub secrets
- Verify AWS credentials have appropriate permissions for Lambda, API Gateway, S3, and Route 53

## Rollback

To rollback to a previous deployment:

1. **Revert the commit** that caused issues
2. **Push to main** → Automatic redeployment
3. **Or manually redeploy**:
   ```bash
   serverless deploy --stage production
   ```

## Monitoring

### CloudWatch Logs

Lambda function logs are available in CloudWatch:
- Log Group: `/aws/lambda/sb-email-generator-production-api`
- Log Streams: Individual execution logs

### API Gateway Metrics

Monitor API usage in the AWS Console:
- API Gateway → APIs → sb-email-generator-production
- Metrics: Request count, latency, error rate

### Custom Domain Health

Test the custom domain:
```bash
curl https://mjml-generator-service.springbot.com/
```

## Cost Optimization

### Lambda Configuration

- **Memory**: 1024 MB (adjust based on usage)
- **Timeout**: 300 seconds (adjust based on email generation time)
- **Concurrency**: Unlimited (adjust if needed)

### S3 Storage

- **Lifecycle Policies**: Configure to delete old images
- **Storage Class**: Standard (adjust based on access patterns)

## Security

### IAM Permissions

The Lambda function has minimal required permissions:
- S3: PutObject, PutObjectAcl (for image uploads)
- CloudWatch: CreateLogGroup, CreateLogStream, PutLogEvents
- Route 53: GetHostedZone, ChangeResourceRecordSets, ListResourceRecordSets

### Environment Variables

- Sensitive data is stored as Lambda environment variables
- GitHub secrets are used for CI/CD
- No hardcoded credentials in the codebase

### API Security

- CORS is configured for cross-origin requests
- No authentication required (add if needed)
- Rate limiting can be added via API Gateway 