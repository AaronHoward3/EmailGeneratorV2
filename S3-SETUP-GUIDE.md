# S3 Bucket Setup Guide for Public Image Hosting

## Overview
This guide shows how to configure an S3 bucket to host public images without using ACLs (which are deprecated for new buckets).

## Step 1: Create S3 Bucket

1. Go to AWS S3 Console
2. Click "Create bucket"
3. Choose a unique bucket name
4. Select your preferred region
5. **IMPORTANT**: Uncheck "Block all public access" (we need public read access)
6. Enable versioning if desired
7. Click "Create bucket"

## Step 2: Configure Bucket Policy

1. Go to your bucket → **Permissions** tab
2. Click **Bucket policy**
3. Replace the policy with the content from `s3-bucket-policy.json`
4. **Replace `YOUR-BUCKET-NAME`** with your actual bucket name
5. Click **Save changes**

## Step 3: Configure CORS (if needed for web access)

If you're accessing images from web browsers, add this CORS configuration:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

## Step 4: Update Environment Variables

Add these to your `.env` file:

```env
AWS_REGION=your-region
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=your-bucket-name
```

## Step 5: Test the Setup

The code has been updated to work without ACLs. Your images will be:
- Uploaded to `s3://your-bucket/hero_images/filename.png`
- Publicly accessible at `https://your-bucket.s3.your-region.amazonaws.com/hero_images/filename.png`

## Security Benefits of This Approach

✅ **Granular Control**: Only specific paths are public
✅ **Audit Trail**: All permissions in one policy
✅ **Future-Proof**: Uses modern AWS best practices
✅ **Compliance**: Easier to document and review

## Troubleshooting

### "Access Denied" Errors
- Check bucket policy syntax
- Verify bucket name in policy matches exactly
- Ensure "Block all public access" is disabled

### Images Not Loading
- Verify the URL format matches your region
- Check CORS settings if accessing from web browsers
- Ensure the `hero_images/` folder path is correct

## Alternative: Use Supabase (Already Configured)

If S3 setup is complex, you can use Supabase instead:

```env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-key
```

The app will automatically fall back to Supabase if S3 isn't configured. 