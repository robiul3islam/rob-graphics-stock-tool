import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import JSZip from 'jszip';
import {clean,topUp,BRANDS_LIST,stripBrands,hasBrand,PROMPT,FOLLOWUP,retry,modelError,concurrency,removeFile} from './lib.js';
import {sharpness,noiseLevel,blurVerdict} from '../web/src/qaMath.js';
import {parse,num,pickAmount} from '../web/src/money.js';
import {buildCSV,zipFiles,PLATFORMS} from '../web/src/csv.js';
import {kindOf,detectColorMode,analyzeSvg,analyzePS,parseBBox,parseRows,parsePageSize,renderPreview,isBlank,AI_MSG,PreviewError,fmtPts} from './preview.js';
import {exifArgs,embedFile} from './embed.js';import {findBin} from './tools.js';import sharp from 'sharp';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const run=promisify(execFile);let fail=0;const t=async(n,f)=>{try{await f();console.log('  ok   '+n)}catch(e){fail++;console.log('  FAIL '+n+'\n       '+e.message)}};

console.log('1 keyword ranking');
await t('top 10 keeps AI order, strong 2-word phrase not pushed out',()=>{
  const kw=['landscape','mountain landscape','mountain','sky','nature','travel','snow','scenic view','peak','alps','hiking','adventure'];
  assert.deepEqual(clean({title:'x',description:'y',keywords:kw}).keywords,kw);});
await t('prompt asks model for singles first, then phrases, never demoting phrases',()=>{
  assert.match(PROMPT(false),/single-word terms first/);assert.match(PROMPT(false),/Never drop a strong phrase/);});

console.log('2 keyword count');
await t('topUp fills to 49 with new, unique, brand-free keywords',()=>{
  const have=Array.from({length:40},(_,i)=>'kw'+i),r=topUp({title:'',description:'',keywords:have},['KW5','nike shoes',...Array.from({length:15},(_,i)=>'new'+i)]);
  assert.equal(r.keywords.length,49);assert.equal(new Set(r.keywords).size,49);assert.deepEqual(r.keywords.slice(0,40),have);
  assert(!r.keywords.includes('nike shoes'));});
await t('follow-up prompt states the exact missing number',()=>assert.match(FOLLOWUP(['a','b'],9),/exactly 9 NEW/));
await t('clean caps at 49 and de-duplicates',()=>{
  const r=clean({keywords:['Sky','sky',...Array.from({length:80},(_,i)=>'k'+i)]});assert.equal(r.keywords.length,49);assert.equal(new Set(r.keywords).size,49);});

console.log('3 brand filter');
await t('150+ brands in list',()=>assert(BRANDS_LIST.length>=150,'only '+BRANDS_LIST.length));
await t('removes every brand (global) from title and description, no double spaces',()=>{
  const r=clean({title:'Nike and Adidas sneakers on Gucci floor, Nike again',description:"Starbucks coffee next to a Tesla car and Starbucks cup.",keywords:[]});
  assert(!hasBrand(r.title)&&!hasBrand(r.description),JSON.stringify(r));assert(!/\s{2,}/.test(r.title+r.description));assert(!/\s[,.]/.test(r.title+r.description));});
await t('keywords with brands are dropped, normal words (apple fruit) kept',()=>{
  const r=clean({keywords:['sneakers','Nike shoes','tesla','iphone case','apple','red bull can']});assert.deepEqual(r.keywords,['sneakers','apple']);});
await t('possessive and plural brand forms are caught',()=>assert(!hasBrand('legos')===false&&hasBrand("Nike's")&&hasBrand('legos')));
await t('stripBrands leaves clean text intact',()=>assert.equal(stripBrands('Calm ocean at sunset'),'Calm ocean at sunset'));

console.log('4 rate limits');
await t('retries 429 then succeeds (3 calls)',async()=>{let n=0;const r=await retry(async()=>{if(++n<3){const e=new Error('x');e.status=429;throw e}return 'ok'},{base:1});assert.equal(r,'ok');assert.equal(n,3);});
await t('gives up after 3 tries on 503',async()=>{let n=0;await assert.rejects(retry(async()=>{n++;const e=new Error('x');e.status=503;throw e},{base:1}));assert.equal(n,3);});
await t('does not retry a 400',async()=>{let n=0;await assert.rejects(retry(async()=>{n++;const e=new Error('x');e.status=400;throw e},{base:1}));assert.equal(n,1);});
await t('backoff doubles',async()=>{const t0=Date.now();let n=0;await assert.rejects(retry(async()=>{n++;const e=new Error('x');e.status=429;throw e},{base:40}));assert(Date.now()-t0>=110);});
await t('concurrency from env, default 2',()=>{assert.equal(concurrency({}),2);assert.equal(concurrency({CONCURRENCY:'4'}),4);assert.equal(concurrency({CONCURRENCY:'abc'}),2);assert.equal(concurrency({CONCURRENCY:'0'}),2);});

