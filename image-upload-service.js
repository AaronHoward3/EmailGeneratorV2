import { uploadHeroImage as uploadToS3 } from "./upload-to-s3.js";
import { uploadHeroImage as uploadToSupabase } from "./upload-to-supabase.js";

export async function uploadHeroImage(localFilePath, remoteFileName) {
  // Check for AWS S3 configuration
  if (
    process.env.AWS_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET_NAME
  ) {
    return uploadToS3(localFilePath, remoteFileName);
  }

  // Check for Supabase configuration
  if (
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_KEY
  ) {
    return uploadToSupabase(localFilePath, remoteFileName);
  }

  // If neither is configured, throw an error
  throw new Error(
    "No image upload service configured. Please set AWS S3 or Supabase environment variables."
  );
} 