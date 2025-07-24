import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Choose upload method based on environment variables
function getUploadMethod() {
  // Get S3 configuration (check both AWS_ and S3_ prefixes)
  const region = process.env.AWS_REGION || process.env.S3_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;
  const bucketName = process.env.S3_BUCKET_NAME;

  // Check if S3 is configured
  if (region && accessKeyId && secretAccessKey && bucketName) {

    const s3Client = new S3Client({
      region: region,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey
      }
    });

    return {
      type: 's3',
      client: s3Client,
      config: {
        Bucket: bucketName,
        region: region
      }
    };
  }
  
  // Check if Supabase is configured
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    return {
      type: 'supabase',
      client: supabase
    };
  }
  
  
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
