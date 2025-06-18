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

### `POST /generate-emails`
- **Body:** `{ brandData, emailType, userContext?, storeId? }`
  - `brandData` — Brand information and styling data
  - `emailType` — Type of email to generate (Newsletter, Productgrid, Promotion, AbandonedCart)
  - `userContext` — (Optional) Additional context for email generation
  - `storeId` — (Optional) Unique identifier for the store, used for organizing uploaded images
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
└── test-data/           # Sample payloads
```

---

## Development & Extensibility
- Add new email types or blocks by updating `src/config/constants.js` and the block directories.
- The codebase is modular and easy to extend for new features.

---

## License
MIT

