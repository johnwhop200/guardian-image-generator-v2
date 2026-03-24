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

// Default filter values
const DEFAULTS = {
  saturate: 0.4, contrast: 1.05, brightness: 0.9, sepia: 0.3, hueRotate: 0,
  overlayR: 160, overlayG: 100, overlayB: 20, overlayA: 0.70,
  overlay2R: 210, overlay2G: 180, overlay2B: 50, overlay2A: 0.55,
  boostR: 200, boostG: 160, boostB: 40, boostA: 0.25
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
    background: #2a1a0a;
  }

  /* Background image — fills entire frame */
  .bg-image {
    position: absolute;
    top: 0; left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: saturate(${f.saturate}) contrast(${f.contrast}) brightness(${f.brightness}) sepia(${f.sepia}) hue-rotate(${f.hueRotate}deg);
  }

  /* Golden duotone overlay — warm yellow dominant */
  .duotone-overlay {
    position: absolute;
    top: 0; left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      135deg,
      rgba(${f.overlayR}, ${f.overlayG}, ${f.overlayB}, ${f.overlayA}) 0%,
      rgba(${Math.round((f.overlayR+f.overlay2R)/2)}, ${Math.round((f.overlayG+f.overlay2G)/2)}, ${Math.round((f.overlayB+f.overlay2B)/2)}, ${((f.overlayA+f.overlay2A)/2).toFixed(2)}) 50%,
      rgba(${f.overlay2R}, ${f.overlay2G}, ${f.overlay2B}, ${f.overlay2A}) 100%
    );
    mix-blend-mode: multiply;
  }

  /* Screen overlay for warmth */
  .color-boost {
    position: absolute;
    top: 0; left: 0;
    width: 100%;
    height: 100%;
    background: rgba(${f.boostR}, ${f.boostG}, ${f.boostB}, ${f.boostA});
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
  .row label{width:90px;font-size:11px;color:#aaa}
  .row input[type=range]{flex:1;height:16px}
  .row .v{width:40px;font-size:11px;text-align:right;font-family:monospace;color:#0f0}
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
  <input type="text" id="title" placeholder="TITLE TEXT" style="max-width:300px" />
  <button onclick="generate()">Generate</button>
</div>
<div class="main">
  <div class="controls">
    <h2>Presets (Canva-style)</h2>
    <button class="preset" onclick="applyPreset('epic')">Epic</button>
    <button class="preset" onclick="applyPreset('golden')">Golden</button>
    <button class="preset" onclick="applyPreset('warm')">Warm</button>
    <button class="preset" onclick="applyPreset('retro')">Retro</button>
    <button class="preset" onclick="applyPreset('dramatic')">Dramatic</button>
    <button class="preset" onclick="applyPreset('default')">Default V2</button>

    <h2>Image Filter</h2>
    <div class="row"><label>Saturate</label><input type="range" id="saturate" min="0" max="1.5" step="0.05" value="${d.saturate}"><span class="v" id="saturate-v">${d.saturate}</span></div>
    <div class="row"><label>Contrast</label><input type="range" id="contrast" min="0.5" max="2" step="0.05" value="${d.contrast}"><span class="v" id="contrast-v">${d.contrast}</span></div>
    <div class="row"><label>Brightness</label><input type="range" id="brightness" min="0.3" max="1.5" step="0.05" value="${d.brightness}"><span class="v" id="brightness-v">${d.brightness}</span></div>
    <div class="row"><label>Sepia</label><input type="range" id="sepia" min="0" max="1" step="0.05" value="${d.sepia}"><span class="v" id="sepia-v">${d.sepia}</span></div>
    <div class="row"><label>Hue Rotate</label><input type="range" id="hueRotate" min="-60" max="60" step="5" value="${d.hueRotate}"><span class="v" id="hueRotate-v">${d.hueRotate}</span></div>

    <h2>Duotone Overlay</h2>
    <div class="row"><label>Color 1 R</label><input type="range" id="overlayR" min="0" max="255" step="5" value="${d.overlayR}"><span class="v" id="overlayR-v">${d.overlayR}</span></div>
    <div class="row"><label>Color 1 G</label><input type="range" id="overlayG" min="0" max="255" step="5" value="${d.overlayG}"><span class="v" id="overlayG-v">${d.overlayG}</span></div>
    <div class="row"><label>Color 1 B</label><input type="range" id="overlayB" min="0" max="255" step="5" value="${d.overlayB}"><span class="v" id="overlayB-v">${d.overlayB}</span></div>
    <div class="row"><label>Alpha 1</label><input type="range" id="overlayA" min="0" max="1" step="0.05" value="${d.overlayA}"><span class="v" id="overlayA-v">${d.overlayA}</span></div>
    <div class="row"><label>Color 2 R</label><input type="range" id="overlay2R" min="0" max="255" step="5" value="${d.overlay2R}"><span class="v" id="overlay2R-v">${d.overlay2R}</span></div>
    <div class="row"><label>Color 2 G</label><input type="range" id="overlay2G" min="0" max="255" step="5" value="${d.overlay2G}"><span class="v" id="overlay2G-v">${d.overlay2G}</span></div>
    <div class="row"><label>Color 2 B</label><input type="range" id="overlay2B" min="0" max="255" step="5" value="${d.overlay2B}"><span class="v" id="overlay2B-v">${d.overlay2B}</span></div>
    <div class="row"><label>Alpha 2</label><input type="range" id="overlay2A" min="0" max="1" step="0.05" value="${d.overlay2A}"><span class="v" id="overlay2A-v">${d.overlay2A}</span></div>

    <h2>Screen Boost</h2>
    <div class="row"><label>Boost R</label><input type="range" id="boostR" min="0" max="255" step="5" value="${d.boostR}"><span class="v" id="boostR-v">${d.boostR}</span></div>
    <div class="row"><label>Boost G</label><input type="range" id="boostG" min="0" max="255" step="5" value="${d.boostG}"><span class="v" id="boostG-v">${d.boostG}</span></div>
    <div class="row"><label>Boost B</label><input type="range" id="boostB" min="0" max="255" step="5" value="${d.boostB}"><span class="v" id="boostB-v">${d.boostB}</span></div>
    <div class="row"><label>Boost Alpha</label><input type="range" id="boostA" min="0" max="0.5" step="0.05" value="${d.boostA}"><span class="v" id="boostA-v">${d.boostA}</span></div>

    <h2 style="color:#0f0">Export</h2>
    <button class="preset" onclick="copyJSON()" style="background:#2a5a2a">Copy filter JSON</button>
    <pre id="jsonOut" style="font-size:10px;color:#0f0;margin-top:5px;max-height:120px;overflow:auto"></pre>
  </div>
  <div class="result">
    <div id="status"></div>
    <div id="resultImg"></div>
  </div>
</div>
<script>
const sliders=['saturate','contrast','brightness','sepia','hueRotate','overlayR','overlayG','overlayB','overlayA','overlay2R','overlay2G','overlay2B','overlay2A','boostR','boostG','boostB','boostA'];
sliders.forEach(id=>{
  const el=document.getElementById(id);
  el.addEventListener('input',()=>{document.getElementById(id+'-v').textContent=el.value});
});

const presets={
  default:{saturate:${d.saturate},contrast:${d.contrast},brightness:${d.brightness},sepia:${d.sepia},hueRotate:${d.hueRotate},overlayR:${d.overlayR},overlayG:${d.overlayG},overlayB:${d.overlayB},overlayA:${d.overlayA},overlay2R:${d.overlay2R},overlay2G:${d.overlay2G},overlay2B:${d.overlay2B},overlay2A:${d.overlay2A},boostR:${d.boostR},boostG:${d.boostG},boostB:${d.boostB},boostA:${d.boostA}},
  epic:{saturate:0.25,contrast:1.15,brightness:0.85,sepia:0.4,hueRotate:-5,overlayR:140,overlayG:80,overlayB:20,overlayA:0.65,overlay2R:220,overlay2G:180,overlay2B:40,overlay2A:0.50,boostR:220,boostG:170,boostB:50,boostA:0.20},
  golden:{saturate:0.3,contrast:1.1,brightness:0.9,sepia:0.5,hueRotate:0,overlayR:180,overlayG:140,overlayB:20,overlayA:0.60,overlay2R:230,overlay2G:200,overlay2B:60,overlay2A:0.50,boostR:230,boostG:190,boostB:50,boostA:0.22},
  warm:{saturate:0.45,contrast:1.05,brightness:0.92,sepia:0.35,hueRotate:5,overlayR:170,overlayG:110,overlayB:30,overlayA:0.55,overlay2R:210,overlay2G:170,overlay2B:50,overlay2A:0.45,boostR:210,boostG:160,boostB:40,boostA:0.20},
  retro:{saturate:0.2,contrast:1.0,brightness:0.88,sepia:0.6,hueRotate:10,overlayR:150,overlayG:120,overlayB:40,overlayA:0.65,overlay2R:200,overlay2G:180,overlay2B:70,overlay2A:0.55,boostR:190,boostG:160,boostB:60,boostA:0.18},
  dramatic:{saturate:0.15,contrast:1.3,brightness:0.8,sepia:0.35,hueRotate:-10,overlayR:120,overlayG:60,overlayB:15,overlayA:0.75,overlay2R:200,overlay2G:150,overlay2B:30,overlay2A:0.55,boostR:180,boostG:130,boostB:30,boostA:0.15}
};

function applyPreset(name){
  const p=presets[name];
  sliders.forEach(id=>{
    const el=document.getElementById(id);
    if(p[id]!==undefined){el.value=p[id];document.getElementById(id+'-v').textContent=p[id]}
  });
}

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
  document.getElementById('status').textContent='Generating (~5s)...';
  document.getElementById('resultImg').innerHTML='';
  try{
    const r=await fetch('/generate-base64',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({imageUrl:url,title:title,filters:getFilters()})
    });
    const data=await r.json();
    if(data.success){
      document.getElementById('resultImg').innerHTML='<img src="'+data.image+'"/><br><a class="dl" href="'+data.image+'" download="guardian.png">Download PNG</a>';
      document.getElementById('status').textContent='Done!';
    }else{document.getElementById('status').textContent='Error: '+(data.error||'Unknown')}
  }catch(e){document.getElementById('status').textContent='Error: '+e.message}
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
