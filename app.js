
/* Config loader */
async function loadConfig(){
  const r = await fetch('./config.json', {cache:'no-store'});
  return await r.json();
}

/* CSV loader */
function parseDateUKAware(v){
  if(!v) return null;
  // Try ISO first
  let d = new Date(v);
  if(!isNaN(d)) return d;
  // Try DD/MM/YYYY
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
  // 10:30, 10, 10am, 10:30 pm
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
  // Map flexible headers
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
  return {
    title: title || 'Untitled',
    start,
    end,
    cost: get('cost') || '',
    address: get('address') || '',
    postcode: get('postcode') || '',
    website: get('website') || '',
    image: get('image') || '',
    description: get('description') || '',
    category: get('category') || ''
  };
}

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

function eventCard(e){
  const imgTag = e.image ? `<img src="${e.image}" alt="">` : `<div style="height:160px;background:#e2e8f0"></div>`;
  const addr = e.address || e.postcode ? `<div class="meta">${[e.address, e.postcode].filter(Boolean).join(', ')}</div>` : '';
  const cost = e.cost ? `<span class="badge">Cost: ${e.cost}</span>` : '';
  const cat = e.category ? `<span class="badge">${e.category}</span>` : '';
  const link = e.website ? `<a href="${e.website}" target="_blank" rel="noopener">Details</a>` : '';
  return `<article class="card">
    ${imgTag}
    <div class="body">
      <h3>${e.title}</h3>
      <div class="meta">${formatDateTime(e.start)} ${e.end? '— ' + formatDateTime(e.end): ''}</div>
      ${addr}
      <div class="badges">${cost}${cat}</div>
      <div style="margin-top:8px; font-size:14px;">${e.description || ''}</div>
      <div style="margin-top:10px">${link}</div>
    </div>
  </article>`;
}

/* Homepage population: this week */
async function populateHome(){
  const cfg = await loadConfig();
  if(!cfg.eventsCsvUrl || cfg.eventsCsvUrl.includes('PASTE_YOUR')){
    document.getElementById('cards').innerHTML = '<p class="meta">Configure your CSV link in config.json.</p>';
    return;
  }
  const all = await loadEvents(cfg.eventsCsvUrl);
  // this week
  const now = new Date();
  const end = new Date(now.getTime() + 7*24*3600*1000);
  const week = all
    .filter(e=> e.start >= now && e.start <= end)
    .sort((a,b)=> a.start - b.start)
    .slice(0,12);
  // categories
  const cats = Array.from(new Set(all.map(e=>e.category).filter(Boolean))).sort();
  const catSel = document.getElementById('cat');
  if(catSel){
    cats.forEach(c=>{
      const o = document.createElement('option'); o.value=c; o.textContent=c; catSel.appendChild(o);
    });
  }
  document.getElementById('cards').innerHTML = week.map(eventCard).join('');
}

/* Calendar */
function startOfMonth(d){
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d){
  return new Date(d.getFullYear(), d.getMonth()+1, 0);
}
function startOfWeek(d){
  const day = d.getDay(); // 0 Sun..6 Sat
  const delta = (day + 6) % 7; // Monday as start
  const res = new Date(d);
  res.setDate(d.getDate() - delta);
  res.setHours(0,0,0,0);
  return res;
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
  // weekday headers
  const headers = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>{
    const h = document.createElement('div');
    h.style.fontWeight='700'; h.style.textAlign='center'; h.textContent = x;
    return h;
  });
  headers.forEach(h=>container.appendChild(h));
  // grid rows need headers prepended? Simpler: add as first row
  // Insert headers into CSS grid by setting explicit 7 columns and adding first 7 nodes
  headers.forEach(h=>container.appendChild(h));
  cells.forEach(c=>container.appendChild(c));
}

async function populateEvents(){
  const cfg = await loadConfig();
  const url = cfg.eventsCsvUrl;
  const listEl = document.getElementById('list');
  const calEl = document.getElementById('calendar');
  if(!url || url.includes('PASTE_YOUR')){
    listEl.innerHTML = '<p class="meta">Configure your CSV link in config.json.</p>';
    return;
  }
  const all = await loadEvents(url);
  // Filters
  const params = new URLSearchParams(location.search);
  const q = (params.get('q')||'').toLowerCase();
  const catParam = (params.get('cat')||'').toLowerCase();
  const filtered = all.filter(e=>{
    const hay = [e.title, e.description, e.address, e.category].join(' ').toLowerCase();
    const qOk = !q || hay.includes(q);
    const cOk = !catParam || (e.category||'').toLowerCase() === catParam;
    return qOk && cOk;
  }).sort((a,b)=> a.start - b.start);

  // Category dropdown
  const cats = Array.from(new Set(all.map(e=>e.category).filter(Boolean))).sort();
  const catSel = document.getElementById('cat');
  cats.forEach(c=>{
    const o = document.createElement('option'); o.value=c; o.textContent=c; catSel.appendChild(o);
  });

  // List
  listEl.innerHTML = filtered.map(eventCard).join('');

  // Calendar month state
  let current = new Date();
  function draw(){ renderCalendar(calEl, current, filtered); }
  draw();
  document.getElementById('prev').onclick = ()=>{ current = new Date(current.getFullYear(), current.getMonth()-1, 1); draw(); };
  document.getElementById('next').onclick = ()=>{ current = new Date(current.getFullYear(), current.getMonth()+1, 1); draw(); };
  document.getElementById('filterBtn').onclick = ()=>{
    const qv = document.getElementById('q').value.trim();
    const cv = document.getElementById('cat').value;
    location.href = `events.html?q=${encodeURIComponent(qv)}&cat=${encodeURIComponent(cv)}`;
  };
}

/* Router */
document.addEventListener('DOMContentLoaded', ()=>{
  const on = (sel)=>document.querySelector(sel)!=null;
  if(on('#cards')) populateHome();
  if(on('#calendar')) populateEvents();
});
