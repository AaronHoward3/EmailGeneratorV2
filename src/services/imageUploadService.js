import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

export async function uploadHeroImage(localFilePathOrBuffer, remoteFileName) {
  // Handle both file path and buffer inputs
  const fileBuffer = typeof localFilePathOrBuffer === 'string' 
    ? fs.readFileSync(localFilePathOrBuffer)
    : localFilePathOrBuffer;

  if (process.env.SB_S3_REGION && process.env.SB_S3_ACCESS_KEY_ID && process.env.SB_S3_SECRET_ACCESS_KEY && process.env.SB_S3_BUCKET_NAME) {
    // Use S3
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const s3Client = new S3Client({
      region: process.env.SB_S3_REGION,
      credentials: {
        accessKeyId: process.env.SB_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.SB_S3_SECRET_ACCESS_KEY
      }
    });

    const s3Key = `hero_images/${remoteFileName}`;
    const command = new PutObjectCommand({
      Bucket: process.env.SB_S3_BUCKET_NAME,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: "image/png"
    });

    try {
      await s3Client.send(command);
      const publicUrl = `https://${process.env.SB_S3_BUCKET_NAME}.s3.${process.env.SB_S3_REGION}.amazonaws.com/${s3Key}`;
      return publicUrl;
    } catch (error) {
      throw error;
    }
  } else if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    // Fallback to Supabase
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    const { data, error } = await supabase.storage
      .from("image-hosting-branddev")
      .upload(remoteFileName, fileBuffer, {
        cacheControl: "3600",
        upsert: true,
        contentType: "image/png",
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from("image-hosting-branddev")
      .getPublicUrl(remoteFileName);

    return publicUrlData.publicUrl;
  } else {
    // If neither is configured, throw an error
    throw new Error(
      "No image upload service configured. Please set AWS S3 or Supabase environment variables."
    );
  }
} 