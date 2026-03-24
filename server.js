const express = require('express');
const puppeteer = require('puppeteer-core');

const app = express();
app.use(express.json({ limit: '30mb' }));

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

// Canva "Moutarde" = Gradient Map (shadows #2c2f4a → highlights #f2c14e)
// Implemented as: desaturate + gradient overlay in soft-light mode
const DEFAULTS = {
  desaturate: 40, contrast: 140, brightness: 90,
  gradientOpacity: 70, grain: 12,
  bannerAlpha: 0.42,
  logoWidth: 200, logoHeight: 80, logoBottom: 25, logoRight: 25
};

function generateHTML(imageUrl, title, filters) {
  const f = Object.assign({}, DEFAULTS, filters || {});
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
    background: #1a1000;
  }

  /* Base image: desaturate + contrast boost */
  .bg-image {
    position: absolute;
    top: 0; left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: saturate(${(100 - f.desaturate) / 100}) contrast(${f.contrast / 100}) brightness(${f.brightness / 100});
  }

  /* Gradient Map: shadows #2c2f4a (blue/violet) → highlights #f2c14e (yellow) */
  .gradient-map {
    position: absolute;
    top: 0; left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      180deg,
      #f2c14e 0%,
      #c49a30 35%,
      #5a4a3a 65%,
      #2c2f4a 100%
    );
    mix-blend-mode: overlay;
    opacity: ${f.gradientOpacity / 100};
  }

  /* Subtle grain texture */
  .grain {
    position: absolute;
    top: 0; left: 0;
    width: 100%;
    height: 100%;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
    opacity: ${f.grain / 100};
    mix-blend-mode: overlay;
  }

  /* Title banner — blue, 42% transparency */
  .title-banner {
    position: absolute;
    left: 40px;
    right: 40px;
    top: 50%;
    transform: translateY(-40%);
    background: rgba(26, 43, 94, ${f.bannerAlpha});
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

  /* Logo — bottom right */
  .logo {
    position: absolute;
    bottom: ${f.logoBottom}px;
    right: ${f.logoRight}px;
    width: ${f.logoWidth}px;
    height: ${f.logoHeight}px;
  }
</style>
</head>
<body>
  <div class="container">
    <img class="bg-image" src="${imageUrl}" crossorigin="anonymous" />
    <div class="gradient-map"></div>
    <div class="grain"></div>
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

// Test UI with colorimetry sliders
app.get('/', (req, res) => {
  const d = DEFAULTS;
  res.send(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Guardian V2 — Test & Calibration</title>
<style>
  body{background:#1a1a1a;color:#fff;font-family:Arial,sans-serif;margin:20px;font-size:13px}
  h1{font-size:18px;margin-bottom:15px}
  h2{font-size:13px;color:#e8c840;margin:15px 0 8px;border-bottom:1px solid #333;padding-bottom:4px}
  .top{display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap;align-items:center}
  .top input[type=text]{flex:1;min-width:200px;padding:8px;background:#222;color:#fff;border:1px solid #444}
  .top input[type=file]{font-size:12px}
  .or{color:#666;font-size:11px}
  button{padding:10px 25px;background:#1a2b5e;color:#fff;border:none;cursor:pointer;font-size:14px}
  button:hover{background:#2a3b7e}
  button:disabled{opacity:0.5}
  .main{display:flex;gap:20px}
  .controls{width:320px;flex-shrink:0}
  .result{flex:1}
  .result img{max-width:100%;border:2px solid #333}
  .row{display:flex;align-items:center;gap:6px;margin:3px 0}
  .row label{width:100px;font-size:11px;color:#aaa}
  .row input[type=range]{flex:1;height:16px}
  .row .v{width:45px;font-size:11px;text-align:right;font-family:monospace;color:#0f0}
  #status{color:#888;margin:8px 0}
  .dl{display:inline-block;margin-top:8px;padding:6px 16px;background:#2a5a2a;color:#fff;text-decoration:none;font-size:12px}
  .preset{display:inline-block;padding:4px 10px;background:#333;color:#fff;border:none;cursor:pointer;font-size:11px;margin:2px}
  .preset:hover{background:#555}
</style>
</head><body>
<h1>Guardian Image Generator V2 — Test & Calibration</h1>
<div class="top">
  <input type="file" id="fileInput" accept="image/*" />
  <span class="or">ou</span>
  <input type="text" id="imageUrl" placeholder="Image URL" />
  <input type="text" id="title" placeholder="TITRE ICI" style="max-width:300px" />
  <button onclick="generate()">Generate</button>
</div>
<div class="main">
  <div class="controls">
    <h2>Image</h2>
    <div class="row"><label>Desaturation %</label><input type="range" id="desaturate" min="0" max="80" step="5" value="${d.desaturate}"><span class="v" id="desaturate-v">${d.desaturate}</span></div>
    <div class="row"><label>Contrast %</label><input type="range" id="contrast" min="80" max="200" step="5" value="${d.contrast}"><span class="v" id="contrast-v">${d.contrast}</span></div>
    <div class="row"><label>Brightness %</label><input type="range" id="brightness" min="60" max="120" step="5" value="${d.brightness}"><span class="v" id="brightness-v">${d.brightness}</span></div>

    <h2>Gradient Map (jaune→bleu)</h2>
    <div class="row"><label>Opacite %</label><input type="range" id="gradientOpacity" min="20" max="100" step="5" value="${d.gradientOpacity}"><span class="v" id="gradientOpacity-v">${d.gradientOpacity}</span></div>
    <div class="row"><label>Grain %</label><input type="range" id="grain" min="0" max="30" step="2" value="${d.grain}"><span class="v" id="grain-v">${d.grain}</span></div>

    <h2>Banniere</h2>
    <div class="row"><label>Transparence</label><input type="range" id="bannerAlpha" min="0.1" max="0.9" step="0.02" value="${d.bannerAlpha}"><span class="v" id="bannerAlpha-v">${d.bannerAlpha}</span></div>

    <h2>Logo</h2>
    <div class="row"><label>Largeur px</label><input type="range" id="logoWidth" min="100" max="300" step="10" value="${d.logoWidth}"><span class="v" id="logoWidth-v">${d.logoWidth}</span></div>
    <div class="row"><label>Hauteur px</label><input type="range" id="logoHeight" min="40" max="120" step="5" value="${d.logoHeight}"><span class="v" id="logoHeight-v">${d.logoHeight}</span></div>
    <div class="row"><label>Marge bas px</label><input type="range" id="logoBottom" min="10" max="80" step="5" value="${d.logoBottom}"><span class="v" id="logoBottom-v">${d.logoBottom}</span></div>
    <div class="row"><label>Marge droite px</label><input type="range" id="logoRight" min="10" max="80" step="5" value="${d.logoRight}"><span class="v" id="logoRight-v">${d.logoRight}</span></div>

    <h2 style="color:#0f0">Export</h2>
    <button class="preset" onclick="copyJSON()" style="background:#2a5a2a">Copier JSON</button>
    <pre id="jsonOut" style="font-size:10px;color:#0f0;margin-top:5px;max-height:150px;overflow:auto"></pre>
  </div>
  <div class="result">
    <div id="status"></div>
    <div id="resultImg"></div>
  </div>
</div>
<script>
const sliders=['desaturate','contrast','brightness','gradientOpacity','grain','bannerAlpha','logoWidth','logoHeight','logoBottom','logoRight'];
sliders.forEach(id=>{
  document.getElementById(id).addEventListener('input',function(){
    document.getElementById(id+'-v').textContent=this.value;
  });
});

function getFilters(){
  const f={};
  sliders.forEach(id=>{f[id]=parseFloat(document.getElementById(id).value)});
  return f;
}

function copyJSON(){
  const j=JSON.stringify(getFilters(),null,2);
  document.getElementById('jsonOut').textContent=j;
  navigator.clipboard.writeText(j).catch(()=>{});
}

let uploadedDataUri=null;
document.getElementById('fileInput').addEventListener('change',function(e){
  const file=e.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=function(ev){uploadedDataUri=ev.target.result;document.getElementById('imageUrl').value='[uploaded: '+file.name+']'};
  reader.readAsDataURL(file);
});

async function generate(){
  const url=uploadedDataUri||document.getElementById('imageUrl').value;
  const title=document.getElementById('title').value;
  if(!url)return alert('Choisir une image (upload ou URL)');
  if(!title)return alert('Entrer un titre');
  document.querySelector('button').disabled=true;
  document.getElementById('status').textContent='Generation en cours (~5s)...';
  document.getElementById('resultImg').innerHTML='';
  try{
    const r=await fetch('/generate-base64',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({imageUrl:url,title:title,filters:getFilters()})
    });
    const data=await r.json();
    if(data.success){
      document.getElementById('resultImg').innerHTML='<img src="'+data.image+'"/><br><a class="dl" href="'+data.image+'" download="guardian.png">Telecharger PNG</a>';
      document.getElementById('status').textContent='Termine !';
    }else{document.getElementById('status').textContent='Erreur: '+(data.error||'Inconnue')}
  }catch(e){document.getElementById('status').textContent='Erreur: '+e.message}
  document.querySelector('button').disabled=false;
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
  const { imageUrl, title, filters } = req.body;

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

    const html = generateHTML(imageUrl, title, filters);
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
  const { imageUrl, title, filters } = req.body;

  if (!imageUrl || !title) {
    return res.status(400).json({ error: 'imageUrl and title are required' });
  }

  const SIZE = 1080;

  try {
    const b = await getBrowser();
    const page = await b.newPage();

    await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 });

    const html = generateHTML(imageUrl, title, filters);
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
