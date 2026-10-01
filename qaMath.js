// Pure pixel maths for the QA checker (no DOM) so it can be unit-tested in Node.
export const gray=d=>{const g=new Float32Array(d.length/4);for(let i=0;i<g.length;i++)g[i]=.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2];return g};
// Relative sharpness: ratio of Laplacian to gradient on the strongest edges only.
// Flat areas, bokeh and smooth gradients carry no weight, so they cannot cause a false "blurry".
export function sharpness(g,w,h){
  let maxG=0,dense=0;const gr=new Float32Array(w*h),lp=new Float32Array(w*h);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const k=y*w+x,gx=(g[k+1]-g[k-1])/2,gy=(g[k+w]-g[k-w])/2;
    gr[k]=Math.hypot(gx,gy);lp[k]=Math.abs(g[k-1]+g[k+1]+g[k-w]+g[k+w]-4*g[k]);if(gr[k]>maxG)maxG=gr[k];if(gr[k]>6)dense++}
  const thr=Math.max(6,maxG*.4);let sl=0,sg=0;
  for(let k=0;k<gr.length;k++)if(gr[k]>thr){sl+=lp[k];sg+=gr[k]}
  return {edgeDensity:dense/(w*h),maxGrad:maxG,ratio:sg?sl/sg:0};
}
export function noiseLevel(g,w,h){let s=0,n=0;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const k=y*w+x,l=4*g[k]-g[k-1]-g[k+1]-g[k-w]-g[k+w];if(Math.abs(l)<48){s+=Math.abs(l)/4;n++}}
  return s/Math.max(n,1)}
export function blurVerdict({ratio,edgeDensity,maxGrad}){
  if(edgeDensity<.01||maxGrad<6)return 'skip';            // flat vectors, bokeh, smooth art: nothing to judge
  if((ratio<.3&&maxGrad<40)||(maxGrad<18&&ratio<.5))return 'blurry';
  if(ratio<.45&&maxGrad<40)return 'soft';
  return 'ok';
}
