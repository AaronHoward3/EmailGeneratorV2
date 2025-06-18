import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Choose upload method based on environment variables
function getUploadMethod() {
  // Debug: Log available environment variables (without sensitive values)
  console.log("🔍 Checking environment variables:");
  console.log("AWS_REGION:", process.env.AWS_REGION ? "SET" : "NOT SET");
  console.log("AWS_ACCESS_KEY_ID:", process.env.AWS_ACCESS_KEY_ID ? "SET" : "NOT SET");
  console.log("AWS_SECRET_ACCESS_KEY:", process.env.AWS_SECRET_ACCESS_KEY ? "SET" : "NOT SET");
  console.log("S3_BUCKET_NAME:", process.env.S3_BUCKET_NAME ? "SET" : "NOT SET");
  console.log("SUPABASE_URL:", process.env.SUPABASE_URL ? "SET" : "NOT SET");
  console.log("SUPABASE_SERVICE_KEY:", process.env.SUPABASE_SERVICE_KEY ? "SET" : "NOT SET");

  // Check if S3 is configured
  if (process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME) {
    console.log("✅ S3 configuration detected");
    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    return {
      type: 's3',
      client: s3Client,
      config: {
        Bucket: process.env.S3_BUCKET_NAME,
        region: process.env.AWS_REGION
      }
    };
  }
  
  // Check if Supabase is configured
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    console.log("✅ Supabase configuration detected");
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    return {
      type: 'supabase',
      client: supabase
    };
  }
  
  console.log("❌ No valid configuration found");
  throw new Error("Neither S3 nor Supabase is properly configured. Please set the required environment variables.");
}

export async function uploadImage(imageBuffer, filename, storeId) {
  const uploadMethod = getUploadMethod();
  
  if (uploadMethod.type === 's3') {
    return await uploadToS3(uploadMethod.client, uploadMethod.config, imageBuffer, filename, storeId);
  } else if (uploadMethod.type === 'supabase') {
    return await uploadToSupabase(uploadMethod.client, imageBuffer, filename, storeId);
  }
}

async function uploadToS3(s3Client, config, imageBuffer, filename, storeId) {
  const s3Key = `hero_images/${storeId}/${filename}`;
  
  const command = new PutObjectCommand({
    Bucket: config.Bucket,
    Key: s3Key,
    Body: imageBuffer,
    ContentType: 'image/png',
    CacheControl: 'public, max-age=31536000'
  });

  await s3Client.send(command);
  
  const publicUrl = `https://${config.Bucket}.s3.${config.region}.amazonaws.com/${s3Key}`;
  return publicUrl;
}

async function uploadToSupabase(supabase, imageBuffer, filename, storeId) {
  const filePath = `${storeId}/${filename}`;
  
  const { data, error } = await supabase.storage
    .from('image-hosting-braanddev')
    .upload(filePath, imageBuffer, {
      contentType: 'image/png',
      cacheControl: '31536000'
    });

  if (error) {
    throw new Error(`Failed to upload to Supabase: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('image-hosting-braanddev')
    .getPublicUrl(filePath);

  return publicUrl;
} 