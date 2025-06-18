# SBEmailGenerator

A Node.js application for generating branded MJML email templates using OpenAI and dynamic block layouts. Supports custom hero image generation and flexible image hosting (AWS S3 or Supabase).

---

## Features
- Generate MJML emails for different campaign types (Newsletter, Product Grid, Promotion, Abandoned Cart)
- Uses OpenAI assistants for content and image generation
- Fetches brand info from Brand.dev API
- Supports custom hero image generation and upload
- Image hosting via AWS S3 or Supabase (configurable)
- Extensible block template system
- **AWS Lambda deployment ready**
- **Automatic CI/CD with GitHub Actions**
- **Custom domain support** (`mjml-generator-service.springbot.com`)

---

## Setup

### 1. Clone the repository
```sh
git clone <your-repo-url>
cd SBEmailGenerator
```

### 2. Install dependencies
```sh
yarn install
```

### 3. Configure environment variables
Copy `.env.example` to `.env` and fill in the required values:
```sh
cp .env.example .env
```

#### Required Environment Variables

- `OPENAI_API_KEY` — Your OpenAI API key
- `BRANDDEV_API_KEY` — Brand.dev API key
- `PORT` — (Optional) Port for the server (default: 3000)

#### Image Hosting (choose one):

**AWS S3 (preferred):**
- `SB_S3_REGION`
- `SB_S3_ACCESS_KEY_ID`
- `SB_S3_SECRET_ACCESS_KEY`
- `SB_S3_BUCKET_NAME`

**Supabase (fallback):**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

If neither is configured, image upload will fail with an error.

---

## Running the Server

```sh
yarn start
```

The server will start on the port specified in your `.env` file (default: 3000).

---

## Deployment

### Automatic Deployment (Recommended)

This repository is configured for **automatic deployment to AWS Lambda** on every push to the `main` branch using GitHub Actions.

#### Prerequisites for Auto-Deployment:
1. **AWS credentials** added as GitHub secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

2. **Application secrets** added as GitHub secrets:
   - `OPENAI_API_KEY`
   - `BRANDDEV_API_KEY`
   - `SB_S3_REGION`
   - `SB_S3_ACCESS_KEY_ID`
   - `SB_S3_SECRET_ACCESS_KEY`
   - `SB_S3_BUCKET_NAME`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`

#### How Auto-Deployment Works:
- **Push to main** → Automatic deployment to Lambda
- **Pull requests** → Validation only (no deployment)
- **Health checks** → Automatic testing after deployment
- **Rollback** → Revert commit to rollback deployment
- **Custom domain** → Automatically configured and tested

#### Deployment Stages:
- **Development**: `yarn deploy` (manual)
- **Production**: Automatic on push to main

#### Custom Domain:
- **Domain**: `https://mjml-generator-service.springbot.com`
- **SSL**: Automatically provisioned by AWS
- **DNS**: Automatically configured via Route 53
- **Health Check**: Automatically tested after deployment

### Manual Deployment

#### AWS Lambda Deployment

This application is configured for deployment on AWS Lambda using the Serverless Framework.

##### Prerequisites
1. **AWS CLI** installed and configured
2. **Node.js 18+** installed
3. **Serverless Framework** installed globally: `npm install -g serverless`
4. **AWS credentials** configured with appropriate permissions
5. **Route 53 hosted zone** for `springbot.com` domain

##### Deployment Steps

1. **Install Dependencies**
   ```bash
   yarn install
   ```

2. **Create Custom Domain** (first time only)
   ```bash
   yarn create-domain
   ```

3. **Deploy to Lambda**
   ```bash
   yarn deploy
   ```

4. **Deploy to Production**
   ```bash
   yarn deploy:prod
   ```

##### Configuration

The `serverless.yml` file configures:
- **Runtime**: Node.js 18.x
- **Memory**: 1024 MB (configurable)
- **Timeout**: 300 seconds (5 minutes)
- **Region**: us-east-1 (configurable)
- **CORS**: Enabled for all origins
- **IAM Permissions**: S3, CloudWatch, and Route 53 access
- **Custom Domain**: `mjml-generator-service.springbot.com`

