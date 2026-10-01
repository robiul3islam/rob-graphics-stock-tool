// Ambiguous everyday words (apple, amazon, jaguar, puma, mustang, shell, corona, visa, windows, orange, oracle…)
// are intentionally NOT listed, so real subjects like fruit or animals are never stripped.
export const BRANDS_LIST=`google,microsoft,iphone,ipad,macbook,imac,airpods,apple watch,apple logo,android,samsung,galaxy phone,huawei,xiaomi,oneplus,sony,playstation,xbox,nintendo,intel,nvidia,dell,lenovo,asus,logitech,gopro,canon,nikon,fujifilm,kodak,panasonic,philips,bose,garmin,fitbit,kindle,alexa,siri,chatgpt,openai,midjourney,photoshop,adobe,shutterstock,getty images,istock,freepik,
facebook,instagram,whatsapp,tiktok,youtube,twitter,snapchat,pinterest,linkedin,telegram,reddit,twitch,discord,spotify,netflix,skype,tinder,wechat,paypal,mastercard,american express,amex,ebay,alibaba,aliexpress,walmart,costco,ikea,tesco,uber,airbnb,amazon prime,
nike,adidas,reebok,under armour,new balance,converse,gucci,prada,chanel,louis vuitton,hermes,dior,versace,burberry,armani,balenciaga,zara,uniqlo,levis,rolex,cartier,tiffany,ray ban,rayban,ray-ban,lacoste,ralph lauren,calvin klein,tommy hilfiger,fila,asics,skechers,north face,patagonia,louboutin,saint laurent,fendi,michael kors,
toyota,honda,tesla,bmw,mercedes,mercedes benz,audi,volkswagen,porsche,ferrari,lamborghini,bentley,rolls royce,maserati,bugatti,jeep,chevrolet,nissan,hyundai,kia,mazda,subaru,volvo,land rover,range rover,lexus,mini cooper,harley davidson,ducati,yamaha,suzuki,kawasaki,mclaren,aston martin,ford mustang,
coca cola,coca-cola,pepsi,fanta,red bull,monster energy,starbucks,mcdonalds,burger king,kfc,pizza hut,dominos,nutella,oreo,kitkat,snickers,heineken,budweiser,guinness,jack daniels,nestle,cadbury,pringles,kellogg,heinz,nescafe,nespresso,dunkin,taco bell,wendys,hersheys,haribo,lindt,toblerone,
fifa,uefa,nba,nfl,mlb,nhl,super bowl,premier league,champions league,olympic games,olympic rings,wimbledon,real madrid,manchester united,disney,pixar,marvel,star wars,harry potter,pokemon,mickey mouse,hello kitty,minecraft,fortnite,roblox,super mario,batman,superman,spiderman,spider man,iron man,avengers,game of thrones,simpsons,winnie the pooh,barbie,lego,hasbro,hot wheels,paw patrol,angry birds,pac man,among us,squid game,lord of the rings,cnn,bbc,
kleenex,velcro,jacuzzi,tupperware,xerox,post it,band aid,bandaid,scotch tape,taser,zamboni,rollerblade,jet ski,polaroid,lycra,teflon,styrofoam,plexiglas,fedex,dhl,red cross`.split(/[,\n]/).map(s=>s.trim()).filter(Boolean);
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const BR=new RegExp(`(?<![\\p{L}\\p{N}])(?:${[...BRANDS_LIST].sort((a,b)=>b.length-a.length).map(esc).join('|')})(?:'s|s)?(?![\\p{L}\\p{N}])`,'giu');
export const hasBrand=s=>String(s).search(BR)>=0;
export const stripBrands=s=>String(s||'').replace(BR,' ').replace(/\s+([,.;:!?])/g,'$1').replace(/\s{2,}/g,' ').replace(/^[\s,.;:-]+|[\s,-]+$/g,'').trim();
const cut=(s,n)=>{s=String(s||'').trim().replace(/\s+/g,' ');if(s.length<=n)return s;s=s.slice(0,n);return s.slice(0,s.lastIndexOf(' ')>n*.6?s.lastIndexOf(' '):n).replace(/[,\s-]+$/,'')};
export function normKeywords(list){
  const seen=new Set();
  return (list||[]).map(s=>String(s).toLowerCase().replace(/[^\p{L}\p{N} -]/gu,'').trim().replace(/\s+/g,' '))
    .filter(s=>s&&!hasBrand(s)&&!seen.has(s)&&seen.add(s));
}
// The model ranks the top 10 itself; we keep its order untouched.
export function clean(raw){
  return {title:cut(stripBrands(raw.title),70),description:cut(stripBrands(raw.description),200),keywords:normKeywords(raw.keywords).slice(0,49)};
}
export function topUp(res,extra){
  const have=new Set(res.keywords);
  return {...res,keywords:[...res.keywords,...normKeywords(extra).filter(k=>!have.has(k))].slice(0,49)};
}
export const PROMPT=(ai)=>`You are a senior microstock metadata specialist. Look at the image(s) and return ONLY JSON: {"title":"","description":"","keywords":[]}.
Title: max 70 chars, main keyword first, no brand names. Description: max 200 chars, one natural sentence${ai?', mention it is AI-generated artwork':''}. Never use brand names or trademarks anywhere.
Keywords: exactly 49, lowercase, no duplicates. Order matters:
- Positions 1-10 are the 10 strongest, highest search-demand terms for this file. List the single-word terms first, ranked by importance, then the strongest 2-word phrases, also ranked by importance. Never drop a strong phrase from the top 10 just to fit a weaker single word.
- Positions 11-49 continue in descending relevance, grouped: subject, concept, mood, style, color, usage.
Include synonyms and buyer-intent terms (background, banner, template, concept, illustration) where relevant. Describe only what is visible.`;
export const FOLLOWUP=(have,n)=>`Return ONLY JSON {"keywords":[]} containing exactly ${n} NEW relevant microstock keywords for this file (lowercase, descending relevance, no brand names). Do not repeat any of these: ${have.join(', ')}.`;
export const parseJSON=t=>JSON.parse(String(t).replace(/```json|```/g,'').trim());
export async function retry(fn,{tries=3,base=1000,when=e=>[429,503].includes(e?.status)}={}){
  for(let i=1;;i++){try{return await fn()}catch(e){if(i>=tries||!when(e))throw e;await new Promise(r=>setTimeout(r,base*2**(i-1)))}}
}
export const modelError=(model,envVar)=>`Model "${model}" was not found. Set ${envVar} in .env to a model that exists for your account.`;
export const concurrency=env=>Math.max(1,parseInt(env.CONCURRENCY)||2);
import fs from 'node:fs/promises';
export const removeFile=p=>fs.unlink(p).catch(()=>{});
