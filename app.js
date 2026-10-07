const CSV_URL='https://docs.google.com/spreadsheets/d/e/2PACX-1vQ3eRD8tFqAuG4BC4UId4qCwWN_Z_X0l3JACATTEUK4O6I2DzkqWjCVRynQfrIfzBRQZsI2CYobKqaE/pub?gid=835584076&single=true&output=csv';
const SPARQL=`SELECT ?item ?itemLabel ?coord ?wikiTitle WHERE {
  ?item wdt:P31 wd:Q4504104; wdt:P625 ?coord.
  ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?wikiTitle.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 300`;
const SITE='https://haunted-atlas.suvadipchakraborty.workers.dev/';

const SKULL=c=>`<svg viewBox="0 0 24 24"><path d="M12 2C7 2 4 5.5 4 10c0 3 1.5 4.8 3 5.8V19h2v-2h2v2h2v-2h2v2h2v-3.2c1.5-1 3-2.800 3-5.800 0-4.500-3-8-8-8z" fill="#050505" stroke="${c}" stroke-width="1.5"/><circle cx="8.800" cy="10.500" r="2" fill="${c}"/><circle cx="15.200" cy="10.500" r="2" fill="${c}"/></svg>`;
const GHOST=c=>`<svg viewBox="0 0 24 24"><path d="M12 3C8 3 5.500 6 5.500 10v10l2.200-1.800L10 20l2-1.800L14 20l2.300-1.800L18.500 20V10C18.500 6 16 3 12 3z" fill="${c}" fill-opacity=".25" stroke="${c}" stroke-width="1.500"/><circle cx="9.800" cy="10" r="1.400" fill="${c}"/><circle cx="14.200" cy="10" r="1.400" fill="${c}"/></svg>`;
const icon=(cls,svg)=>L.divIcon({className:'',html:`<div class="pin ${cls}">${svg}</div>`,iconSize:[30,30],iconAnchor:[15,15]});
const redIcon=icon('red',SKULL('#ff1a1a')), greenIcon=icon('green',GHOST('#00FF41'));

const map=L.map('map',{worldCopyJump:true,zoomControl:false}).setView([39,-60],3);
L.control.zoom({position:'topright'}).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19,subdomains:'abcd',attribution:'&copy; OpenStreetMap &copy; CARTO'}).addTo(map);
const usLayer=L.layerGroup().addTo(map);
const glLayer=L.layerGroup().addTo(map);
let total=0;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num=v=>{const n=parseFloat(String(v??'').trim());return isFinite(n)?n:null;};
function updateCount(){$('count').textContent=total+' FILES ON RECORD';}

// ---- Source 1: US CSV
function loadUS(){
  Papa.parse(CSV_URL,{download:true,header:true,skipEmptyLines:true,complete:({data})=>{
    data.forEach(r=>{
      let lat=num(r.latitude),lng=num(r.longitude);
      if(lat===null||lng===null){lat=num(r.city_latitude);lng=num(r.city_longitude);} // fallback to city coords
      if(lat===null||lng===null||Math.abs(lat)>90||Math.abs(lng)>180)return;
      const name=(r.location||'').trim()||(r.city||'Unknown Location');
      const place=[r.city,r.state||r.state_abbrev].filter(Boolean).join(', ');
      const m=L.marker([lat,lng],{icon:redIcon,title:name});
      m.on('click',()=>openCase({name,lat,lng,tag:'US',sub:place,text:(r.description||'').trim()||'No details have been declassified.'}));
      m.addTo(usLayer);total++;
    });
    if(!map.hasLayer(usLayer))usLayer.addTo(map);
    updateCount();
  },error:()=>{$('count').textContent='US ARCHIVE OFFLINE';}});
}

// ---- Source 2: Wikidata
async function loadGlobal(){
  try{
    const res=await fetch('https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(SPARQL),{headers:{Accept:'application/sparql-results+json'}});
    const j=await res.json();const seen=new Set();
    j.results.bindings.forEach(b=>{
      const mt=/Point\(([-\d.eE+]+) ([-\d.eE+]+)\)/.exec(b.coord.value);if(!mt)return;
      const lng=+mt[1],lat=+mt[2],title=b.wikiTitle.value;
      if(seen.has(title))return;seen.add(title);
      const name=b.itemLabel?.value||title;
      const m=L.marker([lat,lng],{icon:greenIcon,title:name});
      m.on('click',()=>openCase({name,lat,lng,tag:'GLOBAL',wiki:title}));
      m.addTo(glLayer);total++;
    });
    updateCount();
  }catch(e){console.warn('Wikidata failed',e);}
}

// ---- Case file modal
let current=null;
async function openCase(c){
  current=c;
  $('mTitle').textContent=c.name;
  $('mTag').textContent='// '+c.tag;
  $('mCoords').textContent=(c.sub?c.sub+' — ':'')+'LAT '+c.lat.toFixed(4)+' / LON '+c.lng.toFixed(4);
  const img=$('mImg');img.hidden=true;img.removeAttribute('src');
  $('mText').textContent=c.text||'Decrypting file…';
  $('modal').classList.add('open');$('modal').setAttribute('aria-hidden','false');
  if(c.wiki&&!c.text){
    try{
      const r=await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(c.wiki.replace(/ /g,'_')));
      const d=await r.json();
      if(current!==c)return;
      c.text=d.extract||'No details have been declassified.';
      c.url=d.content_urls?.desktop?.page;
      $('mText').textContent=c.text;
      if(d.thumbnail?.source){img.src=d.thumbnail.source;img.alt=c.name;img.hidden=false;}
    }catch(e){if(current===c)$('mText').textContent='FILE CORRUPTED. Could not retrieve the case narrative.';}
  }
}
function closeCase(){$('modal').classList.remove('open');$('modal').setAttribute('aria-hidden','true');}
$('closeBtn').onclick=closeCase;
$('modal').addEventListener('click',e=>{if(e.target.id==='modal')closeCase();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCase();});
$('shareBtn').onclick=async()=>{
  if(!current)return;
  const data={title:'Haunted Atlas: '+current.name,text:`Read the classified case file on ${current.name} from the Haunted Atlas!`,url:SITE};
  if(navigator.share){try{await navigator.share(data);}catch(e){}}
  else{try{await navigator.clipboard.writeText(data.text+' '+data.url);alert('Link copied to clipboard.');}catch(e){prompt('Copy this link:',data.url);}}
};

// ---- Tabs
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x===b));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.id==='tab-'+b.dataset.tab));
  if(b.dataset.tab==='atlas')setTimeout(()=>map.invalidateSize(),50);
  closeCase();
});

// ---- PWA
let deferred=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;});
window.addEventListener('appinstalled',()=>{$('installNote').textContent='Installed. Check your home screen.';deferred=null;});
$('installBtn').onclick=async()=>{
  if(deferred){deferred.prompt();await deferred.userChoice;deferred=null;}
  else if(matchMedia('(display-mode: standalone)').matches)$('installNote').textContent='Already running as an installed app.';
  else $('installNote').textContent='Use your browser menu → "Add to Home Screen" / "Install app".';
};
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));

loadUS();loadGlobal();
