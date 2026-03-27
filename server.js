const express = require('express');
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;

// --- Logo loading (multi-project) ---
const logos = {};

function loadLogo(name, filePath) {
  if (fs.existsSync(filePath)) {
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    logos[name] = `data:${mime};base64,${buf.toString('base64')}`;
    console.log(`Logo '${name}' loaded from ${path.basename(filePath)}`);
  } else {
    console.log(`WARNING: Logo '${name}' not found at ${filePath}`);
  }
}

// Load from logos/ directory
loadLogo('guardian', path.join(__dirname, 'logos', 'guardian.png'));
loadLogo('tojo', path.join(__dirname, 'logos', 'tojo.jpg'));

// Fallback: legacy logo.png at root
if (!logos.guardian) {
  const legacyPath = path.join(__dirname, 'logo.png');
  if (fs.existsSync(legacyPath)) {
    loadLogo('guardian', legacyPath);
  } else {
    const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
      <rect width="200" height="80" fill="#1a2b5e" rx="3"/>
      <text x="100" y="28" text-anchor="middle" font-family="Georgia,serif" font-size="20" font-weight="bold" fill="white">The</text>
      <text x="100" y="50" text-anchor="middle" font-family="Georgia,serif" font-size="22" font-weight="bold" fill="white">Guardian</text>
      <text x="100" y="72" text-anchor="middle" font-family="Georgia,serif" font-size="22" font-weight="bold" fill="#e8c840">Africa</text>
    </svg>`;
    logos.guardian = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString('base64')}`;
    console.log('WARNING: No guardian logo found, using fallback SVG');
  }
}

// --- HTML Generators ---

// Guardian: full duotone + banner + title + logo
function generateHTMLGuardian(imageUrl, title, options) {
  const SIZE = 1080;
  const logo = (options && options.logoUrl) || logos.guardian;

  let titleFontSize = 52;
  if (title.length > 80) titleFontSize = 38;
  else if (title.length > 60) titleFontSize = 42;
  else if (title.length > 40) titleFontSize = 46;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }

  .container {
    width: ${SIZE}px;
    height: ${SIZE}px;
    position: relative;
    overflow: hidden;
    background: #14151c;
  }

  .bg-image {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    filter: contrast(1.32) brightness(0.88);
  }

  .gradmap-image {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    filter: contrast(1.32) brightness(0.88) url(#gradmap);
    opacity: 0.68;
    mix-blend-mode: color;
  }

  .tint {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: #c86030;
    mix-blend-mode: soft-light;
    opacity: 0.35;
  }

  .banner-wrap {
    position: absolute;
    left: 0; right: 0;
    top: 50%;
    transform: translateY(-50%);
    padding: 40px 60px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .banner-overlay {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: #2d3e5f;
    opacity: 0.72;
    mix-blend-mode: multiply;
  }
  .title-text {
    color: #ffffff;
    font-family: 'Oswald', 'Impact', 'Arial Narrow', sans-serif;
    font-weight: 700;
    font-size: ${titleFontSize}px;
    line-height: 1.2;
    text-transform: uppercase;
    text-align: center;
    letter-spacing: 2px;
    max-width: 900px;
    position: relative;
    z-index: 2;
  }

  .logo {
    position: absolute;
    bottom: 30px;
    right: 30px;
    width: 190px;
    height: auto;
  }
</style>
</head>
<body>
  <svg style="position:absolute;width:0;height:0">
    <filter id="gradmap" color-interpolation-filters="sRGB">
      <feColorMatrix type="saturate" values="0" result="gray"/>
      <feComponentTransfer in="gray">
        <feFuncR type="table" tableValues="0.165 0.294 0.894 0.765 0.894"/>
        <feFuncG type="table" tableValues="0.122 0.227 0.796 0.573 0.694"/>
        <feFuncB type="table" tableValues="0.267 0.369 0.145 0.176 0.165"/>
      </feComponentTransfer>
    </filter>
  </svg>

  <div class="container">
    <img class="bg-image" src="${imageUrl}" crossorigin="anonymous" />
    <img class="gradmap-image" src="${imageUrl}" crossorigin="anonymous" />
    <div class="tint"></div>
    <div class="banner-wrap">
      <div class="banner-overlay"></div>
      <div class="title-text">${title}</div>
    </div>
    <img class="logo" src="${logo}" />
  </div>
</body>
</html>`;
}

// Tojo: original image + logo overlay only (no filter, no title)
function generateHTMLTojo(imageUrl, options) {
  const SIZE = 1080;
  const logo = (options && options.logoUrl) || logos.tojo;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  .container {
    width: ${SIZE}px;
    height: ${SIZE}px;
    position: relative;
    overflow: hidden;
    background: #000;
  }

  .bg-image {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    object-fit: cover;
  }

  .logo {
    position: absolute;
    top: 830px;
    left: 30px;
    width: 115px;
    height: auto;
  }
</style>
</head>
<body>
  <div class="container">
    <img class="bg-image" src="${imageUrl}" crossorigin="anonymous" />
    <img class="logo" src="${logo}" />
  </div>
</body>
</html>`;
}

// Route to the right generator
function generateHTML(imageUrl, title, options) {
  const profile = (options && options.profile) || 'guardian';
  if (profile === 'tojo') {
    return generateHTMLTojo(imageUrl, options);
  }
  return generateHTMLGuardian(imageUrl, title, options);
}

// --- Browser ---

let browser = null;

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    const execPath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';
    console.log('Launching Chromium from:', execPath);
    browser = await puppeteer.launch({
      headless: true,
      executablePath: execPath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-translate'
      ]
    });
    console.log('Chromium launched successfully');
  }
  return browser;
}

