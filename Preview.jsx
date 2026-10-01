import {useState} from 'react';
const CHECK={backgroundColor:'#fff',backgroundImage:'linear-gradient(45deg,#cfd3e0 25%,transparent 25%,transparent 75%,#cfd3e0 75%),linear-gradient(45deg,#cfd3e0 25%,transparent 25%,transparent 75%,#cfd3e0 75%)',backgroundSize:'20px 20px',backgroundPosition:'0 0,10px 10px'};
export default function Preview({it,onClose}){
  const [z,setZ]=useState(1),[chk,setChk]=useState(true),i=it.info,src=it.previewUrl||it.url;
  const txt=!i||i.textOutlined==null?'unknown':i.textOutlined?'outlined (no live text found)':`live text${i.fonts?` — ${i.fonts} font(s)`:''}: outline it before upload`;
  const rows=i?[['Format',i.format],['Size',i.size||'—'],['Preview pixels',`${i.width} × ${i.height}`],['Colour mode',i.colorMode],['Text',txt],['Embedded rasters',i.rasters==null?'unknown':i.rasters]]:[['File',it.file.name]];
  const zoom=d=>setZ(v=>Math.min(8,Math.max(.25,+(v*d).toFixed(2))));
  return(<div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-3 md:p-8 grid place-items-center" onClick={onClose}>
    <div className="glass rounded-2xl w-full max-w-5xl max-h-full flex flex-col overflow-hidden fade" onClick={e=>e.stopPropagation()}>
      <div className="flex items-center gap-2 p-3 border-b border-violet/20 text-sm flex-wrap">
        <span className="truncate font-sora flex-1 min-w-0">{it.file.name}</span>
        <button className="px-2.5 py-1 rounded-lg border border-muted/30" onClick={()=>zoom(1/1.25)}>−</button>
        <span className="w-12 text-center font-mono text-xs">{Math.round(z*100)}%</span>
        <button className="px-2.5 py-1 rounded-lg border border-muted/30" onClick={()=>zoom(1.25)}>+</button>
        <button className="px-2.5 py-1 rounded-lg border border-muted/30 text-xs" onClick={()=>setZ(1)}>Fit</button>
        <button className={`px-2.5 py-1 rounded-lg border text-xs ${chk?'border-cyan text-cyan':'border-muted/30 text-muted'}`} onClick={()=>setChk(!chk)}>Checkerboard</button>
        <button className="px-2.5 py-1 text-muted" onClick={onClose}>✕</button></div>
      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        <div className="flex-1 overflow-auto min-h-[240px]" style={chk?CHECK:{background:'#0B0F1A'}} onWheel={e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();zoom(e.deltaY<0?1.1:1/1.1)}}}>
          {src?<img src={src} alt="" style={{width:`${z*100}%`,maxWidth:'none',display:'block',margin:'0 auto'}}/>:<div className="p-10 text-muted text-sm">No preview available</div>}</div>
        <dl className="md:w-64 p-4 grid gap-2 text-sm content-start border-t md:border-t-0 md:border-l border-violet/20">
          {rows.map(([k,v])=>(<div key={k}><dt className="text-[11px] text-muted">{k}</dt><dd>{String(v)}</dd></div>))}
          {i&&<p className="text-[11px] text-muted mt-2">Colour, text and raster checks read the file's own data and are best-effort — confirm in your editor.</p>}</dl></div></div></div>);
}