##### Health Checks

The application includes health check endpoints:
- `GET /` - Root health check (returns service info)
- `GET /health` - Detailed health status

**Custom Domain Endpoints:**
- `https://mjml-generator-service.springbot.com/` - Health check
- `https://mjml-generator-service.springbot.com/api/generate-emails` - Email generation
- `https://mjml-generator-service.springbot.com/api/brand-info` - Brand info

##### Troubleshooting Deployment

**Build Hangs at "Linking dependencies"**
- Ensure all dependencies are in `package.json`
- Check for missing environment variables
- Verify `serverless.yml` configuration

**Environment Variables Not Working**
- Ensure variables are set in Lambda console (not just locally)
- Variables starting with `AWS_` are reserved - use `SB_` prefix instead
- Redeploy after adding new environment variables

**Port Issues**
- Lambda sets `PORT` environment variable automatically
- Application uses `process.env.PORT || 3000`

**Custom Domain Issues**
- Ensure Route 53 hosted zone exists for `springbot.com`
- Check IAM permissions for Route 53 access
- Verify SSL certificate is provisioned (takes 5-10 minutes)

---

## Testing Email Generation

1. Start the server:
   ```sh
   yarn start
   ```
2. In a separate terminal, run the test request:
   ```sh
   yarn test
   ```
   or
   ```sh
   node scripts/test-request.js
   ```
   This will POST a sample payload (from `test-data/patagonia-payload.json`) to the `/generate-emails` endpoint.

---

## Endpoints

### `POST /api/generate-emails`
- **Body:** `{ brandData, emailType, userContext?, storeId? }`
  - `brandData` — Brand information and styling data
  - `emailType` — Type of email to generate (Newsletter, Productgrid, Promotion, AbandonedCart)
  - `userContext` — (Optional) Additional context for email generation
  - `storeId` — (Optional) Unique identifier for the store, used for organizing uploaded images
- **Response:** JSON with generated MJML emails and token usage

### `POST /api/brand-info`
- **Body:** `{ domain }`
- **Response:** Brand info from Brand.dev

### `GET /`
- **Response:** Service health check and version info

### `GET /health`
- **Response:** Detailed health status with request metrics

**Custom Domain URLs:**
- `https://mjml-generator-service.springbot.com/api/generate-emails`
- `https://mjml-generator-service.springbot.com/api/brand-info`
- `https://mjml-generator-service.springbot.com/`

---

## Image Upload Logic
- The app uses an abstraction layer for image uploads.
- If AWS S3 environment variables are set, images are uploaded to S3.
- If not, but Supabase variables are set, images are uploaded to Supabase.
- If neither is configured, an error is thrown.
- Custom hero images are organized by `storeId` in the upload directory structure.

---

## Block Templates
- Email layouts are composed from block templates in the `lib/` directory.
- Templates are organized by email type:
  - `lib/newsletter-blocks/` — Newsletter email templates
  - `lib/product-blocks/` — Product grid email templates  
  - `lib/abandoned-blocks/` — Abandoned cart email templates
- Each directory contains numbered block folders (block1, block2, block3) and design elements.
- You can add or modify block templates to customize email layouts.

---

## Project Structure
```
SBEmailGenerator/
├── src/
│   ├── config/          # Configuration constants
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   ├── routes/          # API routes
│   ├── app.js           # Express app setup
│   └── server.js        # Server startup
├── lib/                 # Block templates
│   ├── newsletter-blocks/
│   ├── product-blocks/
│   └── abandoned-blocks/
├── scripts/             # Utility and test scripts
├── test-data/           # Sample payloads
├── .github/workflows/   # GitHub Actions CI/CD
├── serverless.yml       # AWS Lambda configuration
├── handler.js           # Lambda entry point
└── package.json         # Dependencies and scripts
```

---

## Development & Extensibility
- Add new email types or blocks by updating `src/config/constants.js` and the block directories.
- The codebase is modular and easy to extend for new features.
- Template caching is available in a separate branch for performance optimization.

---

## License
MIT

