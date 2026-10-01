import {useRef,useState} from 'react';
import {PLATFORMS,downloadOne,downloadZip} from './csv.js';
import Preview from './Preview.jsx';import {embedZip,fetchPreview} from './api.js';
import QA from './QA.jsx';import Earnings from './Earnings.jsx';import Tracker from './Tracker.jsx';

const Logo=()=>(<div className="leading-none select-none">
  <div className="font-sora font-bold text-3xl tracking-tight flex items-center">R
   <span className="mx-0.5 inline-block w-7 h-7 rounded-full" style={{background:'radial-gradient(circle,#0B0F1A 46%,transparent 48%),conic-gradient(from 200deg,#7C3AED,#22D3EE,#7C3AED)',boxShadow:'0 0 18px #7C3AEDcc,0 0 6px #22D3EE'}}/>
   B<span className="text-amber" style={{textShadow:'0 0 12px #FFB020'}}>!</span></div>
  <div className="mt-1 text-[9px] tracking-[0.32em] uppercase text-muted">Graphics Stock Tool</div></div>);
const NAV=[['✦','Metadata',1],['↗','Trends'],['✓','QA Checker',1],['$','Earnings',1],['☰','Tracker',1]];
let uid=0;

export default function App(){
  const [tab,setTab]=useState('Metadata'),[view,setView]=useState(null),[embedMsg,setEmbedMsg]=useState(''),[items,setItems]=useState([]),[provider,setProvider]=useState('gemini'),[ai,setAi]=useState(false),[lock,setLock]=useState(true),
        [plats,setPlats]=useState(['adobe','shutterstock']),[auto,setAuto]=useState(true),[busy,setBusy]=useState(false),[drag,setDrag]=useState(null);
  const ref=useRef(),list=useRef([]);
  const sync=fn=>{list.current=fn(list.current);setItems(list.current)};
  const patch=(id,p)=>sync(l=>l.map(i=>i.id===id?{...i,...p}:i));

  const pq=useRef(Promise.resolve());
  const add=fs=>{
    const fresh=[...fs].filter(f=>/^(image|video)\//.test(f.type)||/\.(eps|ai|svg)$/i.test(f.name)).map(file=>({id:++uid,file,url:/^(image|video)\//.test(file.type)?URL.createObjectURL(file):null,status:'pending',title:'',description:'',keywords:[]}));
    sync(l=>[...l,...fresh]);
    fresh.filter(i=>/\.(eps|ai|svg)$/i.test(i.file.name)).forEach(it=>{pq.current=pq.current.then(async()=>{try{const j=await fetchPreview(it.file);patch(it.id,{previewUrl:j.preview,info:j.info})}catch(e){patch(it.id,{previewError:e.message,status:'error',error:e.message})}})});
  };
  async function embed(){setEmbedMsg('Embedding…');try{const n=await embedZip(list.current);setEmbedMsg(`Embedded metadata into ${n} JPG file(s) — ZIP downloaded`)}catch(e){setEmbedMsg(e.message)}}

  async function one(it){
    patch(it.id,{status:'working',error:''});
    try{
      const fd=new FormData();fd.append('file',it.file);fd.append('provider',provider);fd.append('ai',ai);
      const r=await fetch('/api/generate',{method:'POST',body:fd}),j=await r.json();
      if(!r.ok)throw new Error(j.error);
      const old=list.current.find(x=>x.id===it.id).keywords;
      const keywords=lock&&old.length?[...old.slice(0,10),...j.keywords.filter(k=>!old.slice(0,10).includes(k))].slice(0,49):j.keywords;
      patch(it.id,{...j,keywords,status:'done'});
    }catch(e){patch(it.id,{status:'error',error:e.message})}
  }
  async function start(){
    setBusy(true);
    const todo=list.current.filter(i=>i.status==='pending'||i.status==='error');
    const cfg=await fetch('/api/providers').then(r=>r.json()).catch(()=>({}));
    let n=0;await Promise.all(Array.from({length:Math.max(1,cfg.concurrency||2)}).map(async()=>{while(n<todo.length)await one(todo[n++])}));
    setBusy(false);
    if(auto&&list.current.some(i=>i.status==='done'))downloadZip(plats,list.current,ai);
  }
  const move=(id,from,to)=>{if(lock&&(from<10||to<10)||from===to)return;
    const it=list.current.find(i=>i.id===id),k=[...it.keywords],[x]=k.splice(from,1);k.splice(to,0,x);patch(id,{keywords:k})};
  const done=items.filter(i=>i.status==='done').length,pct=items.length?Math.round(done/items.length*100):0;
  const tog=id=>setPlats(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  return(<div className="flex min-h-screen">
    <aside className="hidden md:flex w-60 flex-col gap-1 p-5 bg-surface/80 border-r border-violet/20">
      <div className="mb-8"><Logo/></div>
      {NAV.map(([ic,n,on])=>(<button key={n} disabled={!on} onClick={()=>setTab(n)} className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm text-left transition ${tab===n?'glass text-ink':on?'text-muted hover:text-ink':'text-muted/50'}`}>
        <span className={tab===n?'text-cyan':''}>{ic}</span>{n}{!on&&<span className="ml-auto text-[10px] border border-muted/30 rounded-full px-2">soon</span>}</button>))}
    </aside>
    {tab!=='Metadata'?<main className="flex-1 p-4 md:p-8 max-w-6xl w-full"><div className="md:hidden mb-5"><Logo/></div><div className="md:hidden flex gap-2 mb-5 overflow-x-auto">{NAV.filter(n=>n[2]).map(n=><button key={n[1]} onClick={()=>setTab(n[1])} className={`px-3 py-1.5 rounded-full border text-xs whitespace-nowrap ${tab===n[1]?'border-cyan text-cyan':'border-muted/30 text-muted'}`}>{n[1]}</button>)}</div>{tab==='QA Checker'?<QA items={items}/>:tab==='Earnings'?<Earnings/>:<Tracker items={items}/>}</main>:<main className="flex-1 p-4 md:p-8 max-w-6xl w-full">
      <div className="md:hidden mb-5"><Logo/></div><div className="md:hidden flex gap-2 mb-5 overflow-x-auto">{NAV.filter(n=>n[2]).map(n=><button key={n[1]} onClick={()=>setTab(n[1])} className="px-3 py-1.5 rounded-full border text-xs border-muted/30 text-muted whitespace-nowrap">{n[1]}</button>)}</div>
      <h1 className="font-sora text-2xl font-semibold">Metadata generator</h1>
      <p className="text-muted text-sm mb-6">Drop your files, pick the platforms, get ready-to-upload CSVs.</p>

      <div className="glass rounded-2xl p-4 grid gap-4 md:grid-cols-4 text-sm mb-5">
        <label className="grid gap-1 text-muted">AI provider
          <select value={provider} onChange={e=>setProvider(e.target.value)} className="bg-surface rounded-xl px-3 py-2 text-ink border border-violet/30">
            <option value="gemini">Gemini (free)</option><option value="groq">Groq</option><option value="openrouter">OpenRouter</option><option value="ollama">Ollama (local)</option></select></label>
        <div className="md:col-span-2 grid gap-1 text-muted">Platforms
          <div className="flex flex-wrap gap-2">{Object.entries(PLATFORMS).map(([id,p])=>(<button key={id} onClick={()=>tog(id)} className={`px-3 py-1.5 rounded-full border text-xs transition ${plats.includes(id)?'border-cyan text-cyan bg-cyan/10':'border-muted/30 text-muted'}`}>{p.name}</button>))}</div><div className="text-[11px] text-amber/90">Column layouts live in <span className="font-mono">platforms.config.js</span>. {plats.some(id=>!PLATFORMS[id].verified)?`Verify ${plats.filter(id=>!PLATFORMS[id].verified).map(id=>PLATFORMS[id].name).join(' and ')} columns against the platform's current template before uploading.`:'Always compare with the platform\'s current template before a big upload.'}</div></div>
        <div className="grid gap-1.5 text-ink">
          {[['AI-generated content',ai,setAi],['Lock top 10 keywords',lock,setLock],['Auto-download ZIP',auto,setAuto]].map(([l,v,s])=>(<label key={l} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={v} onChange={e=>s(e.target.checked)} className="accent-violet"/>{l}</label>))}</div>
      </div>

      <div onClick={()=>ref.current.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();add(e.dataTransfer.files)}}
        className="glass rounded-2xl border-dashed border-2 border-violet/40 hover:border-cyan/70 transition p-10 text-center cursor-pointer mb-5">
        <div className="font-sora text-lg">Drop photos, vectors or videos here</div>
        <div className="text-muted text-xs mt-1">JPG · PNG · SVG · EPS · AI · MP4 / MOV — hundreds at a time</div>
        <input ref={ref} type="file" multiple hidden onChange={e=>add(e.target.files)}/></div>

      {items.length>0&&<div className="flex flex-wrap items-center gap-3 mb-5">
        <button className="btn rounded-2xl px-5 py-2.5 font-medium text-sm flex items-center gap-2" disabled={busy} onClick={start}>{busy&&<span className="orb"/>}{busy?'Generating…':'Generate metadata'}</button>
        <button className="rounded-2xl px-4 py-2.5 text-sm border border-cyan/40 text-cyan disabled:opacity-30" disabled={!done} onClick={()=>downloadZip(plats,list.current,ai)}>Download ZIP (all CSVs)</button>
        <button className="rounded-2xl px-4 py-2.5 text-sm border border-amber/50 text-amber disabled:opacity-30" disabled={!done} onClick={embed}>Embed IPTC/XMP into JPGs</button><span className="text-xs text-cyan">{embedMsg}</span>
        {plats.map(id=><button key={id} className="rounded-2xl px-3 py-2.5 text-xs border border-muted/30 text-muted hover:text-ink disabled:opacity-30" disabled={!done} onClick={()=>downloadOne(id,list.current,ai)}>{PLATFORMS[id].name} CSV</button>)}
        <button className="text-muted text-sm ml-auto" onClick={()=>sync(()=>[])}>Clear all</button>
        <div className="w-full h-1.5 rounded-full bg-surface overflow-hidden"><div className="h-full btn transition-all" style={{width:pct+'%'}}/></div>
        <div className="text-xs text-muted -mt-2">{done} / {items.length} done</div></div>}

      <div className="grid gap-4">{items.map(it=>(<div key={it.id} className="glass rounded-2xl p-4 flex gap-4 fade flex-col sm:flex-row">
        <div className="w-full sm:w-36 shrink-0">
          <div className="aspect-square rounded-xl overflow-hidden bg-surface grid place-items-center text-xs text-muted">
            {it.previewUrl||it.url?(it.file.type.startsWith('video')?<video src={it.url} className="w-full h-full object-cover" muted/>:<img src={it.previewUrl||it.url} className="w-full h-full object-contain"/>):it.previewError?<span className="text-bad px-2 text-center text-[11px]">{it.previewError}</span>:/\.(eps|ai)$/i.test(it.file.name)?'Rendering…':'—'}</div>
          <div className="mt-2 text-[11px] text-muted truncate">{it.file.name}</div>{(it.previewUrl||it.url)&&<button className="mt-1 text-[11px] text-cyan" onClick={()=>setView(it)}>Preview &amp; info</button>}</div>
        <div className="flex-1 min-w-0">
          {it.status==='pending'&&<div className="text-muted text-sm">Waiting…</div>}
          {it.status==='working'&&<div className="flex items-center gap-2 text-sm text-cyan"><span className="orb"/>Reading the file…</div>}
          {it.status==='error'&&<div className="text-sm text-bad flex gap-3 items-center flex-wrap">{it.error}<button className="border border-bad/50 rounded-full px-3 py-1 text-xs" onClick={()=>one(it)}>Retry</button></div>}
          {it.status==='done'&&<div className="grid gap-2">
            <div><input value={it.title} onChange={e=>patch(it.id,{title:e.target.value})} className="w-full bg-surface rounded-xl px-3 py-2 font-sora text-sm border border-transparent focus:border-violet outline-none"/>
              <div className={`text-[10px] text-right ${it.title.length>70?'text-bad':'text-muted'}`}>{it.title.length}/70</div></div>
            <div><textarea rows={2} value={it.description} onChange={e=>patch(it.id,{description:e.target.value})} className="w-full bg-surface rounded-xl px-3 py-2 text-sm border border-transparent focus:border-violet outline-none resize-none"/>
              <div className={`text-[10px] text-right ${it.description.length>200?'text-bad':'text-muted'}`}>{it.description.length}/200</div></div>
            <div className="flex flex-wrap gap-1.5">{it.keywords.map((k,i)=>(<span key={k} draggable={!(lock&&i<10)} onDragStart={()=>setDrag({id:it.id,i})} onDragOver={e=>e.preventDefault()} onDrop={()=>drag?.id===it.id&&move(it.id,drag.i,i)}
              className={`font-mono text-[11px] px-2 py-1 rounded-lg border flex items-center gap-1 ${i<10?'border-amber/60 text-amber bg-amber/10':'border-muted/25 text-ink/80 bg-surface'} ${lock&&i<10?'':'cursor-grab'}`}>
              {i<10&&<b className="opacity-60">{i+1}</b>}{k}<button className="opacity-40 hover:opacity-100" onClick={()=>patch(it.id,{keywords:it.keywords.filter((_,x)=>x!==i)})}>×</button></span>))}</div>
            <div className="flex justify-between text-[11px] text-muted"><span>{it.keywords.length}/49 keywords</span><button className="text-cyan" onClick={()=>one(it)}>Regenerate</button></div></div>}
        </div></div>))}</div>
    </main>}{view&&<Preview it={list.current.find(i=>i.id===view.id)||view} onClose={()=>setView(null)}/>}</div>);
}
