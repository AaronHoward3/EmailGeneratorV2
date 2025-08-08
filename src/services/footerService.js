import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const socialPlatforms = [
  {
    templateKey: 'facebook_url',
    dataKey: 'facebook',
    name: 'facebook-noshare',
    icon: 'https://springbot-assets.s3.amazonaws.com/images/social_media_white_icons_72x72/facebook.png',
    bg: '#3B5998',
  },
  {
    templateKey: 'instagram_url',
    dataKey: 'instagram',
    name: 'instagram',
    icon: 'https://springbot-assets.s3.amazonaws.com/images/social_media_white_icons_72x72/instagram.png',
    bg: '#3F729B',
  },
  {
    templateKey: 'linkedin_url',
    dataKey: 'linkedin',
    name: 'linkedin-noshare',
    icon: 'https://springbot-assets.s3.amazonaws.com/images/social_media_white_icons_72x72/linkedin.png',
    bg: '#0077B5',
  },
  {
    templateKey: 'pinterest_url',
    dataKey: 'pinterest',
    name: 'pinterest-noshare',
    icon: 'https://springbot-assets.s3.amazonaws.com/images/social_media_white_icons_72x72/pinterest.png',
    bg: '#BD081C',
  },
  {
    templateKey: 'twitter_url',
    dataKey: 'twitter',
    name: 'twitter-noshare',
    icon: 'https://springbot-assets.s3.amazonaws.com/images/social_media_white_icons_72x72/twitter.png',
    bg: '#55ACEE',
  },
  {
    templateKey: 'youtube_url',
    dataKey: 'youtube',
    name: 'youtube',
    icon: 'https://springbot-assets.s3.amazonaws.com/images/social_media_white_icons_72x72/youtube.png',
    bg: '#c4302b',
  },
];

function cleanSocialUrls(brandData) {
  socialPlatforms.forEach(({ templateKey, dataKey }) => {
    let url = brandData[templateKey];
    if (!url && brandData.social_links && brandData.social_links[dataKey]) {
      url = brandData.social_links[dataKey];
    }
    if (!url || url.trim() === '' ||
      url === `https://${dataKey}.com/` ||
      url === `https://www.${dataKey}.com/` ||
      url === `http://${dataKey}.com/` ||
      url === `http://www.${dataKey}.com/`) {
      brandData[templateKey] = null;
    } else {
      brandData[templateKey] = url;
    }
  });
  return brandData;
}

function buildSocialElements(brandData) {
  let socialElements = '';
  socialPlatforms.forEach(({ templateKey, name, icon, bg }) => {
    const url = brandData[templateKey];
    if (url) {
      socialElements += `<mj-social-element name="${name}" href="${url}" src="${icon}" background-color="${bg}"></mj-social-element>\n`;
    }
  });
  return socialElements.trim();
}

function replaceBasicPlaceholders(footerTemplate, brandData) {
  return footerTemplate
    .replace(/\[\[logo_url\]\]/g, brandData.logo_url || '')
    .replace(/\[\[body_color\]\]/g, brandData.body_color || '#FFFFFF')
    .replace(/\[\[text_color\]\]/g, brandData.text_color || '#4A4A4A')
    .replace(/\[\[store_url\]\]/g, brandData.store_url || '')
}

function injectSocialElements(processedFooter, socialElements) {
  return processedFooter.replace(
    /<mj-social[^>]*>[^<]*<!-- Social elements will be injected here dynamically -->[^<]*<\/mj-social>/,
    match => match.replace(/<!-- Social elements will be injected here dynamically -->/, socialElements)
  );
}

export async function processFooterTemplate(brandData) {
  try {
    const footerPath = path.join(__dirname, '../../lib/design-elements/footer.txt');
    const footerTemplate = await fs.readFile(footerPath, 'utf8');
    const cleanedBrandData = cleanSocialUrls({ ...brandData });
    let processedFooter = replaceBasicPlaceholders(footerTemplate, cleanedBrandData);
    const socialElements = buildSocialElements(cleanedBrandData);
    processedFooter = injectSocialElements(processedFooter, socialElements);
    return processedFooter;
  } catch (error) {
    console.error('Error processing footer template:', error);
    return '';
  }
} 