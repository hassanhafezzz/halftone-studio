(() => {
const $ = id => document.getElementById(id);
const out = $('out'), ctx = out.getContext('2d');
const src = document.createElement('canvas'), sctx = src.getContext('2d', {willReadFrequently:true});
let srcData = null, srcName = '', sw = 0, sh = 0, groups = [], dotCount = 0, lastBg = '', lastDither = false;
let palette = null, paletteInks = [], activeDetail = null;

// Detail presets set the screen and tone controls; palettes list the paper first, then the inks
const DETAIL = [
  {name:'High',   cell:5,  angle:45, gain:105, bright:0, contrast:30, shape:'circle'},
  {name:'Medium', cell:12, angle:45, gain:110, bright:0, contrast:20, shape:'circle'},
  {name:'Low',    cell:28, angle:45, gain:120, bright:0, contrast:40, shape:'circle'}
];
// Looks also set the colours: light dots on black, a fine two-tone screen for lit faces on dark backgrounds
const LOOKS = [
  {name:'Night portrait', cell:3,  angle:45, gain:105, bright:8, contrast:70, shape:'square', mode:'custom', invert:true,  ink:'#000000', paper:'#e6e6e6'},
  {name:'Fine grain',     cell:3,  angle:45, gain:100, bright:0, contrast:40, shape:'circle', mode:'custom', invert:false, ink:'#111111', paper:'#fafafa'},
  {name:'Newsprint',      cell:8,  angle:45, gain:110, bright:0, contrast:30, shape:'circle', mode:'custom', invert:false, ink:'#1b1b1b', paper:'#efe9da'},
  {name:'Colour dots',    cell:3,  angle:45, gain:120, bright:0, contrast:40, shape:'circle', mode:'photo',  invert:false, paper:'#f3f2ee'},
  {name:'Acid pixel', cell:3, angle:0,  gain:150, bright:0, contrast:50, shape:'square', mode:'preset', invert:false, palette:'Acid'},
  {name:'Ultraviolet pixel', cell:3, angle:0,  gain:150, bright:0, contrast:50, shape:'square', mode:'preset', invert:false, palette:'Ultraviolet'},
  {name:'Electric dither', cell:3, angle:0, gain:100, bright:0, contrast:65, shape:'dither', mode:'preset', invert:false, palette:'Electric'},
  {name:'Solar pixel', cell:3, angle:0,  gain:150, bright:0, contrast:50, shape:'square', mode:'preset', invert:false, palette:'Solar'}
];
const ALL = DETAIL.concat(LOOKS);
const PALETTES = [
  {name:'Newsprint', colors:['#f1ead9','#1d1b1a','#c8402e']},
  {name:'Poster', colors:['#f4f1ea','#1c2b5a','#e8553a']},
  {name:'Fern', colors:['#eef2e6','#17301f','#3f8a4f']},
  {name:'Cobalt', colors:['#f3f0e8','#10246b','#3b6fe0']},
  {name:'Plum', colors:['#f6eef0','#2a1530','#b0375f']},
  {name:'Ochre', colors:['#f6efdc','#2a2418','#c98a1b']},
  {name:'Teal and coral', colors:['#f2efe6','#14363a','#ef6f5b']},
  {name:'Graphite', colors:['#efeeea','#1b1c20','#6d7480']},
  {name:'Blueprint', colors:['#e9f0f7','#0e2a47','#2f7fc1']},
  {name:'Rust', colors:['#f4ece1','#2b1a14','#b5502a']},
  {name:'Violet', colors:['#f2eef7','#231a3d','#7a54d6']},
  {name:'Lagoon', colors:['#eef5f3','#0f2f33','#1fa39a']},
  {name:'Electric', colors:['#1618fd','#000000','#ee371b']},
  {name:'Solar', colors:['#ffd60a','#000000','#e5232b']},
  {name:'Acid', colors:['#12e08a','#000000','#ff2d95']},
  {name:'Ultraviolet', colors:['#5b17ff','#000000','#00e5ff']},
  {name:'Ember', colors:['#ff5a1f','#000000','#ffe14a']},
  {name:'Bauhaus', colors:['#efe6d2','#1b3a8c','#d62718','#f2b705']},
  {name:'Retro pop', colors:['#f6efdd','#20232e','#d9423a','#2f6f8f']},
  {name:'Sunset', colors:['#fbf1dc','#2b1d3a','#c2415c','#f08a3c']},
  {name:'Riso', colors:['#f5f1e8','#1c1c28','#ff5a8a','#2e6bd6']},
  {name:'Meadow', colors:['#f1f3e4','#1c2a1a','#5a9a3c','#e0b43a']},
  {name:'Ocean', colors:['#eef4f6','#0c2236','#1d6fa5','#5cc0c9']},
  {name:'Berry', colors:['#f7eef0','#2a1021','#a3254f','#e38aa8']},
  {name:'Autumn', colors:['#f6eddc','#2b1c12','#b4472a','#d9962b']},
  {name:'Cyber', colors:['#f0f0f5','#14142b','#e03a8a','#2ec4d6']},
  {name:'Forest', colors:['#eef0e6','#162116','#2f5d3a','#9bb05a']},
  {name:'Candy', colors:['#fbf0ee','#2d2433','#f06b8e','#6fb8e8']},
  {name:'Terra', colors:['#f4ebdf','#2a1b16','#c06a3a','#6b8f71']},
  {name:'Warm grey', colors:['#f3eee6','#1a1816','#6a5f55','#b7a999']}
];
const PAL3 = PALETTES.filter(p => p.colors.length === 3), PAL4 = PALETTES.filter(p => p.colors.length === 4);
const hexRgb = h => [1,3,5].map(i => parseInt(h.slice(i,i+2),16));
function nearestInk(r,g,b){
  let best = paletteInks[0], bd = Infinity;
  for(const k of paletteInks){ const d=(r-k.rgb[0])**2+(g-k.rgb[1])**2+(b-k.rgb[2])**2; if(d<bd){ bd=d; best=k; } }
  return best.hex;
}
const MAXOUT = 1600;

function loadSource(img, name){
  const scale = Math.min(1, 900 / Math.max(img.width, img.height));
  sw = Math.round(img.width*scale); sh = Math.round(img.height*scale);
  src.width = sw; src.height = sh;
  sctx.filter = 'blur(1px)'; sctx.drawImage(img,0,0,sw,sh); sctx.filter='none';
  srcData = sctx.getImageData(0,0,sw,sh).data;
  srcName = name || '';
  const t = $('srcTag'); t.textContent = name || 'Your photo'; t.dataset.state = 'loaded';
  $('empty').hidden = true;
  ['png','svg','copy'].forEach(id => { $(id).disabled = false; });
  render();
}

const val = id => +$(id).value;
const lum = hex => { const [r,g,b] = hexRgb(hex); return 0.2126*r + 0.7152*g + 0.0722*b; };
// Palette colours in use: invert swaps the paper with the darkest ink so the ground goes dark
function pcols(){
  const c = palette.slice();
  if($('invert').checked){
    let di = 1; for(let i = 2; i < c.length; i++) if(lum(c[i]) < lum(c[di])) di = i;
    [c[0], c[di]] = [c[di], c[0]];
  }
  return c;
}
const mode = () => document.querySelector('input[name=colorsrc]:checked').value;
// Background and base dot colour for the chosen colour source; null dot means every dot carries its own colour
function ground(){
  const m = mode(), inv = $('invert').checked;
  if(shape() === 'dither' && m !== 'photo') return {bg: ditherRamp()[0], dot: null};
  if(m === 'preset') return {bg: pcols()[0], dot: null};
  if(m === 'photo') return {bg: $('paperP').value, dot: null};
  return {bg: inv ? $('ink').value : $('paperC').value, dot: inv ? $('paperC').value : $('ink').value};
}
const shape = () => document.querySelector('input[name=shape]:checked').value;

function readouts(){
  ['cell','angle','gain','bright','contrast'].forEach(id=>{
    const unit={cell:' px',angle:'°',gain:'%',bright:'',contrast:''}[id];
    $(id+'O').textContent = (id==='bright'||id==='contrast') && val(id)>0 ? '+'+val(id) : val(id)+unit;
  });
}

const r2 = n => Math.round(n*100)/100, r3 = n => Math.round(n*1000)/1000;
const quant = v => (v & 0xf0) | (v >> 4); // 16 levels per channel keeps photo colours to a few thousand paths
// One closed subpath per dot, in source pixels: arcs for circles, rotated corners for the other shapes
function dotPath(shp, x, y, s, cs, sn, cell){
  if(shp === 'circle') return `M${r2(x-s)} ${r2(y)}a${r2(s)} ${r2(s)} 0 1 0 ${r2(2*s)} 0a${r2(s)} ${r2(s)} 0 1 0 ${r2(-2*s)} 0Z`;
  let w, h;
  if(shp === 'line'){ w = cell/2 + 0.3; h = Math.min(s, cell/2); } else { w = h = s*0.886; }
  const p = (u,v) => `${r2(x+u*cs-v*sn)} ${r2(y+u*sn+v*cs)}`;
  return `M${p(-w,-h)}L${p(w,-h)}L${p(w,h)}L${p(-w,h)}Z`;
}
// Dither reads the palette as a tone ramp, darkest to lightest: the inks in order, then the paper
function ditherRamp(){
  if(mode() === 'preset') return palette.slice(1).concat(palette[0]);
  return [$('ink').value, $('paperC').value];
}
const BAYER = (() => { let m = [0]; for(let n = 1; n < 8; n *= 2){ const s = n*n; m = Array.from({length: 4*s}, (_, k) => { const x = k % (2*n), y = (k / (2*n)) | 0; return 4*m[(y % n)*n + (x % n)] + [[0,2],[3,1]][(y/n)|0][(x/n)|0]; }); } return m; })();
// One pixel per cell on a straight grid. Each cell takes the ramp colour its tone falls on, and an ordered
// pattern decides between the two nearest colours. Runs of one colour share a rectangle.
function dither(cellSrc, b, cf, inv, m){
  const ramp = m === 'photo' ? null : ditherRamp(), n = ramp ? ramp.length : 2;
  const cols = Math.ceil(sw/cellSrc), rows = Math.ceil(sh/cellSrc), map = new Map();
  let count = 0;
  for(let j = 0; j < rows; j++){
    let key = null, start = 0;
    const flush = end => {
      if(!key) return;
      let grp = map.get(key); if(!grp){ grp = {c:key, d:''}; map.set(key, grp); }
      grp.d += `M${r3(start*cellSrc)} ${r3(j*cellSrc)}h${r3((end-start)*cellSrc)}v${r3(cellSrc)}h${r3(-(end-start)*cellSrc)}Z`;
      count += end - start;
    };
    for(let i = 0; i <= cols; i++){
      let k = null;
      if(i < cols){
        const p = ((Math.min(sh-1, ((j+0.5)*cellSrc)|0))*sw + Math.min(sw-1, ((i+0.5)*cellSrc)|0))*4;
        const r = srcData[p], g = srcData[p+1], bl = srcData[p+2];
        let L = (0.2126*r + 0.7152*g + 0.0722*bl)/255;
        L = (cf*(L*255-128)+128)/255 + b; L = Math.min(1, Math.max(0, L));
        if(inv) L = 1 - L;
        const thr = (BAYER[(j & 7)*8 + (i & 7)] + 0.5)/64;
        if(ramp){
          const t = L*(n-1), idx = Math.min(n-2, Math.floor(t));
          k = t - idx > thr ? ramp[idx+1] : ramp[idx];
          if(k === ramp[0]) k = null;
        } else if(1 - L > thr) k = `rgb(${quant(r)},${quant(g)},${quant(bl)})`;
      }
      if(k !== key){ flush(i); key = k; start = i; }
    }
  }
  return {groups: [...map.values()], count};
}
function sizeCanvas(w, h){ if(out.width !== w) out.width = w; if(out.height !== h) out.height = h; }

// Dither is a straight pixel grid, so the screen angle and dot gain have nothing to act on
function syncDither(){
  const off = shape() === 'dither';
  ['angle','gain'].forEach(id => { const el = $(id); el.disabled = off; el.parentElement.toggleAttribute('data-disabled', off); });
}
function render(){
  readouts(); syncDither();
  const inv = $('invert').checked, g0 = ground();
  lastBg = g0.bg;
  if(!srcData){
    // Empty sheet: a blank canvas in the chosen paper colour until a photo lands
    sizeCanvas(900, 1100);
    ctx.fillStyle = g0.bg; ctx.fillRect(0,0,out.width,out.height);
    groups = []; dotCount = 0;
    $('specCell').textContent = val('cell') + ' px'; $('specAngle').textContent = val('angle') + '°'; $('specDots').textContent = '0';
    $('dims').textContent = `${out.width} × ${out.height} px`;
    return;
  }
  const cellSrc = val('cell') * (Math.max(sw,sh)/900); // spacing in source px
  const ang = val('angle')*Math.PI/180, gain = val('gain')/100;
  const b = val('bright')/100, k = val('contrast'), cf = (259*(k+255))/(255*(259-k));
  const m = mode();
  if(m === 'preset') paletteInks = pcols().slice(1).map(hex => ({hex, rgb: hexRgb(hex)}));
  let scale = Math.min(MAXOUT/Math.max(sw,sh), 2.5);
  lastDither = shape() === 'dither';
  if(lastDither) scale = Math.max(1, Math.round(cellSrc*scale))/cellSrc; // whole output pixels per cell, so no seams between cells
  sizeCanvas(Math.round(sw*scale), Math.round(sh*scale));
  ctx.fillStyle = g0.bg; ctx.fillRect(0,0,out.width,out.height);
  const shp = shape();
  if(shp === 'dither'){
    const d = dither(cellSrc, b, cf, inv, m);
    groups = d.groups; dotCount = d.count;
    ctx.save(); ctx.scale(scale,scale);
    for(const g of groups){ ctx.fillStyle = g.c; ctx.fill(new Path2D(g.d)); }
    ctx.restore();
    $('specCell').textContent = Math.round(cellSrc*scale) + ' px'; $('specAngle').textContent = '0°'; $('specDots').textContent = dotCount.toLocaleString();
    $('dims').textContent = `${out.width} × ${out.height} px`;
    $('svgbox').hidden = true;
    return;
  }
  const cos = Math.cos(ang), sin = Math.sin(ang), cx = sw/2, cy = sh/2;
  const R = Math.hypot(sw,sh)/2 + cellSrc;
  const n = Math.ceil(R/cellSrc);
  const sa = ang + (shp === 'diamond' ? Math.PI/4 : 0), scs = Math.cos(sa), ssn = Math.sin(sa);
  const byColour = new Map(); dotCount = 0;
  for(let i=-n;i<=n;i++) for(let j=-n;j<=n;j++){
    const u=i*cellSrc, v=j*cellSrc;
    const x = cx + u*cos - v*sin, y = cy + u*sin + v*cos;
    if(x<0||y<0||x>=sw||y>=sh) continue;
    const p = ((y|0)*sw + (x|0))*4;
    const r=srcData[p], g=srcData[p+1], bl=srcData[p+2];
    let L = (0.2126*r + 0.7152*g + 0.0722*bl)/255;
    L = (cf*(L*255-128)+128)/255 + b; L = Math.min(1,Math.max(0,L));
    const dark = inv ? L : 1-L;
    if(dark < 0.015) continue;
    const size = (shp==='line' ? dark : Math.sqrt(dark)) * cellSrc * 0.5 * gain * Math.SQRT2;
    const key = m === 'preset' ? nearestInk(r,g,bl) : m === 'photo' ? `rgb(${quant(r)},${quant(g)},${quant(bl)})` : g0.dot;
    let grp = byColour.get(key); if(!grp){ grp = {c:key, d:''}; byColour.set(key, grp); }
    grp.d += dotPath(shp, x, y, size, scs, ssn, cellSrc); dotCount++;
  }
  groups = [...byColour.values()];
  if(m === 'preset') groups.sort((a,c) => lum(c.c) - lum(a.c)); // lightest ink first, so the darkest lands on top
  ctx.save(); ctx.scale(scale,scale);
  for(const g of groups){ ctx.fillStyle = g.c; ctx.fill(new Path2D(g.d)); }
  ctx.restore();
  $('specCell').textContent = Math.round(cellSrc*scale) + ' px'; $('specAngle').textContent = val('angle') + '°'; $('specDots').textContent = dotCount.toLocaleString();
  $('dims').textContent = `${out.width} × ${out.height} px`;
  $('svgbox').hidden = true;
}

// The SVG reuses the path data the preview was drawn from, one path per colour
function toSVG(){
  const body = groups.map(g => `<path fill="${g.c}" d="${g.d}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sw} ${sh}"${lastDither ? ' shape-rendering="crispEdges"' : ''}><rect width="100%" height="100%" fill="${lastBg}"/>${body}</svg>`;
}

const toast = m => { $('toast').textContent = m; setTimeout(()=>{ if($('toast').textContent===m) $('toast').textContent=''; }, 3000); };

const baseName = () => (srcName.replace(/\.[^.]+$/, '') || 'halftone') + '-halftone';
function saveBlob(blob, name){
  const a = document.createElement('a'), u = URL.createObjectURL(blob);
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
  toast(`Saved ${name}`);
}
$('png').addEventListener('click', () => {
  if(!srcData) return;
  out.toBlob(b => b ? saveBlob(b, baseName() + '.png') : toast('Couldn’t create the PNG. Try again.'), 'image/png');
});
$('svg').addEventListener('click', () => {
  if(!srcData) return;
  saveBlob(new Blob([toSVG()], {type:'image/svg+xml'}), baseName() + '.svg');
});
$('copy').addEventListener('click', () => {
  if(!srcData) return;
  const s = toSVG();
  const fallback = () => { $('svgText').value = s; $('svgbox').hidden = false; $('svgText').select(); };
  try { navigator.clipboard.writeText(s).then(()=>toast(`SVG copied, ${Math.round(s.length/1024)} KB`), fallback); } catch(e){ fallback(); }
});

function markPressed(){
  document.querySelectorAll('#detailChips .btn, #lookChips .btn').forEach((b,i) => b.setAttribute('aria-pressed', String(activeDetail === i)));
}
function applyDetail(i){
  const p = ALL[i];
  ['cell','angle','gain','bright','contrast'].forEach(id => { $(id).value = p[id]; });
  document.querySelector(`input[name=shape][value=${p.shape}]`).checked = true;
  if(p.mode){
    $('cs-'+p.mode).checked = true;
    $('invert').checked = !!p.invert;
    if(p.mode === 'custom'){ $('ink').value = p.ink; $('paperC').value = p.paper; }
    if(p.mode === 'photo') $('paperP').value = p.paper;
    if(p.mode === 'preset'){ $('palette').value = String(PALETTES.findIndex(x => x.name === p.palette)); setPalette(); }
    syncMode();
  }
  activeDetail = i; markPressed(); queue();
}
function setPalette(){
  palette = PALETTES[+$('palette').value].colors.slice();
  showPalette();
}
// Same colours in a new order: the first is the paper, so the ground and the ink for each tone change
function shufflePalette(){
  const prev = palette.join();
  do {
    for(let i = palette.length - 1; i > 0; i--){ const j = Math.floor(Math.random()*(i+1)); [palette[i], palette[j]] = [palette[j], palette[i]]; }
  } while(palette.join() === prev);
  showPalette(); queue();
}
function showPalette(){
  const pv = $('palettePreview'); pv.textContent = '';
  palette.forEach(hex => { const s = document.createElement('span'); s.style.backgroundColor = hex; pv.appendChild(s); });
  pv.setAttribute('aria-label', `${palette.length} colours: ${palette.join(', ')}`);
}
function syncMode(){
  const m = mode();
  ['photo','preset','custom'].forEach(k => { const body = $('mb-'+k); body.hidden = k !== m; body.parentElement.toggleAttribute('data-selected', k === m); });
}
function buildPresets(){
  [[DETAIL, $('detailChips'), 0], [LOOKS, $('lookChips'), DETAIL.length]].forEach(([list, box, off]) => list.forEach((p,i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.textContent = p.name; b.setAttribute('aria-pressed','false');
    b.addEventListener('click', () => applyDetail(off + i)); box.appendChild(b);
  }));
  const sel = $('palette');
  [['3 colours', PAL3], ['4 colours', PAL4]].forEach(([label, list]) => {
    const g = document.createElement('optgroup'); g.label = label;
    list.forEach(p => { const o = document.createElement('option'); o.value = String(PALETTES.indexOf(p)); o.textContent = p.name; g.appendChild(o); });
    sel.appendChild(g);
  });
  sel.value = '0'; setPalette(); syncMode();
}

let raf = 0; const queue = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); };
document.querySelector('aside').addEventListener('input', e => {
  const t = e.target;
  if(t.type === 'file') return;
  if(t.type === 'range' || t.name === 'shape' || (activeDetail >= DETAIL.length && t.id !== 'palette')){ activeDetail = null; markPressed(); }
  queue();
});
document.querySelectorAll('input[name=colorsrc]').forEach(el => el.addEventListener('change', syncMode));
$('palette').addEventListener('input', setPalette);
$('shuffle').addEventListener('click', shufflePalette);
buildPresets();

function readFile(f){
  if(!f || !f.type.startsWith('image/')){ toast('That file isn’t an image. Try a JPG or PNG.'); return; }
  const url = URL.createObjectURL(f), img = new Image();
  img.onload = () => { loadSource(img, f.name); URL.revokeObjectURL(url); };
  img.onerror = () => { URL.revokeObjectURL(url); toast('Couldn’t read that image. Try another file.'); };
  img.src = url;
}
$('pick').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', e => readFile(e.target.files[0]));
// A photo dropped anywhere on the page loads here instead of opening in the tab; the counter stops the highlight flickering over child elements
const drop = $('drop');
const hasFiles = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
let dragDepth = 0;
window.addEventListener('dragenter', e => { if(!hasFiles(e)) return; e.preventDefault(); dragDepth++; drop.classList.add('over'); });
window.addEventListener('dragover', e => { if(hasFiles(e)) e.preventDefault(); });
window.addEventListener('dragleave', e => { if(!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if(!dragDepth) drop.classList.remove('over'); });
window.addEventListener('drop', e => { if(!hasFiles(e)) return; e.preventDefault(); dragDepth = 0; drop.classList.remove('over'); readFile(e.dataTransfer.files[0]); });
document.addEventListener('paste', e => { const it=[...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/')); if(it) readFile(it.getAsFile()); });

render();
})();
