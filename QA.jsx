import {useState} from 'react';
import {gray,sharpness,noiseLevel,blurVerdict} from './qaMath.js';
const img=f=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=URL.createObjectURL(f)});
const px=(i,w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(i,0,0,w,h);return x.getImageData(0,0,w,h).data};
function dhash(i){const g=gray(px(i,9,8));let s='';for(let y=0;y<8;y++)for(let x=0;x<8;x++)s+=g[y*9+x]>g[y*9+x+1]?1:0;return s}
const ham=(a,b)=>[...a].filter((c,i)=>c!==b[i]).length;
const scan=(i,size)=>{const k=Math.min(1,size/Math.max(i.width,i.height)),w=Math.round(i.width*k),h=Math.round(i.height*k);return [gray(px(i,w,h)),w,h]};
async function check(it){
  const r=[],f=it.file,add=(sev,msg,fix)=>r.push({sev,msg,fix});let score=0,hash=null;
  if(/^video\//.test(f.type)){
    const v=document.createElement('video');v.src=URL.createObjectURL(f);await new Promise(o=>{v.onloadedmetadata=o;v.onerror=o});
    if(v.videoHeight<720){score+=45;add(3,`Resolution ${v.videoWidth}×${v.videoHeight}`,'Most agencies want at least 1920×1080 (check your platform).')}
    if(v.duration>60||v.duration<4){score+=15;add(1,`Duration ${v.duration.toFixed(1)}s`,'Typical clip length is 5–60 seconds.')}
    if(!r.length)add(0,`${v.videoWidth}×${v.videoHeight}, ${v.duration.toFixed(1)}s — basic specs look fine`);
    add(0,'Blur/AI-artifact checks on video are not done — review frames yourself.');
  }else if(/svg$/i.test(f.name)||f.type==='image/svg+xml'){
    const t=await f.text(),txt=(t.match(/<text[\s>]/g)||[]).length,open=(t.match(/<path[^>]*\sd="[^"]*"/g)||[]).filter(p=>!/[zZ]\s*["\s]/.test(p.slice(p.indexOf(' d="')))).length,ras=(t.match(/<image[\s>]/g)||[]).length;
    if(txt){score+=35;add(3,`${txt} live text element(s)`,'Convert all text to outlines before upload.')}
    if(ras){score+=30;add(3,`${ras} embedded raster image(s)`,'Vectors must not contain embedded bitmaps.')}
    if(open>3){score+=15;add(1,`${open} paths without a close command`,'Fine for strokes; close paths used as filled shapes.')}
    if(!r.length)add(0,'No live text, embedded bitmaps or obvious open paths found');
    const i=await img(f).catch(()=>0);if(i)hash=dhash(i);
  }else{
    const i=await img(f),mp=i.width*i.height/1e6;
    if(mp<4){score+=mp<1?60:40;add(3,`${mp.toFixed(1)} MP (${i.width}×${i.height})`,'Most agencies want 4 MP or more — upscale only with a quality upscaler.')}
    const bv=blurVerdict(sharpness(...scan(i,512))),noise=noiseLevel(...scan(i,1024));
    if(bv==='blurry'){score+=30;add(3,'Looks blurry (soft edges)','Check focus at 100% zoom; skip if the whole frame is soft.')}else if(bv==='soft'){score+=10;add(1,'Slightly soft','Gentle sharpening or a focus check can help.')}else if(bv==='skip')add(0,'Few hard edges (flat colour, bokeh or smooth art) — blur check skipped');
    if(noise>5){score+=25;add(3,`High noise (${noise.toFixed(1)})`,'Run denoise; lower ISO next time.')}else if(noise>3.5){score+=10;add(1,`Some noise (${noise.toFixed(1)})`,'Light denoise recommended.')}
    if(!r.length)add(0,`${mp.toFixed(1)} MP, sharp and clean by these estimates`);
    hash=dhash(i);
  }
  return {id:it.id,name:f.name,hash,score:Math.min(100,score),r};
}
export default function QA({items}){
  const [res,setRes]=useState([]),[busy,setBusy]=useState(false);
  async function run(){
    setBusy(true);const out=[];
    for(const it of items){try{out.push(await check(it))}catch{out.push({id:it.id,name:it.file.name,score:0,r:[{sev:1,msg:'Could not read this file',fix:'Open it in an editor to confirm it is not corrupt.'}]})}}
    out.forEach((a,i)=>out.slice(0,i).forEach(b=>{if(a.hash&&b.hash&&ham(a.hash,b.hash)<=6){a.score=Math.min(100,a.score+25);a.r.push({sev:3,msg:`Near-duplicate of ${b.name}`,fix:'Keep the best one; agencies reject near-identical files.'})}}));
    setRes(out);setBusy(false);
  }
  const col=s=>s>=60?'text-bad border-bad/50':s>=30?'text-amber border-amber/50':'text-ok border-ok/50';
  return(<div>
    <h1 className="font-sora text-2xl font-semibold">QA checker</h1>
    <p className="text-muted text-sm mb-5">Resolution, blur, noise, near-duplicates, SVG text/bitmaps and video specs. Scores are estimates from local pixel analysis — they are not an agency verdict. Logo and AI-artifact (hands, text) checks need a vision model and are not included yet.</p>
    <button className="btn rounded-2xl px-5 py-2.5 text-sm font-medium mb-5 flex gap-2 items-center" disabled={!items.length||busy} onClick={run}>{busy&&<span className="orb"/>}{items.length?`Check ${items.length} file(s)`:'Add files in the Metadata tab first'}</button>
    <div className="grid gap-3">{res.map(a=>(<div key={a.id} className="glass rounded-2xl p-4 fade">
      <div className="flex items-center gap-3"><div className={`w-14 h-14 rounded-full border-2 grid place-items-center font-sora font-semibold ${col(a.score)}`}>{a.score}</div>
        <div className="min-w-0"><div className="truncate text-sm">{a.name}</div><div className="text-[11px] text-muted">rejection risk (0–100)</div></div></div>
      <ul className="mt-3 grid gap-1.5 text-sm">{a.r.map((x,i)=>(<li key={i} className="flex gap-2"><span className={x.sev>=3?'text-bad':x.sev?'text-amber':'text-ok'}>●</span><span>{x.msg}{x.fix&&<span className="text-muted"> — {x.fix}</span>}</span></li>))}</ul></div>))}</div></div>);
}
