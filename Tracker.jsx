import {useEffect,useState} from 'react';
import {PLATFORMS} from './csv.js';
const ST={pending:'text-muted border-muted/40',approved:'text-ok border-ok/50',rejected:'text-bad border-bad/50'};
export default function Tracker({items}){
  const [db,setDb]=useState(()=>{try{return JSON.parse(localStorage.getItem('rob-tracker'))||{}}catch{return{}}}),[nm,setNm]=useState('');
  useEffect(()=>{try{localStorage.setItem('rob-tracker',JSON.stringify(db))}catch{}},[db]);
  const names=[...new Set([...items.map(i=>i.file.name),...Object.keys(db)])];
  const set=(f,p,patch)=>setDb(d=>({...d,[f]:{...d[f],[p]:{s:'pending',n:'',...d[f]?.[p],...patch}}}));
  const all=names.flatMap(f=>Object.keys(PLATFORMS).map(p=>db[f]?.[p]?.s||null)).filter(Boolean);
  const cnt=s=>all.filter(x=>x===s).length;
  return(<div>
    <h1 className="font-sora text-2xl font-semibold">Upload tracker</h1>
    <p className="text-muted text-sm mb-5">Mark each file per platform. Saved in this browser. Files from the Metadata tab appear here automatically.</p>
    <div className="grid grid-cols-3 gap-3 mb-5">{['pending','approved','rejected'].map(s=>(<div key={s} className="glass rounded-2xl p-4"><div className="text-xs text-muted capitalize">{s}</div><div className={`font-sora text-2xl ${ST[s].split(' ')[0]}`}>{cnt(s)}</div></div>))}</div>
    <div className="flex gap-2 mb-5"><input value={nm} onChange={e=>setNm(e.target.value)} placeholder="Add a file name manually" className="flex-1 bg-surface rounded-xl px-3 py-2 text-sm border border-violet/30 outline-none"/>
      <button className="btn rounded-xl px-4 text-sm" onClick={()=>{if(nm.trim()){setDb(d=>({...d,[nm.trim()]:d[nm.trim()]||{}}));setNm('')}}}>Add</button></div>
    <div className="grid gap-3">{names.map(f=>(<div key={f} className="glass rounded-2xl p-4 fade"><div className="text-sm mb-3 truncate">{f}</div>
      <div className="grid gap-2 md:grid-cols-2">{Object.entries(PLATFORMS).map(([id,p])=>{const c=db[f]?.[id]||{s:'',n:''};return(
        <div key={id} className="flex gap-2 items-center"><span className="w-24 text-xs text-muted shrink-0">{p.name}</span>
          <select value={c.s} onChange={e=>set(f,id,{s:e.target.value})} className={`bg-surface rounded-lg px-2 py-1.5 text-xs border ${ST[c.s]||'border-muted/20 text-muted'}`}><option value="">not sent</option><option value="pending">pending</option><option value="approved">approved</option><option value="rejected">rejected</option></select>
          {c.s==='rejected'&&<input value={c.n} onChange={e=>set(f,id,{n:e.target.value})} placeholder="Reason" className="flex-1 min-w-0 bg-surface rounded-lg px-2 py-1.5 text-xs border border-bad/40 outline-none"/>}</div>)})}</div></div>))}</div></div>);
}
