import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

router.post("/brand-info", async (req, res) => {
  const { domain } = req.body;

  if (!domain) {
    return res.status(400).json({ error: "Missing domain" });
  }

  try {
    const response = await axios.get(
      `https://api.brand.dev/v1/brand/retrieve?domain=${domain}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.SB_BRANDDEV_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const brand = response.data.brand;

    const result = {
      name: brand.title,
      domain: brand.domain,
      description: brand.description,
      slogan: brand.slogan,
      logo: brand.logos?.[0]?.url || null,
      logos: (brand.logos || []).map(l => l.url).filter(Boolean),
      backdrops: (brand.backdrops || []).map(b => b.url).filter(Boolean),
      lifestyleImages: (brand.images || [])
        .filter(img => img.url && (img.type?.includes("lifestyle") || img.alt?.toLowerCase().includes("hero")))
        .map(img => img.url),
      productImages: (brand.images || [])
        .filter(img => img.url && (img.type?.includes("product") || img.alt?.toLowerCase().includes("product")))
        .map(img => img.url),
      colors: brand.colors || [],
      fonts: brand.fonts || [],
      socials: brand.socials || [],
      address: brand.address || {},
      phone: brand.phone || null,
      email: brand.email || null,
      tone: brand.description?.includes("mission") ? "purpose-driven" : "bold",
    };

    res.json(result);
  } catch (err) {
    console.error("Brand.dev API error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch brand info" });
  }
});

export default router; 