import {useState,useMemo} from 'react';
import {parse,num,pickAmount} from './money.js';
const CURS=['USD','EUR','GBP','BDT','INR','CAD','AUD','JPY'];
const FIELDS={amount:/earn|revenue|royalt|amount|commission|total/i,file:/file|asset|image|title|name/i,keyword:/keyword|search|term/i,niche:/niche|categor|topic/i,platform:/platform|agency|site|source/i,type:/type|media|content/i};
const DIMS=[['file','By file'],['keyword','By keyword'],['niche','By niche'],['platform','By platform'],['type','By content type']];
export default function Earnings(){
  const [cur,setCur]=useState('USD'),[data,setData]=useState([]),[map,setMap]=useState({}),[dim,setDim]=useState('file'),[names,setNames]=useState([]);
  async function load(files){
    let all=[...data],h=null;
    for(const f of files){const rows=parse(await f.text());if(rows.length<2)continue;h=rows[0].map(x=>x.trim());
      rows.slice(1).forEach(r=>all.push({__src:f.name.replace(/\.\w+$/,''),...Object.fromEntries(h.map((k,i)=>[k,r[i]]))}))}
    if(!h)return;setData(all);setNames(n=>[...n,...[...files].map(f=>f.name)]);
    const cols=Object.keys(all[0]).filter(k=>k!=='__src'),m={};
    for(const [k,re] of Object.entries(FIELDS))m[k]=k==='amount'?pickAmount(cols):cols.find(c=>re.test(c)&&!Object.values(m).includes(c))||'';
    setMap(m);
  }
  const cols=data[0]?Object.keys(data[0]).filter(k=>k!=='__src'):[];
  const total=useMemo(()=>data.reduce((s,r)=>s+(map.amount?num(r[map.amount]):0),0),[data,map]);
  const rows=useMemo(()=>{
    if(!map.amount)return [];const agg={};
    data.forEach(r=>{const a=num(r[map.amount]);
      const keys=dim==='platform'&&!map.platform?[r.__src]:map[dim]?(dim==='keyword'?String(r[map[dim]]||'').split(/[,;|]/):[r[map[dim]]]):[];
      keys.map(k=>String(k||'').trim()).filter(Boolean).forEach(k=>{agg[k]=(agg[k]||0)+a})});
    return Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,15)},[data,map,dim]);
  const max=rows[0]?.[1]||1,fm=n=>new Intl.NumberFormat(undefined,{style:'currency',currency:cur}).format(n);
  return(<div>
    <h1 className="font-sora text-2xl font-semibold">Earnings dashboard</h1>
    <p className="text-muted text-sm mb-5">Import sales CSVs from your agencies. Every number below is summed from the rows you import — nothing is estimated.</p>
    <label className="glass rounded-2xl border-dashed border-2 border-violet/40 p-8 text-center block cursor-pointer mb-5 hover:border-cyan/70 transition">
      <div className="font-sora">Choose one or more sales CSV files</div><div className="text-xs text-muted mt-1">{names.length?names.join(' · '):'Columns are detected automatically; you can fix the mapping below'}</div>
      <input type="file" accept=".csv,.tsv,.txt" multiple hidden onChange={e=>load(e.target.files)}/></label>
    {data.length>0&&<>
      <div className="glass rounded-2xl p-4 mb-5 grid gap-3 grid-cols-2 md:grid-cols-6 text-xs text-muted">
        {Object.keys(FIELDS).map(k=>(<label key={k} className="grid gap-1 capitalize">{k}
          <select value={map[k]||''} onChange={e=>setMap({...map,[k]:e.target.value})} className="bg-surface rounded-lg px-2 py-1.5 text-ink border border-violet/30"><option value="">(not in CSV)</option>{cols.map(c=><option key={c}>{c}</option>)}</select></label>))}</div>
      <div className="grid sm:grid-cols-3 gap-3 mb-5">{[['Total earnings',map.amount?fm(total):'—'],['Rows imported',data.length],['Sales files',names.length]].map(([l,v])=>(
        <div key={l} className="glass rounded-2xl p-4"><div className="text-xs text-muted">{l}</div><div className="font-sora text-2xl mt-1">{v}</div></div>))}</div>
      <label className="flex items-center gap-2 text-xs text-muted mb-4">Currency of your CSV<select value={cur} onChange={e=>setCur(e.target.value)} className="bg-surface rounded-lg px-2 py-1.5 text-ink border border-violet/30">{CURS.map(c=><option key={c}>{c}</option>)}</select><span>(display only — no conversion)</span></label>
      <div className="flex flex-wrap gap-2 mb-4">{DIMS.map(([k,l])=>(<button key={k} onClick={()=>setDim(k)} className={`px-3 py-1.5 rounded-full border text-xs ${dim===k?'border-cyan text-cyan bg-cyan/10':'border-muted/30 text-muted'}`}>{l}</button>))}</div>
      <div className="glass rounded-2xl p-4 grid gap-2">
        {!map.amount&&<div className="text-sm text-amber">Pick which column holds the earnings amount.</div>}
        {map.amount&&!rows.length&&<div className="text-sm text-muted">No “{dim}” data in these CSVs — map a column above if one exists.</div>}
        {rows.map(([k,v])=>(<div key={k} className="grid grid-cols-[minmax(80px,200px)_1fr_80px] gap-3 items-center text-sm fade">
          <div className="truncate" title={k}>{k}</div><div className="h-3 rounded-full bg-surface overflow-hidden"><div className="h-full btn" style={{width:Math.max(2,v/max*100)+'%'}}/></div><div className="text-right font-mono text-xs">{fm(v)}</div></div>))}
        {dim==='keyword'&&rows.length>0&&<div className="text-[11px] text-muted mt-2">A sale is counted under every keyword in its row, so keyword totals overlap and add up to more than the real total.</div>}</div></>}
  </div>);
}
