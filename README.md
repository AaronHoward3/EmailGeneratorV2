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
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `S3_BUCKET_NAME`

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

## Testing Email Generation

1. Start the server:
   ```sh
   yarn start
   ```
2. In a separate terminal, run the test request:
   ```sh
   node test-request.js
   ```
   This will POST a sample payload (from `patagonia-payload.json`) to the `/generate-emails` endpoint.

---

## Endpoints

### `POST /generate-emails`
- **Body:** `{ brandData, emailType, userContext? }`
- **Response:** JSON with generated MJML emails and token usage

### `POST /api/brand-info`
- **Body:** `{ domain }`
- **Response:** Brand info from Brand.dev

---

## Image Upload Logic
- The app uses an abstraction layer for image uploads.
- If AWS S3 environment variables are set, images are uploaded to S3.
- If not, but Supabase variables are set, images are uploaded to Supabase.
- If neither is configured, an error is thrown.

---

## Block Templates
- Email layouts are composed from block templates in the `Newsletterblocks/`, `Productblocks/`, and `AbandonedBlocks/` directories.
- You can add or modify block templates to customize email layouts.

---

## Development & Extensibility
- Add new email types or blocks by updating `server.js` and the block directories.
- The codebase is modular and easy to extend for new features.

