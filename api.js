import {save} from './csv.js';
export async function fetchPreview(file){
  const fd=new FormData();fd.append('file',file);
  const r=await fetch('/api/preview',{method:'POST',body:fd}),j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.error||'Preview failed');return j;
}
export async function embedZip(items){
  const jp=items.filter(i=>i.status==='done'&&/\.jpe?g$/i.test(i.file.name));
  if(!jp.length)throw new Error('No finished JPG files to embed into');
  const fd=new FormData();jp.forEach(i=>fd.append('files',i.file));
  fd.append('meta',JSON.stringify(jp.map(i=>({title:i.title,description:i.description,keywords:i.keywords}))));
  const r=await fetch('/api/embed',{method:'POST',body:fd});
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'Embedding failed');
  save(await r.blob(),'rob-embedded-jpgs.zip');return jp.length;
}
