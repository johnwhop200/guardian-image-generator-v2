const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;

// Logo SVG inline — "The Guardian" white + "Africa" yellow on navy background
const LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
  <rect width="200" height="80" fill="#1a2b5e" rx="3"/>
  <text x="100" y="28" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="20" font-weight="bold" fill="white">The</text>
  <text x="100" y="50" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="22" font-weight="bold" fill="white">Guardian</text>
  <text x="100" y="72" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="22" font-weight="bold" fill="#e8c840">Africa</text>
</svg>`;

const logoDataUri = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString('base64')}`;

function generateHTML(imageUrl, title) {
  const SIZE = 1080;

  // Auto-size title font based on title length
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
    background: #2a1a0a;
  }

  /* Background image — fills entire frame */
  .bg-image {
    position: absolute;
    top: 0; left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    /* Desaturate and warm up the image for duotone base */
    filter: saturate(0.3) contrast(1.1) brightness(0.85);
  }

  /* Warm duotone overlay — gradient from dark red to gold/yellow */
  .duotone-overlay {
    position: absolute;
    top: 0; left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      135deg,
      rgba(120, 20, 30, 0.75) 0%,
      rgba(140, 40, 20, 0.65) 30%,
      rgba(180, 130, 40, 0.60) 70%,
      rgba(200, 170, 50, 0.55) 100%
    );
    mix-blend-mode: multiply;
  }

  /* Second overlay for depth and richness */
  .color-boost {
    position: absolute;
    top: 0; left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      180deg,
      rgba(160, 80, 20, 0.25) 0%,
      rgba(180, 140, 40, 0.20) 50%,
      rgba(120, 30, 20, 0.30) 100%
    );
    mix-blend-mode: screen;
  }

  /* Title banner — semi-transparent dark blue, centered */
  .title-banner {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(26, 43, 80, 0.72);
    padding: 40px 60px;
    display: flex;
    align-items: center;
    justify-content: center;
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
  }

  /* Logo — bottom right corner */
  .logo {
    position: absolute;
    bottom: 30px;
    right: 30px;
    width: 160px;
    height: 64px;
  }
</style>
</head>
<body>
  <div class="container">
    <img class="bg-image" src="${imageUrl}" crossorigin="anonymous" />
    <div class="duotone-overlay"></div>
    <div class="color-boost"></div>
    <div class="title-banner">
      <div class="title-text">${title}</div>
    </div>
    <img class="logo" src="${logoDataUri}" />
  </div>
</body>
</html>`;
}

let browser = null;

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process'
      ]
    });
  }
  return browser;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'guardian-image-generator-v2' });
});

// Generate branded image
app.post('/generate', async (req, res) => {
  const { imageUrl, title } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ error: 'imageUrl is required' });
  }
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  const SIZE = 1080;

  try {
    const b = await getBrowser();
    const page = await b.newPage();

    await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 });

    const html = generateHTML(imageUrl, title);
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });

    // Wait for background image to load
    await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const img = document.querySelector('.bg-image');
        if (img.complete) return resolve();
        img.onload = resolve;
        img.onerror = () => reject(new Error('Image failed to load'));
        setTimeout(resolve, 8000);
      });
    });

    // Delay for font rendering + filters
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

// Generate and return as base64
app.post('/generate-base64', async (req, res) => {
  const { imageUrl, title } = req.body;

  if (!imageUrl || !title) {
    return res.status(400).json({ error: 'imageUrl and title are required' });
  }

  const SIZE = 1080;

  try {
    const b = await getBrowser();
    const page = await b.newPage();

    await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 });

    const html = generateHTML(imageUrl, title);
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
      size: screenshot.length
    });

  } catch (error) {
    console.error('Generation error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Guardian Image Generator V2 running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (browser) await browser.close();
  process.exit(0);
});
