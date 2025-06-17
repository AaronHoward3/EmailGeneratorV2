import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

export async function uploadHeroImage(localFilePath, remoteFileName) {
  const fileBuffer = fs.readFileSync(localFilePath);

  // Create Supabase client only when needed
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY // use the service role key (NOT anon)
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
