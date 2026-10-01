import 'dotenv/config';
import express from 'express';import cors from 'cors';import multer from 'multer';import sharp from 'sharp';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import JSZip from 'jszip';
import {renderPreview,kindOf,PreviewError} from './preview.js';import {embedFile} from './embed.js';import {findBin} from './tools.js';
import {clean,topUp,PROMPT,FOLLOWUP,parseJSON,retry,modelError,concurrency,removeFile} from './lib.js';
const run=promisify(execFile),e=process.env,app=express();
app.use(cors());
// Uploads go to disk (not RAM) and are deleted right after processing.
const up=multer({storage:multer.diskStorage({destination:os.tmpdir(),filename:(_,f,cb)=>cb(null,`rob-${Date.now()}-${Math.random().toString(36).slice(2)}`)}),limits:{fileSize:500*1024*1024}});
const small=src=>sharp(src,{density:150}).resize(1024,1024,{fit:'inside',withoutEnlargement:true}).jpeg({quality:82}).toBuffer();

async function videoFrames(src){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rob-fr-'));
  try{
    const {stdout}=await run('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',src]);
    const d=parseFloat(stdout)||3,out=[];
    for(const [i,p] of [.2,.5,.8].entries()){
      const f=path.join(dir,`f${i}.jpg`);
      await run('ffmpeg',['-y','-ss',String(d*p),'-i',src,'-frames:v','1','-vf','scale=768:-2',f]);
      out.push(await fs.readFile(f));
    }
    return out;
  }finally{fs.rm(dir,{recursive:true,force:true})}
}
// Retries 429/503 with exponential backoff (1s, 2s) — 3 tries in total.
const post=(url,body,headers={},m={})=>retry(async()=>{
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok){const err=new Error(r.status===404&&m.model?modelError(m.model,m.env):(j.error?.message||`${url} responded ${r.status}`));err.status=r.status;throw err}
  return j;
},{tries:3,base:1000});
const GEMINI=()=>e.GEMINI_MODEL||'gemini-2.0-flash';
const ask={
  async gemini(imgs,p){
    if(!e.GEMINI_API_KEY)throw new Error('GEMINI_API_KEY missing in .env');
    const j=await post(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI()}:generateContent?key=${e.GEMINI_API_KEY}`,
      {contents:[{parts:[{text:p},...imgs.map(b=>({inline_data:{mime_type:'image/jpeg',data:b.toString('base64')}}))]}],generationConfig:{responseMimeType:'application/json',temperature:.4}},{},{model:GEMINI(),env:'GEMINI_MODEL'});
    return j.candidates?.[0]?.content?.parts?.[0]?.text;
  },
  async openai(url,key,model,envVar,imgs,p){
    if(!key||!model)throw new Error(`API key or ${envVar} missing in .env`);
    const j=await post(url,{model,temperature:.4,messages:[{role:'user',content:[{type:'text',text:p},...imgs.map(b=>({type:'image_url',image_url:{url:'data:image/jpeg;base64,'+b.toString('base64')}}))]}]},{Authorization:'Bearer '+key},{model,env:envVar});
    return j.choices?.[0]?.message?.content;
  },
  groq:(i,p)=>ask.openai('https://api.groq.com/openai/v1/chat/completions',e.GROQ_API_KEY,e.GROQ_MODEL,'GROQ_MODEL',i,p),
  openrouter:(i,p)=>ask.openai('https://openrouter.ai/api/v1/chat/completions',e.OPENROUTER_API_KEY,e.OPENROUTER_MODEL,'OPENROUTER_MODEL',i,p),
  async ollama(imgs,p){
    const model=e.OLLAMA_MODEL||'llava';
    const j=await post((e.OLLAMA_URL||'http://localhost:11434')+'/api/chat',{model,stream:false,format:'json',messages:[{role:'user',content:p,images:imgs.map(b=>b.toString('base64'))}]},{},{model,env:'OLLAMA_MODEL'});
    return j.message?.content;
  }
};
app.get('/api/providers',(_,res)=>res.json({gemini:!!e.GEMINI_API_KEY,groq:!!e.GROQ_API_KEY,openrouter:!!(e.OPENROUTER_API_KEY&&e.OPENROUTER_MODEL),ollama:true,concurrency:concurrency(e),geminiModel:GEMINI()}));
app.post('/api/generate',up.single('file'),async(req,res)=>{
  const {file}=req;
  try{
    const {provider='gemini',ai}=req.body;
    if(!file)throw new Error('No file received');
    if(!Object.hasOwn(ask,provider)||provider==='openai')throw new Error('Unknown provider');
    const imgs=kindOf(file.originalname)?[await small((await renderPreview(file.path,file.originalname)).png)]:file.mimetype.startsWith('video/')?await Promise.all((await videoFrames(file.path)).map(small)):[await small(file.path)];
    const text=await ask[provider](imgs,PROMPT(ai==='true'));
    if(!text)throw new Error('Model returned an empty answer');
    let out=clean(parseJSON(text));
    if(out.keywords.length<49){ // one follow-up call for the missing keywords
      try{out=topUp(out,parseJSON(await ask[provider](imgs,FOLLOWUP(out.keywords,49-out.keywords.length))).keywords)}catch{}
    }
    res.json(out);
  }catch(err){res.status(500).json({error:err.message})}
  finally{if(file)removeFile(file.path)}
});
app.post('/api/preview',up.single('file'),async(req,res)=>{
  const {file}=req;
  try{if(!file)throw new Error('No file received');const {png,info}=await renderPreview(file.path,file.originalname);res.json({preview:'data:image/png;base64,'+png.toString('base64'),info})}
  catch(err){res.status(err instanceof PreviewError?422:500).json({error:err.message})}
  finally{if(file)removeFile(file.path)}
});
// Writes title/description/keywords into IPTC + XMP of JPGs with exiftool and returns a ZIP.
app.post('/api/embed',up.array('files',1000),async(req,res)=>{
  const files=req.files||[];
  try{
    const meta=JSON.parse(req.body.meta||'[]'),exif=await findBin(['exiftool'],'-ver','EXIFTOOL_PATH');
    if(!exif)throw new Error('exiftool is not installed — see the README install steps.');
    const zip=new JSZip(),skipped=[],used=new Set(),uniq=n=>{let r=n,k=2;const x=path.extname(n),b=n.slice(0,n.length-x.length);while(used.has(r.toLowerCase()))r=`${b}-${k++}${x}`;used.add(r.toLowerCase());return r};
    for(const [i,f] of files.entries()){
      if(!/\.jpe?g$/i.test(f.originalname)){skipped.push(f.originalname+' (only JPG is supported)');continue}
      try{await embedFile(exif,f.path,meta[i]);zip.file(uniq(f.originalname),await fs.readFile(f.path))}catch(err){skipped.push(`${f.originalname} (${String(err.stderr||err.message).split('\n')[0]})`)}
    }
    if(skipped.length)zip.file('_skipped.txt',skipped.join('\n'));
    if(!Object.keys(zip.files).some(n=>n!=='_skipped.txt'))throw new Error('No JPG could be embedded: '+skipped.join('; '));
    res.type('application/zip').send(await zip.generateAsync({type:'nodebuffer'}));
  }catch(err){res.status(500).json({error:err.message})}
  finally{files.forEach(f=>removeFile(f.path))}
});
app.use((err,_q,res,_n)=>res.status(err.code==='LIMIT_FILE_SIZE'?413:500).json({error:err.code==='LIMIT_FILE_SIZE'?'File is larger than the 500 MB limit':err.message}));
app.listen(e.PORT||3001,()=>console.log('R⭕B❕ proxy on :'+(e.PORT||3001)));