console.log('5 temp-file uploads');
await t('removeFile deletes the upload and ignores missing files',async()=>{
  const f=path.join(os.tmpdir(),'rob-test-'+Date.now());await fs.writeFile(f,'x');await removeFile(f);await assert.rejects(fs.stat(f));await removeFile(f);});

console.log('6 model name');
await t('model-not-found error names the model and the .env variable',()=>{const m=modelError('gemini-x','GEMINI_MODEL');assert.match(m,/gemini-x/);assert.match(m,/GEMINI_MODEL/);});

console.log('7 single ZIP');
const items=[{status:'done',file:{name:'a.jpg'},title:'Tëst বাংলা',description:'বাংলা d',keywords:['a','b']},{status:'error',file:{name:'bad.jpg'},title:'',description:'',keywords:[]}];
await t('ZIP holds one CSV per selected platform',async()=>{
  const ids=['adobe','freepik','vecteezy'],z=await JSZip.loadAsync(await zipFiles(ids,items,false).generateAsync({type:'nodebuffer'}));
  assert.deepEqual(Object.keys(z.files).sort(),ids.map(i=>i+'.csv').sort());});

console.log('8 QA');
const W=128,mk=f=>{const g=new Float32Array(W*W);for(let y=0;y<W;y++)for(let x=0;x<W;x++)g[y*W+x]=f(x,y);return g};
const box=(g,r)=>{const o=new Float32Array(g.length);for(let y=0;y<W;y++)for(let x=0;x<W;x++){let s=0,n=0;for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++){const a=x+i,b=y+j;if(a>=0&&b>=0&&a<W&&b<W){s+=g[b*W+a];n++}}o[y*W+x]=s/n}return o};
const blur=(g,r)=>box(box(box(g,r),r),r),V=g=>blurVerdict(sharpness(g,W,W));
let seed=1;const rnd=()=>(seed=seed*16807%2147483647)/2147483647-.5;
const tex=mk((x,y)=>128+60*Math.sin(x/3)*Math.cos(y/4)+40*Math.sin(x/1.7+y/2.3)),stripes=mk(x=>Math.floor(x/8)%2?220:30);
await t('sharp stripes and sharp texture are not flagged',()=>{assert.equal(V(stripes),'ok');assert.equal(V(tex),'ok');});
await t('flat-colour vector (hard or antialiased) is never "blurry"',()=>{const c=mk((x,y)=>(x-64)**2+(y-64)**2<900?40:230);assert.notEqual(V(c),'blurry');assert.notEqual(V(box(c,1)),'blurry');});
await t('bokeh photo (sharp subject, smooth background) is never "blurry"',()=>assert.notEqual(V(mk((x,y)=>Math.abs(x-30)<10&&Math.abs(y-30)<10?30:120+x/8)),'blurry'));
await t('truly blurry images ARE flagged',()=>{assert.equal(V(blur(stripes,2)),'blurry');assert.equal(V(blur(tex,2)),'blurry');});
await t('plain flat image is skipped, not failed',()=>assert.equal(V(mk(()=>100)),'skip'));
await t('noise measured: noisy flat > clean, and noise is not called blur',()=>{const n=mk(()=>100+rnd()*16);assert(noiseLevel(n,W,W)>3.5);assert(noiseLevel(stripes,W,W)<1);assert.notEqual(V(n),'blurry');});

