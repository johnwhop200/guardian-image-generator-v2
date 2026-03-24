const express = require('express');
const puppeteer = require('puppeteer-core');

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
    filter: saturate(0.4) contrast(1.05) brightness(0.9) sepia(0.3);
  }

  /* Golden duotone overlay — warm yellow dominant */
  .duotone-overlay {
    position: absolute;
    top: 0; left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      135deg,
      rgba(160, 100, 20, 0.70) 0%,
      rgba(190, 150, 30, 0.65) 30%,
      rgba(200, 170, 40, 0.60) 70%,
      rgba(210, 180, 50, 0.55) 100%
    );
    mix-blend-mode: multiply;
  }

  /* Golden screen overlay for warmth */
  .color-boost {
    position: absolute;
    top: 0; left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      180deg,
      rgba(200, 160, 40, 0.25) 0%,
      rgba(210, 180, 50, 0.20) 50%,
      rgba(180, 130, 30, 0.25) 100%
    );
    mix-blend-mode: screen;
  }

  /* Title banner — semi-transparent navy with subtle border */
  .title-banner {
    position: absolute;
    left: 40px;
    right: 40px;
    top: 50%;
    transform: translateY(-40%);
    background: rgba(26, 43, 80, 0.72);
    border: 1px solid rgba(255, 255, 255, 0.15);
    padding: 45px 55px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }

  .title-text {
    color: #ffffff;
    font-family: 'Oswald', 'Impact', 'Arial Narrow', sans-serif;
    font-weight: 700;
    font-size: ${titleFontSize}px;
    line-height: 1.25;
    text-transform: uppercase;
    text-align: left;
    letter-spacing: 3px;
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

// Test UI
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Guardian Image Generator V2 — Test</title>
<style>
  body { background:#1a1a1a; color:#fff; font-family:Arial,sans-serif; margin:30px; }
  h1 { font-size:20px; margin-bottom:20px; }
  label { display:block; font-size:13px; color:#aaa; margin:10px 0 4px; }
  input[type=text] { width:100%; max-width:700px; padding:10px; background:#222; color:#fff; border:1px solid #444; font-size:14px; }
  button { padding:12px 30px; background:#1a2b5e; color:#fff; border:none; font-size:15px; cursor:pointer; margin-top:15px; }
  button:hover { background:#2a3b7e; }
  button:disabled { opacity:0.5; cursor:wait; }
  #result { margin-top:25px; }
  #result img { max-width:600px; border:2px solid #333; }
  #status { color:#888; font-size:13px; margin-top:10px; }
  .download { display:inline-block; margin-top:10px; padding:8px 20px; background:#2a5a2a; color:#fff; text-decoration:none; font-size:13px; }
</style>
</head><body>
<h1>Guardian Image Generator V2 — Test</h1>
<label>Image URL</label>
<input type="text" id="imageUrl" placeholder="https://example.com/photo.jpg" />
<label>Title</label>
<input type="text" id="title" placeholder="BREAKING NEWS TITLE HERE" />
<br>
<button onclick="generate()">Generate</button>
<div id="status"></div>
<div id="result"></div>
<script>
async function generate() {
  const url = document.getElementById('imageUrl').value;
  const title = document.getElementById('title').value;
  if (!url || !title) return alert('Fill both fields');
  const btn = document.querySelector('button');
  btn.disabled = true;
  document.getElementById('status').textContent = 'Generating...';
  document.getElementById('result').innerHTML = '';
  try {
    const r = await fetch('/generate-base64', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({imageUrl: url, title: title})
    });
    const data = await r.json();
    if (data.success) {
      document.getElementById('result').innerHTML =
        '<img src="' + data.image + '" /><br>' +
        '<a class="download" href="' + data.image + '" download="guardian-image.png">Download PNG</a>';
      document.getElementById('status').textContent = 'Done!';
    } else {
      document.getElementById('status').textContent = 'Error: ' + (data.error || 'Unknown');
    }
  } catch(e) {
    document.getElementById('status').textContent = 'Error: ' + e.message;
  }
  btn.disabled = false;
}
</script>
</body></html>`);
});

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Guardian Image Generator V2 running on port ${PORT}`);
}).on('error', (err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (browser) await browser.close();
  process.exit(0);
});
