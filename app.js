
async function loadConfig(){ const r = await fetch('./config.json', {cache:'no-store'}); return await r.json(); }

// Simple localStorage geocode cache
async function geocodeCached(query){
  const key = 'geo:'+query.trim().toLowerCase();
  const hit = localStorage.getItem(key);
  if(hit){ try { return JSON.parse(hit); } catch(e){} }
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(query);
  const r = await fetch(url, {headers:{'Accept':'application/json'}});
  if(!r.ok) return null;
  const arr = await r.json();
  if(!arr || !arr.length) return null;
  const lat = parseFloat(arr[0].lat), lon = parseFloat(arr[0].lon);
  const val = {lat, lon};
  localStorage.setItem(key, JSON.stringify(val));
  return val;
}
function haversineMiles(a,b){
  if(!a||!b) return Infinity;
  const toRad = d=>d*Math.PI/180;
  const R=3958.8; // miles
  const dLat=toRad(b.lat-a.lat), dLon=toRad(b.lon-a.lon);
  const la1=toRad(a.lat), la2=toRad(b.lat);
  const x=Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(x));
}

function parseDateUKAware(v){
  if(!v) return null;
  let d = new Date(v);
  if(!isNaN(d)) return d;
  const m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(v.trim());
  if(m){
    const dd = parseInt(m[1],10), mm = parseInt(m[2],10)-1, yy = parseInt(m[3],10);
    d = new Date(yy, mm, dd);
    if(!isNaN(d)) return d;
  }
  return null;
}
function parseTimeToHM(v){
  if(!v) return null;
  const s = v.trim().toLowerCase();
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(s);
  if(!m) return null;
  let hh = parseInt(m[1],10);
  const mm = m[2] ? parseInt(m[2],10) : 0;
  const ampm = m[3];
  if(ampm === 'pm' && hh < 12) hh += 12;
  if(ampm === 'am' && hh === 12) hh = 0;
  return {h:hh, m:mm};
}
function combineDateTime(dateObj, timeObj){
  if(!dateObj) return null;
  const d = new Date(dateObj.getTime());
  if(timeObj){ d.setHours(timeObj.h, timeObj.m, 0, 0); } else { d.setHours(0,0,0,0); }
  return d;
}
function normaliseRow(row){
  const get = (k)=>{
    const keys = Object.keys(row);
    const found = keys.find(x=>x.trim().toLowerCase() === k);
    return found ? row[found] : "";
  };
  const title = get('title');
  const sd = parseDateUKAware(get('start date'));
  const st = parseTimeToHM(get('start time'));
  const ed = parseDateUKAware(get('end date')) || sd;
  const et = parseTimeToHM(get('end time'));
  const start = combineDateTime(sd, st);
  const end = combineDateTime(ed, et);
  const address = get('address') || '';
  const postcode = get('postcode') || '';
  const area = postcode.split(' ')[0] || ''; // BS1, BS2, etc.
  return {
    title: title || 'Untitled',
    start, end,
    cost: get('cost') || '',
    address, postcode, area,
    website: get('website') || '',
    image: get('image') || '',
    description: get('description') || '',
    category: (get('category') || '').toLowerCase()
  };
}
function toISO(d){ try { return d.toISOString(); } catch(e){ return null; } }

async function loadEvents(csvUrl){
  return new Promise((resolve, reject)=>{
    Papa.parse(csvUrl, {
      download: true,
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: (res)=>{
        try{
          const items = res.data.map(normaliseRow).filter(e=>e.start);
          resolve(items);
        }catch(err){ reject(err); }
      },
      error: reject
    });
  });
}
function formatDateTime(d){
  if(!d) return '';
  try{
    return new Intl.DateTimeFormat('en-GB', {dateStyle:'medium', timeStyle:'short'}).format(d);
  }catch(e){
    return d.toLocaleString();
  }
}

function eventCard(e, idx){
  const imgTag = e.image ? `<img src="${e.image}" alt="${e.title}">` : `<div style="height:160px;background:#e2e8f0" aria-hidden="true"></div>`;
  const addr = e.address || e.postcode ? `<div class="meta">${[e.address, e.postcode].filter(Boolean).join(', ')}</div>` : '';
  const cost = e.cost ? `<span class="badge">Cost: ${e.cost}</span>` : '';
  const cat = e.category ? `<span class="badge">${e.category}</span>` : '';
  const link = e.website ? `<a href="${e.website}" target="_blank" rel="noopener">Details</a>` : '';
  return `<article class="card" data-idx="${idx}" role="button" tabindex="0" aria-label="View event map and details">
    ${imgTag}
    <div class="body">
      <h3>${e.title}</h3>
      <div class="meta">${formatDateTime(e.start)} ${e.end? '— ' + formatDateTime(e.end): ''}</div>
      ${addr}
      <div class="badges">${cost}${cat}</div>
      <div style="margin-top:10px">${link}</div>
    </div>
  </article>`;
}

