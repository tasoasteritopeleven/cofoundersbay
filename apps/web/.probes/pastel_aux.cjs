const fs = require('fs');
const path = 'src/app/globals.css';
let css = fs.readFileSync(path, 'utf8');

function hsl2rgb(h,s,l){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l);const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return[f(0),f(8),f(4)];}
const lum=([r,g,b])=>{const c=v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;return .2126*c(r)+.7152*c(g)+.0722*c(b)};
const cr=(a,b)=>{const x=lum(hsl2rgb(...a)),y=lum(hsl2rgb(...b));return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const INK=[232,20,10];
const CARDS={root:[232,12,99.4],alliance:[210,12,99.4],minimal:[37,57.1,94.5],apricot:[30,30,98.4]};

// Mark target: S 46, luminance >= 0.44 (softer band under the accent)
function pastelMark(h){
  for(let ml=30;ml<90;ml+=0.25){
    const m=[h,46,+ml.toFixed(2)];
    if(lum(hsl2rgb(...m))>=0.44) return m;
  }
}
// Chart target: S*0.7 rounded, L+10 capped at 74
const pastelChart=(h,s,l)=>[h,Math.round(s*0.7),Math.min(Math.round(l+10),74)];

const report=[];
// status marks: --status-<tone>-mark: H 62% L%; in light blocks only (not .dark)
css = css.replace(/(--status-(success|warning|danger|info|accent)-mark:\s*)(\d+)\s+62%\s+([\d.]+)%/g,
  (m,pre,tone,h,l)=>{
    const [H,S,L]=pastelMark(+h);
    report.push(`${tone} mark ${h} 62% ${l}% -> ${H} ${S}% ${L}%`);
    return `${pre}${H} ${S}% ${L}%`;
  });
// charts: --chart-N: H S% L%;
css = css.replace(/(--chart-\d:\s*)(\d+)\s+([\d.]+)%\s+([\d.]+)%/g,
  (m,pre,h,s,l)=>{
    const [H,S,L]=pastelChart(+h,+s,+l);
    report.push(`chart ${h} ${s}% ${l}% -> ${H} ${S}% ${L}%`);
    return `${pre}${H} ${S}% ${L}%`;
  });
// refresh stale mark comments: "X.XX on card, ink Y.YY"
css = css.replace(/(--status-\w+-mark:\s*\d+\s+[\d.]+%\s+[\d.]+%;)\s*\/\*[\d.]+ on card, ink [\d.]+ \*\//g,
  (m,decl)=>{
    const v=decl.match(/:\s*(\d+)\s+([\d.]+)%\s+([\d.]+)%/);
    const t=[+v[1],+v[2],+v[3]];
    // nearest light card for the comment: use root card 232 12 99.4
    return `${decl}   /* ${cr(t,CARDS.root).toFixed(2)} on card, ink ${cr(INK,t).toFixed(2)} */`;
  });
fs.writeFileSync(path,css);
console.log(report.join('\n'));