console.log('9 earnings');
await t('"Total downloads" is never auto-mapped as amount',()=>{assert.equal(pickAmount(['File','Total downloads','Earnings (USD)']),'Earnings (USD)');assert.equal(pickAmount(['File','Total downloads']),'');assert.equal(pickAmount(['Downloads','Total']),'Total');assert.equal(pickAmount(['Units','Royalty','Total']),'Royalty');});
await t('European and US decimals',()=>{for(const [v,n] of [['1,50',1.5],['1.234,56',1234.56],['1,234.56',1234.56],['€ 12,5',12.5],['1234.5',1234.5],['1,234',1234],['-3,20',-3.2],['(3.20)',-3.2],['',0],['abc',0]])assert.equal(num(v),n,v)});
await t('semicolon CSV with comma decimals parses correctly',()=>{const r=parse('File;Earnings\r\na.jpg;1,50\r\nb.jpg;2,25\r\n');assert.deepEqual(r,[['File','Earnings'],['a.jpg','1,50'],['b.jpg','2,25']]);assert.equal(num(r[1][1])+num(r[2][1]),3.75);});
await t('comma CSV with quoted fields still works',()=>assert.deepEqual(parse('a,b\n"x, y",2\n'),[['a','b'],['x, y','2']]));

console.log('10 CSV config');
await t('every platform builds a UTF-8 CSV with matching column counts',()=>{
  for(const id of Object.keys(PLATFORMS)){const csv=buildCSV(id,items,id==='freepik'),rows=csv.slice(1).split('\r\n');
    assert.equal(csv[0],'\uFEFF');assert.equal(rows.length,2,id);assert(csv.includes('বাংলা'));
    const d=PLATFORMS[id].delimiter,cols=PLATFORMS[id].columns.length;assert.equal(rows[0].split(d).length,cols);assert.equal(rows[1].split('"'+d+'"').length,cols,id);}});
await t('Vecteezy and Dreamstime are flagged for verification',()=>{assert.equal(PLATFORMS.vecteezy.verified,false);assert.equal(PLATFORMS.dreamstime.verified,false);});
await t('AI flag fills Freepik prompt/model columns',()=>assert.match(buildCSV('freepik',items,true),/AI-generated/));

console.log('11 EPS / AI / SVG preview');
const tmp=async(name,data)=>{const f=path.join(os.tmpdir(),'rob-t-'+Date.now()+Math.random().toString(36).slice(2));await fs.writeFile(f,data);return f};
const hasGs=await findBin(['gs','gswin64c','gswin32c'],'--version','GS_PATH'),hasExif=await findBin(['exiftool'],'-ver','EXIFTOOL_PATH');
const skip=(n,ok,f)=>ok?t(n,f):console.log('  skip '+n+' (tool not installed)');
await t('file kinds',()=>{assert.equal(kindOf('a.EPS'),'eps');assert.equal(kindOf('a.ai'),'ai');assert.equal(kindOf('a.svg'),'svg');assert.equal(kindOf('a.jpg'),null)});
await t('colour mode detection',()=>{assert.equal(detectColorMode('<xmpG:mode>CMYK</xmpG:mode>'),'CMYK');assert.equal(detectColorMode('1 0 0 setrgbcolor'),'RGB');assert.equal(detectColorMode('%%DocumentProcessColors: Cyan Magenta'),'CMYK');assert.equal(detectColorMode('/DeviceRGB /DeviceCMYK'),'Mixed (RGB + CMYK)');assert.equal(detectColorMode('nothing'),'Unknown')});
await t('SVG analysis finds live text and embedded rasters',()=>{const a=analyzeSvg('<svg><text>Hi</text><image href="x"/></svg>');assert.equal(a.textOutlined,false);assert.equal(a.rasters,1);assert.equal(analyzeSvg('<svg><path d="M0 0z"/></svg>').textOutlined,true)});
await t('EPS analysis: fonts, rasters, bbox',()=>{assert.equal(analyzePS('%%DocumentFonts: Helvetica\n').textOutlined,false);assert.equal(analyzePS('%%DocumentFonts: (atend)\n').textOutlined,true);assert.equal(analyzePS('%AI9_BeginRaster').rasters,1);assert.deepEqual(parseBBox('%%BoundingBox: 0 0 200 100'),{w:200,h:100});assert.match(fmtPts(595,842),/210 × 297 mm/)});
await t('poppler output parsing',()=>{assert.equal(parseRows('name  type\n----  ----\nArial TrueType\nBold  Type1\n'),2);assert.equal(parseRows('h\n-\n'),0);assert.deepEqual(parsePageSize('Page size:      595.276 x 841.89 pts (A4)'),{w:595.276,h:841.89})});
await t('SVG renders to PNG via sharp with info',async()=>{const f=await tmp('a.svg','<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50" fill="red"/><text x="5" y="20">Hi</text></svg>');const {png,info}=await renderPreview(f,'a.svg');assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(info.size,'100 × 50 px');assert.equal(info.textOutlined,false);await removeFile(f)});
await t('AI file without PDF content shows the Create PDF Compatible File message',async()=>{const f=await tmp('x','%!PS-Adobe-3.0\n%%Creator: Adobe Illustrator\n');await assert.rejects(renderPreview(f,'x.ai'),e=>e instanceof PreviewError&&e.message===AI_MSG);await removeFile(f)});
await t('isBlank detects empty vs drawn pages',async()=>{const blank=await sharp({create:{width:20,height:20,channels:4,background:'#fff'}}).png().toBuffer(),drawn=await sharp({create:{width:20,height:20,channels:4,background:'#fff'}}).composite([{input:{create:{width:5,height:5,channels:3,background:'#f00'}},left:2,top:2}]).png().toBuffer();assert.equal(await isBlank(blank),true);assert.equal(await isBlank(drawn),false)});
const EPS='%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 200 100\n%%DocumentFonts: Helvetica\n1 0 0 setrgbcolor 20 20 160 60 rectfill\nshowpage\n';
await skip('EPS renders with Ghostscript, cropped to its bounding box',hasGs,async()=>{const f=await tmp('e',EPS),{png,info}=await renderPreview(f,'e.eps');const m=await sharp(png).metadata();assert.equal(m.width,417);assert.equal(info.colorMode,'RGB');assert.equal(info.textOutlined,false);assert.match(info.size,/71 × 35 mm/);await removeFile(f)});
await skip('AI (PDF-compatible) renders; a blank artboard asks for PDF compatibility',hasGs,async()=>{
  const mkpdf=async ps=>{const src=await tmp('p',ps),out=src+'.pdf';await run(hasGs,['-q','-dNOPAUSE','-dBATCH','-sDEVICE=pdfwrite','-dEPSCrop',`-sOutputFile=${out}`,src]);return out};
  const good=await mkpdf(EPS),{png}=await renderPreview(good,'good.ai');assert.equal(png.subarray(1,4).toString(),'PNG');
  const blank=await mkpdf('%!PS-Adobe-3.0\n%%BoundingBox: 0 0 100 100\nshowpage\n');await assert.rejects(renderPreview(blank,'blank.ai'),e=>e.message===AI_MSG)});

