import JSZip from 'jszip';
import {PLATFORMS} from './platforms.config.js';
export {PLATFORMS};
const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;
export function buildCSV(id,items,ai){
  const p=PLATFORMS[id];
  const rows=items.filter(i=>i.status==='done').map(i=>{
    const description=i.description.slice(0,p.descMax),title=i.title.slice(0,p.titleMax);
    const ctx={filename:i.file.name,title,description,descriptionOrTitle:description||title,keywords:i.keywords.slice(0,p.kwMax).join(p.kwSeparator),
      aiPrompt:ai?description:'',aiModel:ai?'AI-generated':'',isVector:/\.(svg|eps|ai)$/i.test(i.file.name)?'yes':'no'};
    return p.columns.map(([,s])=>s.startsWith('=')?s.slice(1):ctx[s]??'');
  });
  return '\uFEFF'+[p.columns.map(c=>c[0]),...rows].map(r=>r.map(q).join(p.delimiter)).join('\r\n');
}
export function zipFiles(ids,items,ai){const z=new JSZip();ids.forEach(id=>z.file(`${id}.csv`,buildCSV(id,items,ai)));return z}
export const save=(blob,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
export const downloadOne=(id,items,ai)=>save(new Blob([buildCSV(id,items,ai)],{type:'text/csv;charset=utf-8'}),`${id}.csv`);
// Browsers block several automatic downloads, so auto-download is a single ZIP.
export async function downloadZip(ids,items,ai){save(await zipFiles(ids,items,ai).generateAsync({type:'blob'}),'rob-metadata-all.zip')}
