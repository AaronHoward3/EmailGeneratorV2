# Lambda Deployment Guide

This guide explains how to deploy the SBEmailGenerator API to AWS Lambda using the Serverless Framework.

## Prerequisites

1. **AWS CLI** installed and configured
2. **Node.js 18+** installed
3. **Serverless Framework** installed globally: `npm install -g serverless`
4. **AWS credentials** configured with appropriate permissions

## Setup

### 1. Install Dependencies
```bash
yarn install
```

### 2. Configure Environment Variables
Create a `.env` file with your AWS and API credentials:
```bash
# Required
OPENAI_API_KEY=your_openai_key
BRANDDEV_API_KEY=your_branddev_key

# S3 Configuration (preferred)
SB_S3_REGION=us-east-1
SB_S3_ACCESS_KEY_ID=your_s3_access_key
SB_S3_SECRET_ACCESS_KEY=your_s3_secret_key
SB_S3_BUCKET_NAME=your_bucket_name

# Supabase Configuration (fallback)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_key
```

### 3. Deploy to Lambda

#### Development Deployment
```bash
yarn deploy
```

#### Production Deployment
```bash
yarn deploy:prod
```

#### Deploy to Specific Region
```bash
serverless deploy --region us-west-2
```

## Configuration

### Lambda Settings
- **Runtime**: Node.js 18.x
- **Memory**: 1024 MB (configurable)
- **Timeout**: 300 seconds (5 minutes)
- **Region**: us-east-1 (configurable)

### API Gateway
- **CORS**: Enabled for all origins
- **Methods**: All HTTP methods supported
- **Integration**: Lambda proxy integration

### IAM Permissions
The Lambda function has permissions for:
- S3 PutObject and PutObjectAcl (for image uploads)
- CloudWatch Logs (for logging)

## Deployment Output

After successful deployment, you'll see:
```
endpoints:
  GET - https://xxxxx.execute-api.us-east-1.amazonaws.com/dev/
  ANY - https://xxxxx.execute-api.us-east-1.amazonaws.com/dev/{proxy+}
```

## Testing

### Health Check
```bash
curl https://your-api-gateway-url/dev/
```

### Email Generation
```bash
curl -X POST https://your-api-gateway-url/dev/api/generate-emails \
  -H "Content-Type: application/json" \
  -d @test-data/patagonia-payload.json
```

## Monitoring

### CloudWatch Logs
- Log group: `/aws/lambda/sb-email-generator-dev-api`
- Log streams: One per Lambda invocation

### Metrics
- Invocation count
- Duration
- Error rate
- Throttles

## Cost Optimization

### Lambda Pricing
- **Requests**: $0.20 per 1M requests
- **Duration**: $0.0000166667 per GB-second
- **Memory**: 1024 MB = $0.0000166667 per second

### Estimated Costs
- **1000 requests/month**: ~$0.20
- **Average duration**: 30 seconds
- **Monthly cost**: ~$15-20 for moderate usage

## Troubleshooting

### Common Issues

#### Cold Start Delays
- **Symptom**: First request takes 2-5 seconds
- **Solution**: Use provisioned concurrency for production

#### Timeout Errors
- **Symptom**: 504 Gateway Timeout
- **Solution**: Increase timeout in serverless.yml

#### Memory Issues
- **Symptom**: Out of memory errors
- **Solution**: Increase memorySize in serverless.yml

#### CORS Errors
- **Symptom**: Browser CORS policy violations
- **Solution**: CORS is already configured in serverless.yml

### Debugging

#### View Logs
```bash
serverless logs -f api -t
```

#### Invoke Function Locally
```bash
serverless invoke local -f api -p test-data/patagonia-payload.json
```

## Cleanup

To remove the deployment:
```bash
yarn remove
```

This will delete:
- Lambda function
- API Gateway
- IAM roles
- CloudWatch log groups
- S3 deployment bucket (if empty)

## Environment Variables

All environment variables are automatically passed to the Lambda function. You can override them per stage:

```bash
serverless deploy --stage production --env OPENAI_API_KEY=prod_key
```

## Security

### Best Practices
1. Use IAM roles with minimal permissions
2. Store secrets in AWS Secrets Manager
3. Enable CloudTrail for audit logging
4. Use VPC for additional network security

### Secrets Management
For production, consider using AWS Secrets Manager:
```yaml
# serverless.yml
provider:
  environment:
    OPENAI_API_KEY: ${ssm:/sb-email-generator/${self:provider.stage}/openai-api-key}
``` 