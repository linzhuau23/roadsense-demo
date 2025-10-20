/* RoadSense demo script (no backend) */
let MAP, TILE, CHART;
let ALL = [];      // all events
let VISIBLE = [];  // filtered

const els = {
  start: document.getElementById('start'),
  end: document.getElementById('end'),
  thresh: document.getElementById('thresh'),
  threshVal: document.getElementById('threshVal'),
  onlyNear: document.getElementById('onlyNear'),
  apply: document.getElementById('apply'),
  status: document.getElementById('status'),
  kTotal: document.getElementById('kTotal'),
  kNear: document.getElementById('kNear'),
  kSpeed: document.getElementById('kSpeed'),
  canvas: document.getElementById('timeseries'),
};

function setStatus(msg) { els.status.textContent = msg || ''; }
function parseDT(s) { return s ? new Date(s) : null; }
function pad(n){ return String(n).padStart(2,'0'); }
function toLocalDTStr(iso){
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initMap(rows){
  MAP = L.map('map');
  const center = rows.length ? [rows[0].lat, rows[0].lng] : [-31.978, 115.816];
  MAP.setView(center, 14);
  TILE = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ attribution: '&copy; OpenStreetMap' });
  TILE.addTo(MAP);
}

let layerGroup = null;
function drawMarkers(rows, threshold, onlyNear){
  if(layerGroup){ layerGroup.remove(); }
  layerGroup = L.layerGroup();
  rows.forEach(r=>{
    const isNear = r.nearMissScore >= threshold;
    if(onlyNear && !isNear) return;
    const color = isNear ? '#ff5d5d' : '#3fa7ff';
    const m = L.circleMarker([r.lat, r.lng], { radius:5, color, weight:2, fillOpacity:.6 });
    const t = new Date(r.ts).toLocaleString();
    m.bindPopup(`<b>${t}</b><br/>score: ${r.nearMissScore}<br/>speed: ${r.speed} km/h`);
    m.addTo(layerGroup);
  });
  layerGroup.addTo(MAP);
}

function groupByHour(rows){
  const bins = new Map();
  rows.forEach(r=>{
    const h = new Date(r.ts).getHours();
    bins.set(h, (bins.get(h)||0)+1);
  });
  const labels = [...Array(24).keys()].map(h=>pad(h));
  const data = labels.map(h => bins.get(+h) || 0);
  return { labels, data };
}

function updateChart(rows){
  if(!CHART){
    CHART = new Chart(els.canvas, {
      type:'bar',
      data:{ labels:[], datasets:[{ label:'Events per hour', data:[] }] },
      options:{
        responsive:true, plugins:{ legend:{ display:false }},
        scales:{ x:{ grid:{ color:'#1e2a52'}}, y:{ grid:{ color:'#1e2a52'}}}
      }
    });
  }
  const {labels, data} = groupByHour(rows);
  CHART.data.labels = labels;
  CHART.data.datasets[0].data = data;
  CHART.update();
}

function updateKPIs(rows, threshold){
  els.kTotal.textContent = rows.length;
  const near = rows.filter(r=> r.nearMissScore >= threshold).length;
  els.kNear.textContent = near;
  const avg = rows.length ? rows.reduce((a,r)=>a+r.speed,0)/rows.length : 0;
  els.kSpeed.textContent = Math.round(avg) + ' km/h';
}

function applyFilters(){
  const s = parseDT(els.start.value);
  const e = parseDT(els.end.value);
  const threshold = parseFloat(els.thresh.value);
  els.threshVal.textContent = `(${threshold.toFixed(2)})`;
  const onlyNear = (els.onlyNear.value === 'near');

  VISIBLE = ALL.filter(r=>{
    const t = new Date(r.ts);
    if(s && t < s) return false;
    if(e && t > e) return false;
    return true;
  });
  // 让地图视野适配可见点位
  if (VISIBLE.length) {
    const bounds = L.latLngBounds(VISIBLE.map(r => [r.lat, r.lng]));
    MAP.fitBounds(bounds, { padding: [20, 20] });
  }

  setStatus(VISIBLE.length ? '' : 'No data — widen time window or lower threshold.');
  drawMarkers(VISIBLE, threshold, onlyNear);
  updateChart(onlyNear ? VISIBLE.filter(r=> r.nearMissScore >= threshold) : VISIBLE);
  updateKPIs(VISIBLE, threshold);
}

function initControls(rows){
  const tsList = rows.map(r=> new Date(r.ts).getTime());
  const minT = new Date(Math.min.apply(null, tsList));
  const maxT = new Date(Math.max.apply(null, tsList));
  els.start.value = toLocalDTStr(minT.toISOString());
  els.end.value = toLocalDTStr(maxT.toISOString());
  els.threshVal.textContent = `(${parseFloat(els.thresh.value).toFixed(2)})`;
  els.apply.addEventListener('click', applyFilters);
  document.getElementById('reset').addEventListener('click', () => {
    // 重置为全时段
    const ts = ALL.map(r => new Date(r.ts).getTime());
    const minT = new Date(Math.min(...ts)); const maxT = new Date(Math.max(...ts));
    els.start.value = toLocalDTStr(minT.toISOString());
    els.end.value = toLocalDTStr(maxT.toISOString());
    els.thresh.value = 0.70; els.onlyNear.value = 'all';
    applyFilters();
  });
  
  document.getElementById('export').addEventListener('click', () => {
    const csv = ['id,ts,lat,lng,speed,nearMissScore']
      .concat(VISIBLE.map(r => [r.id,r.ts,r.lat,r.lng,r.speed,r.nearMissScore].join(',')))
      .join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href:url, download:'visible-events.csv' });
    a.click(); URL.revokeObjectURL(url);
  });
  
}

function main(){
  try{
    setStatus('Loading…');
    ALL = (window.EVENTS || []).slice();
    if(!ALL.length){ setStatus('No demo data.'); return; }
    initMap(ALL);
    initControls(ALL);
    setStatus('');
    applyFilters();
  }catch(e){
    console.error(e);
    setStatus('Error loading data.');
  }
}
document.addEventListener('DOMContentLoaded', main);