function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0); }
function startOfWeek(d){
  const day = d.getDay();
  const delta = (day + 6) % 7; // Monday start
  const res = new Date(d); res.setDate(d.getDate() - delta); res.setHours(0,0,0,0); return res;
}
function inSameDay(a,b){
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function renderCalendar(container, current, events){
  container.innerHTML = '';
  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(current);
  let cursor = startOfWeek(new Date(monthStart));
  const cells = [];
  while(cursor <= monthEnd || cursor.getDay() !== 1){
    const dayEvents = events.filter(ev => inSameDay(ev.start, cursor));
    const evHtml = dayEvents.slice(0,4).map(ev=>`<div class="cal-event" title="${ev.title}">${ev.title}</div>`).join('');
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    cell.innerHTML = `<div class="cal-date">${cursor.toLocaleDateString('en-GB', {day:'numeric', month:'short'})}</div>${evHtml}`;
    cells.push(cell);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()+1);
  }
  const headers = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>{
    const h = document.createElement('div'); h.style.fontWeight='700'; h.style.textAlign='center'; h.textContent = x; return h;
  });
  headers.forEach(h=>container.appendChild(h));
  headers.forEach(h=>container.appendChild(h));
  cells.forEach(c=>container.appendChild(c));
}

// Modal map
let modal, modalTitle, modalMeta, modalDesc, modalLink, map, mapInited=false;
function openModal(){ modal.style.display = 'flex'; }
function closeModal(){ modal.style.display = 'none'; }

async function showEventOnMap(e){
  if(!mapInited){
    map = L.map('map');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    mapInited=true;
  }
  modalTitle.textContent = e.title;
  modalDesc.innerHTML = e.description || '';
  modalLink.innerHTML = e.website ? `<a href="${e.website}" target="_blank" rel="noopener">Open website</a>` : '';
  modalMeta.textContent = [formatDateTime(e.start), e.address, e.postcode].filter(Boolean).join(' • ');

  const q = [e.address, e.postcode, 'Bristol, UK'].filter(Boolean).join(', ');
  const loc = await geocodeCached(q);
  if(loc){
    map.setView([loc.lat, loc.lon], 15);
    L.marker([loc.lat, loc.lon]).addTo(map);
  }
  openModal();
}

// Filters
function readToggles(){
  const vals = [];
  document.querySelectorAll('#toggles input[type=checkbox]').forEach(cb=>{ if(cb.checked) vals.push(cb.value.toLowerCase()); });
  return vals;
}
function areaFromPostcode(pc){ return (pc||'').trim().split(' ')[0]; }

