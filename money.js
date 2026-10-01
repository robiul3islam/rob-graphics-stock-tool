export function detectDelim(t){
  const line=t.replace(/^\uFEFF/,'').split(/\r?\n/)[0]||'',c={',':0,';':0,'\t':0};let inQ=false;
  for(const ch of line){if(ch==='"')inQ=!inQ;else if(!inQ&&ch in c)c[ch]++}
  const [d,n]=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];return n?d:',';
}
export function parse(t){
  const d=detectDelim(t),rows=[];let r=[],c='',q=false;t=t.replace(/^\uFEFF/,'');
  for(let i=0;i<t.length;i++){const ch=t[i];
    if(q){if(ch==='"'){if(t[i+1]==='"'){c+='"';i++}else q=false}else c+=ch}
    else if(ch==='"')q=true;else if(ch===d){r.push(c);c=''}else if(ch==='\n'){r.push(c);rows.push(r);r=[];c=''}else if(ch!=='\r')c+=ch}
  if(c||r.length){r.push(c);rows.push(r)}return rows.filter(x=>x.some(Boolean));
}
// Handles 1,234.56 · 1.234,56 · 1,50 · 1234.5 · (3.20) · -3,20
export function num(v){
  let s=String(v??'').replace(/[^0-9.,\-()]/g,'');if(!/\d/.test(s))return 0;
  const neg=/^-|\(.*\)/.test(s);s=s.replace(/[-()]/g,'');
  const c=s.lastIndexOf(','),p=s.lastIndexOf('.');
  if(c>-1&&p>-1)s=c>p?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  else if(c>-1)s=/,\d{1,2}$/.test(s)&&s.split(',').length===2?s.replace(',','.'):s.replace(/,/g,'');
  const n=parseFloat(s)||0;return neg?-n:n;
}
const BAD=/download|count|qty|quantity|units|views|number|#|sales$/i;
export const pickAmount=cols=>cols.find(c=>/earn|revenue|royalt|commission/i.test(c)&&!BAD.test(c))||cols.find(c=>/amount|total|payout|income/i.test(c)&&!BAD.test(c))||'';