// --- Routes ---

app.get('/', (req, res) => {
  res.json({
    service: 'image-generator',
    status: 'running',
    version: '3.0.0',
    profiles: Object.keys(logos),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'image-generator', profiles: Object.keys(logos) });
});

app.post('/generate', async (req, res) => {
  const { imageUrl, title, logoUrl, profile } = req.body;

  if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });
  if (!title && profile !== 'tojo') return res.status(400).json({ error: 'title is required (or use profile: "tojo")' });

  const SIZE = 1080;

  try {
    const b = await getBrowser();
    const page = await b.newPage();
    await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 });

    const html = generateHTML(imageUrl, title || '', { logoUrl, profile });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });

    await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const img = document.querySelector('.bg-image');
        if (img.complete) return resolve();
        img.onload = resolve;
        img.onerror = () => reject(new Error('Image failed to load'));
        setTimeout(resolve, 8000);
      });
    });

    await new Promise(r => setTimeout(r, 800));

    const screenshot = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: SIZE, height: SIZE }
    });

    await page.close();

    res.set('Content-Type', 'image/png');
    res.set('Content-Length', screenshot.length);
    res.send(screenshot);

  } catch (error) {
    console.error('Generation error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/generate-base64', async (req, res) => {
  const { imageUrl, title, logoUrl, profile } = req.body;

  if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });
  if (!title && profile !== 'tojo') return res.status(400).json({ error: 'title is required (or use profile: "tojo")' });

  const SIZE = 1080;

  try {
    const b = await getBrowser();
    const page = await b.newPage();
    await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 });

    const html = generateHTML(imageUrl, title || '', { logoUrl, profile });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });

    await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const img = document.querySelector('.bg-image');
        if (img.complete) return resolve();
        img.onload = resolve;
        img.onerror = () => reject(new Error('Image failed to load'));
        setTimeout(resolve, 8000);
      });
    });

    await new Promise(r => setTimeout(r, 800));

    const screenshot = await page.screenshot({
      type: 'png',
      encoding: 'base64',
      clip: { x: 0, y: 0, width: SIZE, height: SIZE }
    });

    await page.close();

    res.json({
      success: true,
      image: `data:image/png;base64,${screenshot}`,
      size: screenshot.length,
      profile: profile || 'guardian'
    });

  } catch (error) {
    console.error('Generation error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Image Generator V3.0.0 running on port ${PORT}`);
  console.log(`Profiles loaded: ${Object.keys(logos).join(', ')}`);
}).on('error', (err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  if (browser) await browser.close();
  process.exit(0);
});