async function populateEvents(){
  modal = document.getElementById('modal');
  modalTitle = document.getElementById('modalTitle');
  modalMeta = document.getElementById('modalMeta');
  modalDesc = document.getElementById('modalDesc');
  modalLink = document.getElementById('modalLink');
  document.getElementById('closeModal').onclick = closeModal;
  modal.addEventListener('click', (ev)=>{ if(ev.target.id==='modal') closeModal(); });

  const cfg = await loadConfig();
  const url = cfg.eventsCsvUrl;
  const listEl = document.getElementById('list');
  const calEl = document.getElementById('calendar');
  if(!url){ listEl.innerHTML = '<p class="meta">Configure your CSV link in config.json.</p>'; return; }

  const all = await loadEvents(url);

  // Populate areas and categories
  const areas = Array.from(new Set(all.map(e=>e.area).filter(Boolean))).sort();
  const areaSel = document.getElementById('area');
  areas.forEach(a=>{ const o=document.createElement('option'); o.value=a; o.textContent=a; areaSel.appendChild(o); });

  const cats = Array.from(new Set(all.map(e=>e.category).filter(Boolean))).sort();
  const catSel = document.getElementById('cat');
  cats.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; catSel.appendChild(o); });

  let current = new Date();
  function drawCalendar(data){ renderCalendar(calEl, current, data); }

  async function applyFilters(){
    const q = (document.getElementById('q').value||'').toLowerCase();
    const area = (areaSel.value||'').toLowerCase();
    const catVal = (catSel.value||'').toLowerCase();
    const toggles = readToggles(); // events, classes, parks, indoors, outdoors

    // Distance settings
    const homePc = (document.getElementById('homePostcode').value||'').trim();
    const maxMiles = parseInt(document.getElementById('distance').value,10) || 0;
    let homeLoc = null;
    if(homePc && maxMiles>0){
      homeLoc = await geocodeCached(homePc + ', UK');
    }

    const filtered = [];
    for(const e of all){
      const hay = [e.title, e.description, e.address, e.category, e.postcode].join(' ').toLowerCase();
      const qOk = !q || hay.includes(q);
      const areaOk = !area || (e.area||'').toLowerCase() === area;
      const catOk = !catVal || (e.category||'').toLowerCase() === catVal;

      // toggle logic: if event category contains any of enabled toggles keywords, keep it. If none selected, pass-through.
      let toggleOk = true;
      if(toggles.length){
        toggleOk = toggles.some(t => (e.category||'').toLowerCase().includes(t));
      }

      let distOk = true;
      if(homeLoc && maxMiles>0){
        // geocode event lazily
        const qaddr = [e.address, e.postcode, 'Bristol, UK'].filter(Boolean).join(', ');
        const loc = await geocodeCached(qaddr);
        if(loc){
          const d = haversineMiles(homeLoc, loc);
          distOk = d <= maxMiles;
        }else{
          distOk = false; // if cannot geocode, exclude when distance filter active
        }
      }

      if(qOk && areaOk && catOk && toggleOk && distOk){
        filtered.push(e);
      }
    }

    filtered.sort((a,b)=> a.start - b.start);
    listEl.innerHTML = filtered.map((e,idx)=>eventCard(e, idx)).join('');
    listEl.querySelectorAll('.card').forEach((el, i)=>{
      el.addEventListener('click', ()=> showEventOnMap(filtered[i]));
      el.addEventListener('keydown', (ev)=>{ if(ev.key==='Enter' || ev.key===' ') showEventOnMap(filtered[i]); });
    });
    drawCalendar(filtered);
  }

  // Controls
  document.getElementById('filterBtn').onclick = applyFilters;
  document.getElementById('distance').addEventListener('input', (e)=>{
    document.getElementById('distanceVal').textContent = e.target.value;
  });
  document.getElementById('setHome').onclick = async ()=>{
    const v = document.getElementById('homePostcode').value.trim();
    if(!v) return;
    const loc = await geocodeCached(v + ', UK');
    if(loc){ localStorage.setItem('homeLoc', JSON.stringify(loc)); }
    applyFilters();
  };
  const saved = localStorage.getItem('homeLoc'); if(saved){ try{ const loc=JSON.parse(saved); if(loc){ /* keep */ } }catch(e){} }

  // Month nav
  function redraw(dir){
    current = new Date(current.getFullYear(), current.getMonth()+dir, 1);
    applyFilters();
  }
  document.getElementById('prev').onclick = ()=> redraw(-1);
  document.getElementById('next').onclick = ()=> redraw(1);

  // Initial render
  await applyFilters();
}

async function populateHome(){
  const cfg = await loadConfig();
  if(!cfg.eventsCsvUrl){
    document.getElementById('cards').innerHTML = '<p class="meta">Configure your CSV link in config.json.</p>'; return;
  }
  const all = await loadEvents(cfg.eventsCsvUrl);
  const now = new Date();
  const end = new Date(now.getTime() + 7*24*3600*1000);
  const week = all
    .filter(e=> e.start >= now && e.start <= end)
    .sort((a,b)=> a.start - b.start)
    .slice(0,12);
  const cats = Array.from(new Set(all.map(e=>e.category).filter(Boolean))).sort();
  const catSel = document.getElementById('cat');
  if(catSel){
    cats.forEach(c=>{
      const o = document.createElement('option'); o.value=c; o.textContent=c; catSel.appendChild(o);
    });
  }
  document.getElementById('cards').innerHTML = week.map((e, i)=>eventCard(e, i)).join('');
}

document.addEventListener('DOMContentLoaded', ()=>{
  const on = (sel)=>document.querySelector(sel)!=null;
  if(on('#cards')) populateHome();
  if(on('#calendar')) populateEvents();
});
