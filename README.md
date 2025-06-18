# SB Email Generator

A Node.js application that generates branded MJML email templates using OpenAI and dynamic block layouts. Supports custom hero image generation and flexible image hosting via AWS S3 or Supabase.

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
`POST /api/generate-email`

Generates a branded email template based on the provided parameters.

**Request Body:**
```json
{
  "brandName": "Your Brand",
  "emailType": "newsletter",
  "content": "Your email content...",
  "heroImagePrompt": "Optional hero image description",
  "imageHosting": "s3" // or "supabase"
}
```

**Response:**
```json
{
  "mjml": "<mjml>...</mjml>",
  "html": "<html>...</html>",
  "heroImageUrl": "https://..."
}
```

### Health Check
`GET /`

Returns a simple health check response.

## Deployment

### AWS Lambda Deployment

The application is configured for AWS Lambda deployment using the Serverless Framework.

#### Prerequisites

1. Install Serverless Framework:
```bash
npm install -g serverless
```

2. Configure AWS credentials:
```bash
aws configure
```

3. Set up GitHub secrets for CI/CD:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `OPENAI_API_KEY`
   - `BRANDDEV_API_KEY`
   - `S3_REGION`
   - `S3_ACCESS_KEY_ID`
   - `S3_SECRET_ACCESS_KEY`
   - `S3_BUCKET_NAME`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`

#### Manual Deployment

1. Deploy to production:
```bash
serverless deploy --stage production
```

2. Create custom domain:
```bash
serverless create_domain --stage production
```

#### Automated Deployment

The application uses GitHub Actions for automated deployment. On every push to the `main` branch:

1. Code is checked out and dependencies installed
2. AWS credentials are configured
3. Custom domain is created/updated
4. Lambda function is deployed
5. Deployment is tested