console.log('12 metadata embedding');
await t('exiftool args: UTF-8, repeated keywords, IPTC 64-char title cap, no newlines',()=>{
  const a=exifArgs({title:'T'.repeat(70)+'\nx',description:'বাংলা d',keywords:['a','b','']});
  assert(a.includes('-IPTC:CodedCharacterSet=UTF8'));assert.equal(a.find(x=>x.startsWith('-IPTC:ObjectName=')).length,'-IPTC:ObjectName='.length+64);
  assert.deepEqual(a.filter(x=>x.startsWith('-IPTC:Keywords=')),['-IPTC:Keywords=a','-IPTC:Keywords=b']);assert.deepEqual(a.filter(x=>x.startsWith('-XMP-dc:Subject=')).length,2);assert(a.some(x=>x.includes('বাংলা')));assert(!a.some(x=>/[\r\n]/.test(x)))});
await skip('exiftool really writes IPTC + XMP into a JPG and they read back',hasExif,async()=>{
  const f=await tmp('j',await sharp({create:{width:30,height:30,channels:3,background:'#09f'}}).jpeg().toBuffer());
  await embedFile(hasExif,f,{title:'Golden sunset বাংলা',description:'A calm sea.',keywords:['sunset','sea','golden hour']});
  const {stdout}=await run(hasExif,['-j','-charset','utf8','-XMP-dc:Title','-XMP-dc:Subject','-IPTC:Keywords','-IPTC:Headline',f]),j=JSON.parse(stdout)[0];
  assert.equal(j.Title,'Golden sunset বাংলা');assert.deepEqual([].concat(j.Subject),['sunset','sea','golden hour']);assert.deepEqual([].concat(j.Keywords),['sunset','sea','golden hour']);assert.equal(j.Headline,'Golden sunset বাংলা');await removeFile(f)});
console.log(fail?`\n${fail} FAILED`:'\nall tests passed');process.exit(fail?1:0);
