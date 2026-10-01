import {execFile} from 'node:child_process';import {promisify} from 'node:util';import fs from 'node:fs/promises';
const run=promisify(execFile),one=s=>String(s??'').replace(/[\r\n]+/g,' ').trim();
// One exiftool argument per line (argfile). IPTC ObjectName is limited to 64 chars; Headline carries the full title.
export function exifArgs({title='',description='',keywords=[]}={}){
  const t=one(title),d=one(description),k=keywords.map(one).filter(Boolean);
  return ['-IPTC:CodedCharacterSet=UTF8',`-XMP-dc:Title=${t}`,`-XMP-dc:Description=${d}`,`-IPTC:ObjectName=${t.slice(0,64)}`,`-IPTC:Headline=${t.slice(0,256)}`,`-IPTC:Caption-Abstract=${d}`,
    ...k.map(x=>`-XMP-dc:Subject=${x}`),...k.map(x=>`-IPTC:Keywords=${x.slice(0,64)}`)];
}
export async function embedFile(exiftool,file,meta){
  const af=file+'.args';await fs.writeFile(af,exifArgs(meta).join('\n'),'utf8');
  try{await run(exiftool,['-charset','utf8','-overwrite_original','-m','-@',af,file])}finally{fs.unlink(af).catch(()=>{})}
}
