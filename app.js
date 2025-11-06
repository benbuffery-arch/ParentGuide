
async function loadConfig(){ const r = await fetch('./config.json', {cache:'no-store'}); return await r.json(); }
function parseDateUKAware(v){
  if(!v) return null; let d = new Date(v); if(!isNaN(d)) return d;
  const m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(v.trim());
  if(m){ const dd=+m[1], mm=+m[2]-1, yy=+m[3]; d=new Date(yy,mm,dd); if(!isNaN(d)) return d; }
  return null;
}
function parseTimeToHM(v){
  if(!v) return null; const s=v.trim().toLowerCase();
  const m=/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(s); if(!m) return null;
  let hh=+m[1]; const mm=m[2]?+m[2]:0; const ampm=m[3];
  if(ampm==='pm' && hh<12) hh+=12; if(ampm==='am' && hh===12) hh=0; return {h:hh,m:mm};
}
function combineDateTime(d,t){ if(!d) return null; const x=new Date(d.getTime()); if(t){x.setHours(t.h,t.m,0,0)} else {x.setHours(0,0,0,0)} return x; }
function normaliseRow(row){
  const get=(k)=>{ const keys=Object.keys(row); const f=keys.find(x=>x.trim().toLowerCase()===k); return f?row[f]:""; };
  const title=get('title'); const sd=parseDateUKAware(get('start date')); const st=parseTimeToHM(get('start time'));
  const ed=parseDateUKAware(get('end date'))||sd; const et=parseTimeToHM(get('end time'));
  const start=combineDateTime(sd,st); const end=combineDateTime(ed,et);
  return { title:title||'Untitled', start, end, cost:get('cost')||'', address:get('address')||'', postcode:get('postcode')||'',
           website:get('website')||'', image:get('image')||'', description:get('description')||'', category:get('category')||'' };
}
function toISO(d){ try{return d.toISOString()}catch(e){return null} }
async function loadEvents(url){
  return new Promise((resolve,reject)=>{
    Papa.parse(url,{download:true,header:true,dynamicTyping:false,skipEmptyLines:true,
      complete:(res)=>{ try{ const items=res.data.map(normaliseRow).filter(e=>e.start); resolve(items); } catch(e){ reject(e); } },
      error:reject });
  });
}
function formatDateTime(d){ if(!d) return ''; try{ return new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(d); }catch(e){ return d.toLocaleString(); } }
function eventCard(e){
  const img=e.image?`<img src="${e.image}" alt="${e.title}">`:`<div style="height:160px;background:#e2e8f0" aria-hidden="true"></div>`;
  const addr=e.address||e.postcode?`<div class="meta">${[e.address,e.postcode].filter(Boolean).join(', ')}</div>`:'';
  const cost=e.cost?`<span class="badge">Cost: ${e.cost}</span>`:''; const cat=e.category?`<span class="badge">${e.category}</span>`:'';
  const link=e.website?`<a href="${e.website}" target="_blank" rel="noopener">Details</a>`:'';
  return `<article class="card" itemscope itemtype="https://schema.org/Event">
    ${img}<div class="body"><h3 itemprop="name">${e.title}</h3>
    <div class="meta" itemprop="startDate" content="${toISO(e.start) || ''}">${formatDateTime(e.start)} ${e.end?'— '+formatDateTime(e.end):''}</div>
    ${addr}<div class="badges">${cost}${cat}</div><div style="margin-top:8px;font-size:14px;" itemprop="description">${e.description||''}</div>
    <div style="margin-top:10px">${link}</div></div></article>`;
}
async function populateHome(){
  const cfg=await loadConfig();
  if(!cfg.eventsCsvUrl){ document.getElementById('cards').innerHTML='<p class="meta">Configure your CSV link in config.json.</p>'; return; }
  const all=await loadEvents(cfg.eventsCsvUrl); const now=new Date(); const end=new Date(now.getTime()+7*24*3600*1000);
  const week=all.filter(e=>e.start>=now && e.start<=end).sort((a,b)=>a.start-b.start).slice(0,12);
  const cats=[...new Set(all.map(e=>e.category).filter(Boolean))].sort(); const catSel=document.getElementById('cat');
  if(catSel){ cats.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; catSel.appendChild(o); }); }
  document.getElementById('cards').innerHTML=week.map(eventCard).join('');
}
function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0); }
function startOfWeek(d){ const day=d.getDay(); const delta=(day+6)%7; const x=new Date(d); x.setDate(d.getDate()-delta); x.setHours(0,0,0,0); return x; }
function inSameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function renderCalendar(container,current,events){
  container.innerHTML=''; const monthStart=startOfMonth(current); const monthEnd=endOfMonth(current); let cur=startOfWeek(new Date(monthStart)); const cells=[];
  while(cur<=monthEnd || cur.getDay()!==1){ const dayEvents=events.filter(ev=>inSameDay(ev.start,cur));
    const evHtml=dayEvents.slice(0,4).map(ev=>`<div class="cal-event" title="${ev.title}">${ev.title}</div>`).join('');
    const cell=document.createElement('div'); cell.className='cal-cell'; cell.innerHTML=`<div class="cal-date">${cur.toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div>${evHtml}`;
    cells.push(cell); cur=new Date(cur.getFullYear(),cur.getMonth(),cur.getDate()+1); }
  const headers=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>{ const h=document.createElement('div'); h.style.fontWeight='700'; h.style.textAlign='center'; h.textContent=x; return h; });
  headers.forEach(h=>container.appendChild(h)); headers.forEach(h=>container.appendChild(h)); cells.forEach(c=>container.appendChild(c));
}
async function populateEvents(){
  const cfg=await loadConfig(); const url=cfg.eventsCsvUrl; const listEl=document.getElementById('list'); const calEl=document.getElementById('calendar');
  if(!url){ listEl.innerHTML='<p class="meta">Configure your CSV link in config.json.</p>'; return; }
  const all=await loadEvents(url); const params=new URLSearchParams(location.search); const q=(params.get('q')||'').toLowerCase(); const catParam=(params.get('cat')||'').toLowerCase();
  const filtered=all.filter(e=>{ const hay=[e.title,e.description,e.address,e.category].join(' ').toLowerCase();
    const qOk=!q || hay.includes(q); const cOk=!catParam || (e.category||'').toLowerCase()===catParam; return qOk && cOk; }).sort((a,b)=>a.start-b.start);
  const cats=[...new Set(all.map(e=>e.category).filter(Boolean))].sort(); const catSel=document.getElementById('cat'); cats.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; catSel.appendChild(o); });
  listEl.innerHTML=filtered.map(eventCard).join('');
  let current=new Date(); function draw(){ renderCalendar(calEl,current,filtered); } draw();
  document.getElementById('prev').onclick=()=>{ current=new Date(current.getFullYear(),current.getMonth()-1,1); draw(); };
  document.getElementById('next').onclick=()=>{ current=new Date(current.getFullYear(),current.getMonth()+1,1); draw(); };
  document.getElementById('filterBtn').onclick=()=>{ const qv=document.getElementById('q').value.trim(); const cv=document.getElementById('cat').value;
    location.href=`events.html?q=${encodeURIComponent(qv)}&cat=${encodeURIComponent(cv)}`; };
}
document.addEventListener('DOMContentLoaded',()=>{ const on=(s)=>document.querySelector(s)!=null; if(on('#cards')) populateHome(); if(on('#calendar')) populateEvents(); });
