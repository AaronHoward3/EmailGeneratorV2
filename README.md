# SB Email Generator

A Node.js application that generates branded MJML email templates using OpenAI and dynamic block layouts. Supports custom hero image generation and flexible image hosting via AWS S3 or Supabase.

## Production Host
https://mjml-generator-service.springbot.com

## Architecture

The application is structured with clear separation of concerns:

- **Controllers**: Handle HTTP requests and responses
- **Services**: Business logic for email generation and image uploads
- **Routes**: API endpoint definitions
- **Utils**: Helper functions and utilities
- **Middleware**: Request processing and validation

## Environment Variables

### Required Variables

- `OPENAI_API_KEY`: Your OpenAI API key for email generation
- `BRANDDEV_API_KEY`: Your BrandDev API key for hero image generation

### Image Hosting (Choose One)

#### AWS S3 Configuration
- `S3_REGION`: AWS S3 region (e.g., us-east-1)
- `S3_ACCESS_KEY_ID`: AWS access key ID
- `S3_SECRET_ACCESS_KEY`: AWS secret access key
- `S3_BUCKET_NAME`: S3 bucket name for image storage

#### Supabase Configuration
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_KEY`: Supabase service role key

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd SBEmailGenerator
```

2. Install dependencies:
```bash
yarn install
```

3. Set up environment variables (see Environment Variables section above)

4. Start the development server:
```bash
yarn start
```

The server will start on port 3000.

## API Endpoints

### Generate Email
`POST /api/generate-emails`

Generates a branded email template based on the provided parameters.

**Request Body:**
```json
{
  "brandData": {
    "brandName": "Your Brand",
    "customHeroImage": true
  },
  "emailType": "newsletter",
  "userContext": "Your email content...",
  "storeId": "optional-store-id"
}
```

**Response:**
```json
{
  "success": true,
  "totalTokens": 30883,
  "emails": [
    {
      "index": 1,
      "content": "<mjml>...</mjml>",
      "tokens": 10294
    }
  ]
}
```

### Health Check
`GET /`

Returns a simple health check response.

## Deployment

### GitHub Actions + AWS App Runner

The application uses GitHub Actions for automated deployment to AWS App Runner, which supports long-running requests (5+ minutes) without timeout limitations.

#### Prerequisites

1. **AWS CLI installed and configured**:
   ```bash
   aws configure
   ```

2. **Run the setup script**:
   ```bash
   .\setup-apprunner.ps1
   ```

3. **Add GitHub Secrets**:
   Go to your GitHub repository → Settings → Secrets and variables → Actions, and add:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `OPENAI_API_KEY`
   - `BRANDDEV_API_KEY`
   - `S3_BUCKET_NAME`
   - `S3_REGION`
   - `S3_ACCESS_KEY_ID`
   - `S3_SECRET_ACCESS_KEY`
   - `SUPABASE_URL` (optional)
   - `SUPABASE_SERVICE_KEY` (optional)
   - `AUTO_SCALING_CONFIG_ARN` (provided by setup script)

#### Automated Deployment

1. **Push to main branch**: The GitHub Action will automatically:
   - Build the Docker image
   - Push to Amazon ECR
   - Deploy to App Runner
   - Test the deployment

2. **First deployment**: After the first successful deployment, add the service ARN as a GitHub secret:
   - `APP_RUNNER_SERVICE_ARN` (found in the GitHub Actions logs)

#### Benefits of App Runner

- ✅ **No timeout limitations** (supports 5+ minute requests)
- ✅ **Automatic scaling** based on demand
- ✅ **HTTPS and custom domains** included
- ✅ **Cost-effective** for long-running operations
- ✅ **Zero-downtime deployments**

### Manual Deployment Options

#### AWS App Runner (Manual)
1. Build Docker image: `docker build -t sbemailgenerator .`
2. Push to ECR: `aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com`
3. Create App Runner service in AWS Console

#### AWS Elastic Beanstalk
1. Run: `.\create-deployment.ps1`
2. Upload `deployment.zip` to Elastic Beanstalk Console
3. Configure environment variables

#### Local Development
```bash
yarn start
```

## Development

### Project Structure
```
src/
├── controllers/     # Request handlers
├── services/        # Business logic
├── routes/          # API endpoints
├── utils/           # Helper functions
├── config/          # Configuration
└── server.js        # Express server
```

### Adding New Email Types
1. Add assistant ID to `src/config/constants.js`
2. Create template blocks in `lib/`
3. Update layout generator if needed

## Troubleshooting

### Common Issues

1. **Environment Variables Not Loading**
   - Check variable names match exactly
   - Ensure no extra spaces or quotes

2. **S3 Upload Failures**
   - Verify bucket exists and is accessible
   - Check IAM permissions

3. **OpenAI API Errors**
   - Verify API key is valid
   - Check rate limits and quotas

### Support

For issues with:
- **Deployment**: Check GitHub Actions logs
- **API**: Check App Runner service logs
- **Local Development**: Check console output
