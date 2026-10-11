const fs = require('fs');
const path = 'src/app/globals.css';
let css = fs.readFileSync(path, 'utf8');
function hsl2rgb(h,s,l){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l);const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return[f(0),f(8),f(4)];}
const lum=([r,g,b])=>{const c=v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;return .2126*c(r)+.7152*c(g)+.0722*c(b)};
const cr=(a,b)=>{const x=lum(hsl2rgb(...a)),y=lum(hsl2rgb(...b));return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const INK=[232,20,10];
const allIdx=css.indexOf('html[data-theme="alliance"] {');
const minIdx=css.indexOf('html[data-theme="minimal"] {');
const aprIdx=css.indexOf('html[data-theme="apricot"] {');
let out='',last=0,n=0;
const re=/(--status-\w+-mark:\s*\d+\s+[\d.]+%\s+[\d.]+%;)\s*\/\*\s*[\d.]+ on card, ink [\d.]+\s*\*\//g;
let m;
while((m=re.exec(css))){
  out+=css.slice(last,m.index);
  const v=m[1].match(/:\s*(\d+)\s+([\d.]+)%\s+([\d.]+)%/);
  const t=[+v[1],+v[2],+v[3]];
  let card=[232,12,99.4];
  if(m.index>allIdx) card=[210,12,99.4];
  if(m.index>minIdx) card=[37,57.1,94.5];
  if(m.index>aprIdx) card=[30,30,98.4];
  out+=`${m[1]}   /* ${cr(t,card).toFixed(2)} on card, ink ${cr(INK,t).toFixed(2)} */`;
  last=m.index+m[0].length;n++;
}
out+=css.slice(last);
fs.writeFileSync(path,out);
console.log('rewrote',n,'comments');
