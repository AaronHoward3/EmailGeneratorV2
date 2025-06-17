import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

export async function uploadHeroImage(localFilePath, remoteFileName) {
  const fileBuffer = fs.readFileSync(localFilePath);

  if (process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME) {
    // Use S3
    const s3Key = `hero_images/${remoteFileName}`;
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: "image/png",
      ACL: "public-read"
    });

    try {
      await s3Client.send(command);
      const publicUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
      return publicUrl;
    } catch (error) {
      throw error;
    }
  } else {
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
  }
}
