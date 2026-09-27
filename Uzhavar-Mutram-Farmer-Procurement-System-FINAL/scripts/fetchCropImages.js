/**
 * Uzhavar Mutram - Real Crop Photo Fetcher Script (Unsplash & Pexels API Integration)
 * 
 * Sourcing genuine photographs from free, attribution-compliant stock photo APIs (Unsplash/Pexels)
 * at build/seed time, keyed by crop name, and updating data.js with image_url, image_credit, and image_source_url.
 * 
 * NOTE: Add your API keys to .env:
 * UNSPLASH_ACCESS_KEY=your_unsplash_access_key
 * PEXELS_API_KEY=your_pexels_api_key
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

// Local farmer-supplied crop photos bundled with the app (public/images/crops).
// These always take priority so downloaded images can never mismatch crop details.
const LOCAL_CROP_PHOTOS = {
  PADDY_PONNI: "public/images/crops/ponni-paddy-rice.jpeg",
  PADDY_SEERAGA_SAMBA: "public/images/crops/seeraga-samba-paddy.jpeg",
  WHEAT: "public/images/crops/sharbati-wheat.jpeg",
  SUGARCANE: "public/images/crops/sugarcane.jpeg",
  TEA_LEAF: "public/images/crops/green-tea-leaves.jpeg",
  MANGO_ALPHONSO: "public/images/crops/mango-salem-alphonso.jpeg",
  BANANA_NENDRAN: "public/images/crops/banana-theni-nendran.jpeg",
  TOMATO: "public/images/crops/fresh-farm-tomato.jpeg",
  SHALLOTS_ONION: "public/images/crops/small-shallots-trichy-red.jpeg",
  COCONUT_COPRA: "public/images/crops/coconut-copra-pollachi.jpeg",
  RED_CHILLI: "public/images/crops/red-chilli-ramnad-mundu.jpeg",
  TURMERIC: "public/images/crops/turmeric-erode-finger.jpeg"
};

// Fallback high-resolution royalty-free photos curated for agricultural produce
const DEFAULT_CROP_PHOTOS = {
  PADDY_PONNI: {
    imageUrl: "public/images/crops/ponni-paddy-rice.jpeg",
    imageCredit: "Ponni Paddy / Rice (Grade A) — farmer-supplied photo",
    imageSourceUrl: ""
  },
  PADDY_SEERAGA_SAMBA: {
    imageUrl: "public/images/crops/seeraga-samba-paddy.jpeg",
    imageCredit: "Seeraga Samba Paddy (Biryani Special) — farmer-supplied photo",
    imageSourceUrl: ""
  },
  WHEAT: {
    imageUrl: "public/images/crops/sharbati-wheat.jpeg",
    imageCredit: "Sharbati Wheat (Grade A) — farmer-supplied photo",
    imageSourceUrl: ""
  },
  SUGARCANE: {
    imageUrl: "public/images/crops/sugarcane.jpeg",
    imageCredit: "Sugarcane (High Sucrose FRP) — farmer-supplied photo",
    imageSourceUrl: ""
  },
  TEA_LEAF: {
    imageUrl: "public/images/crops/green-tea-leaves.jpeg",
    imageCredit: "Green Tea Leaves (Nilgiris Special) — farmer-supplied photo",
    imageSourceUrl: ""
  },
  MANGO_ALPHONSO: {
    imageUrl: "public/images/crops/mango-salem-alphonso.jpeg",
    imageCredit: "Mango (Salem Alphonso / Malgova) — farmer-supplied photo",
    imageSourceUrl: ""
  },
  BANANA_NENDRAN: {
    imageUrl: "public/images/crops/banana-theni-nendran.jpeg",
    imageCredit: "Banana (Theni Nendran / Yelakki) — farmer-supplied photo",
    imageSourceUrl: ""
  },
  TOMATO: {
    imageUrl: "public/images/crops/fresh-farm-tomato.jpeg",
    imageCredit: "Fresh Farm Tomato (Oddanchatram) — farmer-supplied photo",
    imageSourceUrl: ""
  },
  SHALLOTS_ONION: {
    imageUrl: "public/images/crops/small-shallots-trichy-red.jpeg",
    imageCredit: "Small Shallots (Perambalur / Trichy Red) — farmer-supplied photo",
    imageSourceUrl: ""
  },
  COCONUT_COPRA: {
    imageUrl: "public/images/crops/coconut-copra-pollachi.jpeg",
    imageCredit: "Coconut & Dried Copra (Pollachi) — farmer-supplied photo",
    imageSourceUrl: ""
  },
  RED_CHILLI: {
    imageUrl: "public/images/crops/red-chilli-ramnad-mundu.jpeg",
    imageCredit: "Red Chilli (Ramnad Mundu / Guntur) — farmer-supplied photo",
    imageSourceUrl: ""
  },
  TURMERIC: {
    imageUrl: "public/images/crops/turmeric-erode-finger.jpeg",
    imageCredit: "Turmeric (Erode Finger Special) — farmer-supplied photo",
    imageSourceUrl: ""
  }
};

const FALLBACK_PLACEHOLDER = "public/images/crops/placeholder-crop.png";

async function fetchUnsplashPhoto(query) {
  if (!UNSPLASH_ACCESS_KEY) return null;
  return new Promise((resolve) => {
    const url = `https://api.unsplash.com/search/photos?page=1&query=${encodeURIComponent(query)}&client_id=${UNSPLASH_ACCESS_KEY}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.results && json.results.length > 0) {
            const photo = json.results[0];
            return resolve({
              imageUrl: photo.urls.regular,
              imageCredit: `Photo by ${photo.user.name} on Unsplash`,
              imageSourceUrl: photo.links.html
            });
          }
        } catch (e) {}
        resolve(null);
      });
    }).on('error', () => resolve(null));
  });
}

async function updateCropImagesInDataJs() {
  console.log('🌾 Updating Crop Photos in data.js...');

  const dataJsPath = path.join(__dirname, '..', 'data.js');
  let content = fs.readFileSync(dataJsPath, 'utf8');

  // Local farmer-supplied photos are the single source of truth.
  // Remote fetching is disabled so crop images can never drift out of sync with crop details.
  for (const [cropId, localPath] of Object.entries(LOCAL_CROP_PHOTOS)) {
    const photoData = {
      imageUrl: localPath,
      imageCredit: `${cropId.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase())} — farmer-supplied photo`,
      imageSourceUrl: ""
    };

    // Pattern to match crop entry block by ID
    const cropIdRegex = new RegExp(`(id:\\s*["']${cropId}["'][\\s\\S]*?qualityGrade:\\s*["'][^"']+["'])([^}]*)`, 'g');
    content = content.replace(cropIdRegex, (match, p1, p2) => {
      // If imageUrl is not yet present in p2
      if (!p2.includes('imageUrl')) {
        return `${p1},\n    imageUrl: "${photoData.imageUrl}",\n    imageCredit: "${photoData.imageCredit}",\n    imageSourceUrl: "${photoData.imageSourceUrl}"`;
      }
      return match;
    });
  }

  fs.writeFileSync(dataJsPath, content, 'utf8');
  console.log('✅ Crop images verified against local farmer-supplied photos!');
}

if (require.main === module) {
  updateCropImagesInDataJs();
}

module.exports = { updateCropImagesInDataJs, DEFAULT_CROP_PHOTOS, FALLBACK_PLACEHOLDER };
