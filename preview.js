import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import sharp from 'sharp';
import {findBin} from './tools.js';
const run=promisify(execFile);
export class PreviewError extends Error{}
export const AI_MSG="Save with 'Create PDF Compatible File' enabled.";
export const kindOf=n=>({'.eps':'eps','.ai':'ai','.svg':'svg'})[path.extname(n).toLowerCase()]||null;
const mm=p=>(p*25.4/72).toFixed(0);
export const fmtPts=(w,h)=>`${mm(w)} × ${mm(h)} mm (${w.toFixed(0)} × ${h.toFixed(0)} pt)`;
export function parseBBox(t){
  const m=t.match(/%%HiResBoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/)||t.match(/%%BoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/);
  return m?{w:m[3]-m[1],h:m[4]-m[2]}:null;
}
// Heuristic colour-mode detection from file text (XMP swatch mode, DSC comments, colour space names, operators).
export function detectColorMode(t){
  const x=(t.match(/xmpG:mode>(CMYK|RGB)</i)||[])[1];if(x)return x.toUpperCase();
  const cmyk=/DocumentProcessColors:[^\r\n]*Cyan|\/DeviceCMYK|setcmykcolor/.test(t),rgb=/DocumentProcessColors:[^\r\n]*Red|\/DeviceRGB|setrgbcolor/.test(t);
  return cmyk&&rgb?'Mixed (RGB + CMYK)':cmyk?'CMYK':rgb?'RGB':'Unknown';
}
export function analyzeSvg(t){
  const text=(t.match(/<text[\s>]/g)||[]).length,rasters=(t.match(/<image[\s>]/g)||[]).length;
  return {colorMode:'RGB',textOutlined:text===0,fonts:text||null,rasters};
}
export function analyzePS(t){
  const f=(t.match(/%%DocumentFonts:\s*([^\r\n]*)/)||[])[1]?.trim(),live=!!f&&!f.startsWith('(atend)')||/%%\+?\s*font\s+\S+/i.test(t);
  return {colorMode:detectColorMode(t),textOutlined:!live,fonts:null,rasters:/%AI\d*_BeginRaster|%%BeginPhotoshop|%%BeginBinary/.test(t)?1:0};
}
export const parseRows=o=>o.split(/\r?\n/).slice(2).filter(l=>l.trim()).length;
export const parsePageSize=o=>{const m=o.match(/Page size:\s+([\d.]+) x ([\d.]+) pts/);return m?{w:+m[1],h:+m[2]}:null};
async function popplerInfo(src){
  const out={};
  for(const [tool,arg,key] of [['pdffonts',[src],'fonts'],['pdfimages',['-list',src],'rasters'],['pdfinfo',[src],'size']]){
    try{const b=await findBin([tool],'-v',tool.toUpperCase()+'_PATH');if(!b)continue;const {stdout}=await run(b,arg);out[key]=key==='size'?parsePageSize(stdout):parseRows(stdout)}catch{}
  }
  return out;
}
async function readHead(p,n=8*1024*1024){const fh=await fs.open(p,'r');try{const b=Buffer.alloc(n),{bytesRead}=await fh.read(b,0,n,0);return b.subarray(0,bytesRead)}finally{await fh.close()}}
async function withDir(fn){const d=await fs.mkdtemp(path.join(os.tmpdir(),'rob-pv-'));try{return await fn(d)}finally{fs.rm(d,{recursive:true,force:true})}}
// pngalpha (not png16m) keeps a transparent background so the checkerboard toggle is meaningful.
async function gsRender(src,kind){
  const gs=await findBin(['gs','gswin64c','gswin32c'],'--version','GS_PATH');if(!gs)return null;
  return withDir(async d=>{const out=path.join(d,'o.png');
    try{await run(gs,['-q','-dNOPAUSE','-dBATCH','-dSAFER','-sDEVICE=pngalpha','-r150','-dTextAlphaBits=4','-dGraphicsAlphaBits=4',kind==='eps'?'-dEPSCrop':'-dUseCropBox','-dFirstPage=1','-dLastPage=1',`-sOutputFile=${out}`,src],{timeout:120000});return await fs.readFile(out)}
    catch(e){throw new PreviewError('Could not render this file: '+(String(e.stderr||e.message).split('\n').find(Boolean)||'unknown error'))}});
}
async function popplerRender(src){
  const b=await findBin(['pdftoppm'],'-v','PDFTOPPM_PATH');if(!b)return null;
  return withDir(async d=>{try{await run(b,['-png','-r','150','-f','1','-l','1','-singlefile',src,path.join(d,'o')],{timeout:120000});return await fs.readFile(path.join(d,'o.png'))}
    catch(e){throw new PreviewError('Could not render this file: '+(String(e.stderr||e.message).split('\n').find(Boolean)||'unknown error'))}});
}
export async function isBlank(png){const s=await sharp(png).flatten({background:'#fff'}).stats();return s.channels.every(c=>c.max===c.min)}
export async function renderPreview(src,name){
  const kind=kindOf(name);if(!kind)throw new PreviewError('Not an EPS, AI or SVG file');
  const head=(await readHead(src)).toString('latin1'),info={format:kind.toUpperCase()};let png;
  if(kind==='svg'){
    png=await sharp(src,{density:150}).png().toBuffer();
    const m=await sharp(src).metadata();Object.assign(info,analyzeSvg(head),{size:`${m.width} × ${m.height} px`});
  }else if(kind==='eps'){
    png=await gsRender(src,kind);if(!png)throw new PreviewError('Ghostscript is required for EPS files — see the README install steps.');
    const b=parseBBox(head);Object.assign(info,analyzePS(head),{size:b?fmtPts(b.w,b.h):null});
  }else{
    if(!head.slice(0,1024).includes('%PDF'))throw new PreviewError(AI_MSG);
    png=await gsRender(src,kind)||await popplerRender(src);
    if(!png)throw new PreviewError('Ghostscript or poppler is required for AI files — see the README install steps.');
    const p=await popplerInfo(src);Object.assign(info,{colorMode:detectColorMode(head),fonts:p.fonts??null,textOutlined:p.fonts==null?null:p.fonts===0,rasters:p.rasters??null,size:p.size?fmtPts(p.size.w,p.size.h):null});
  }
  png=await sharp(png).resize(2400,2400,{fit:'inside',withoutEnlargement:true}).png().toBuffer();
  if(kind==='ai'&&await isBlank(png))throw new PreviewError(AI_MSG);
  const m=await sharp(png).metadata();info.width=m.width;info.height=m.height;
  return {png,info};
}
