// Proportion & composition audit (v2). Measures the RENDERED page (not the source) against the rules in
// 03-PROPORTIONS-AND-COMPOSITION.md §3 (off-grid spacing, off-scale type, measure, uniform "AI" card rows,
// heading:body ratio, symmetric hero split, competing accent buttons, section rhythm, tap-target gaps).
//
// What it drives: mockup/littlefounders-mockup.html, through the mockup's own state hooks (global `S`,
// `render()`, routes addressed as `#route=<name>` / `S.route`). Auditing a real application needs a
// different driver (see README).
//
// Requirements: Node 18+, `puppeteer-core`, and a local Chrome/Chromium given by CHROME_PATH.
// Usage:
//   CHROME_PATH=/path/to/chrome node proportion-audit.reference.mjs <mockup.html> [out.json]
//   env: ROUTES=landing,how,...   WIDTHS=320,375,768,1280   LANGS=en,es,pt   VERBOSE=1 (print one line per finding type)
// Defaults (v2 mockup): 17 routes expanded into 40 state variants (the same variantsFor list as the text-fit
// audit) x 4 widths x 3 languages = 480 page states.
// Exit code: 0 = no findings, 1 = findings, 2 = setup error.
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
const CHROME=process.env.CHROME_PATH;
if(!CHROME){ console.error('CHROME_PATH is not set. Point it at a local Chrome/Chromium executable, e.g.\n  CHROME_PATH=/usr/bin/chromium node proportion-audit.reference.mjs mockup/littlefounders-mockup.html'); process.exit(2); }
if(!process.argv[2]){ console.error('Usage: CHROME_PATH=... node proportion-audit.reference.mjs <mockup.html> [out.json]'); process.exit(2); }
const file=path.resolve(process.argv[2]), out=process.argv[3]||'proportion-report.json';
if(!fs.existsSync(file)){ console.error('File not found: '+file); process.exit(2); }
const browser=await puppeteer.launch({executablePath:CHROME,headless:'shell',args:['--no-sandbox']});
const page=await browser.newPage(); await page.setViewport({width:1400,height:1000});
await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
await page.goto('file://'+file+'#route=landing'); await page.evaluate(()=>document.fonts.ready);
if(!(await page.evaluate(()=>typeof S==='object'&&typeof render==='function'&&'route' in S))){ console.error('Page does not expose the mockup state hooks (S.route, render()).'); await browser.close(); process.exit(2); }
const routes=(process.env.ROUTES||'landing,how,families,signup,login,notfound,home,lesson,result,board,mentor,tasks,wallet,me,parent,staff,system').split(',');
// Per-route state variants (v2). Each variant is a plain object merged into the mockup's `S` after the
// mockup's own resetState() has put every demo state back to its default, so no state leaks between variants.
const BOARD0 = { demo: 0, line: 0, moved: false, lineChecked: false, pred: '', predErr: false, revealed: false, dstep: 1, table: false, rule: { a: null, j: null, b: null, then: null, else: null }, open: null, tested: false, live: '' };
const B = o => ({ board: Object.assign({}, BOARD0, o) });
const SU = o => ({ su: Object.assign({ step: 'age', month: '', year: '', via: '', done: false, errs: {} }, o) });
const variantsFor = (route, lessonIdx) => ({
  lesson: [['unanswered', {}], ['correct', { sel: lessonIdx.correct, checked: true }], ['try-again', { sel: lessonIdx.wrong, checked: true }], ['guided-review', { sel: lessonIdx.wrong, checked: true, misses: 3 }]],
  signup: [['age', SU({})], ['age-errors', SU({ year: '20', errs: { month: 1, year: 1 } })], ['adult', SU({ step: 'adult' })], ['adult-errors', Object.assign(SU({ step: 'adult' }), { errs: { name: 1, email: 1, pw: 1, agree: 1 } })], ['adult-done', SU({ step: 'adult', done: true })], ['teen', SU({ step: 'teen' })], ['teen-google', SU({ step: 'teen', via: 'google' })], ['under-13', SU({ step: 'child' })]],
  login: [['', {}], ['errors', { errs: { ident: 1, pw: 1 } }]],
  tasks: [['family', { acct: 'family' }], ['teen', { acct: 'teen' }]],
  wallet: [['family', { acct: 'family' }], ['family-confirmed', { acct: 'family', splitDone: true }], ['teen', { acct: 'teen' }], ['teen-logged', { acct: 'teen', splitDone: true, teen: { amt: '', src: 'gift', logged: 35, err: false, msg: true } }]],
  mentor: [['rho', { mentor: 'rho' }], ['dina', { mentor: 'dina' }]],
  parent: [['', {}], ['frozen', { frozen: true, approvedRows: [0] }]],
  staff: [['', {}], ['dialog', { dialog: true }]],
  board: [['line', B({})], ['line-try-again', B({ line: 5, moved: true, lineChecked: true })], ['line-correct', B({ line: 6, moved: true, lineChecked: true })],
          ['discount', B({ demo: 1, pred: '40' })], ['discount-revealed', B({ demo: 1, pred: '40', revealed: true, dstep: 2, table: true })],
          ['rule', B({ demo: 2, open: 'a', rule: { a: null, j: 'and', b: null, then: null, else: null } })], ['rule-tested', B({ demo: 2, tested: true, rule: { a: 'more', j: 'or', b: 'want', then: 'wait', else: 'buy' } })]],
})[route] || [['', {}]];
const lessonIdx=await page.evaluate(()=>{ let c=1; try{ c=T[S.lang].exercises[0].correctIdx; }catch(e){} return {correct:c,wrong:c===0?1:0}; });
const states=routes.flatMap(r=>variantsFor(r,lessonIdx).map(([v,o])=>[r,v,o]));
const widths=(process.env.WIDTHS||'320,375,768,1280').split(',').map(Number), langs=(process.env.LANGS||'en,es,pt').split(',');
const SCALE=[12,14,16,18,20,24,28,32,36,40,48,56,60,64,72,96];
const findings=[]; let checks=0;
for(const [route,variant,vs] of states) for(const w of widths) for(const lang of langs){
  await page.evaluate((r,w,l,vs)=>{clearTimeout(S._tt);if(typeof resetState==='function') resetState();Object.assign(S,{route:r,w,lang:l,theme:'light',stress:false,menu:false,tab:0,toast:null,dialog:false,demo:{sel:null,checked:false},errs:{},sel:null,checked:false,enter:false},vs);S.fx=null;render();},route,w,lang,vs);
  const res=await page.evaluate((SCALE)=>{
    const app=document.getElementById('app'); const out={spacing:new Map(),font:new Map(),measure:[],uniform:[],ratio:null,center:null,split:null,sizes:new Set(),radii:new Set(),accent:0,rhythm:[],gap:[]};
    const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0};
    const els=[...app.querySelectorAll('*')].filter(e=>!e.closest('svg')&&!e.closest('.sr-only')&&vis(e));
    const off=v=>{ if(v<=2) return false; return Math.abs(v/4-Math.round(v/4))>0.02; };
    const autoM=(e,p)=>{ const prop=p.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()); for(const sh of document.styleSheets){ let rules; try{rules=sh.cssRules}catch(x){continue} const walk=rs=>{ for(const r of rs){ if(r.cssRules&&!r.selectorText){ if(walk(r.cssRules)) return true; continue;} try{ if(r.style&&(r.style.getPropertyValue(prop)==='auto'||(r.style.margin&&r.style.margin.includes('auto'))||(r.style.getPropertyValue('margin-block')==='auto')) && e.matches(r.selectorText)) return true;}catch(x){} } return false; }; if(walk(rules)) return true; } return false; };
    const tag=e=>(e.tagName.toLowerCase()+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\s+/).slice(0,2).join('.'):''));
    for(const e of els){
      const cs=getComputedStyle(e);
      for(const p of ['paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginRight','marginBottom','marginLeft','rowGap','columnGap']){
        const v=parseFloat(cs[p]); if(!isFinite(v)||Number.isNaN(v)) continue; if(p.startsWith('margin')&&(cs[p]==='auto')) continue; if((p==='marginLeft'||p==='marginRight')&&Math.abs(parseFloat(cs.marginLeft)-parseFloat(cs.marginRight))<1&&v>0) continue;
        if(off(Math.abs(v))&&!(p.startsWith('margin')&&autoM(e,p))){ const k=tag(e)+' '+p+'='+(+v.toFixed(1)); out.spacing.set(k,(out.spacing.get(k)||0)+1); }
      }
      const hasText=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>0);
      if(hasText){ const fs=parseFloat(cs.fontSize); out.sizes.add(Math.round(fs*10)/10); if(!SCALE.includes(Math.round(fs*100)/100)&&!SCALE.includes(Math.round(fs))){ const k=tag(e)+' '+(+fs.toFixed(2))+'px'; out.font.set(k,(out.font.get(k)||0)+1);} }
      const br=parseFloat(cs.borderTopLeftRadius); if(br>0&&br<1000&&e.getBoundingClientRect().height>24) out.radii.add(Math.round(br));
    }
    // measure (characters per line) of running text
    const cv=document.createElement('canvas').getContext('2d');
    for(const e of app.querySelectorAll('p,li')){ if(!vis(e)||e.closest('.sr-only')) continue; if(e.tagName==='LI'&&e.querySelector('p,h1,h2,h3,div')) continue; const t=e.textContent.trim(); if(t.length<60) continue; const cs=getComputedStyle(e); cv.font=`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; const avg=cv.measureText(t).width/t.length; const w=e.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight); const cpl=w/avg; if(cpl>75) out.measure.push({el:tag(e),cpl:Math.round(cpl)}); }
    // uniform rows: >=3 siblings, same size, same row, same structure => "AI grid"
    for(const c of els){ if(c.closest('[data-uniform]')) continue; const kids=[...c.children].filter(vis); if(kids.length<3) continue; const rects=kids.map(k=>k.getBoundingClientRect()); const key=r=>Math.round(r.width/2)+'x'+Math.round(r.height/2); const groups={}; kids.forEach((k,i)=>{const kk=key(rects[i])+'@'+Math.round(rects[i].top/4); (groups[kk]=groups[kk]||[]).push(k);});
      for(const g of Object.values(groups)){ if(g.length>=3){ const sig=g.map(k=>[...k.children].map(x=>x.tagName).join(',')); if(new Set(sig).size===1&&g[0].getBoundingClientRect().width>90&&g[0].getBoundingClientRect().height>60) out.uniform.push({parent:tag(c),n:g.length,size:Math.round(g[0].getBoundingClientRect().width)+'x'+Math.round(g[0].getBoundingClientRect().height)}); } } }
    // heading : body ratio
    out.h1n=app.querySelectorAll('h1').length; const h1=app.querySelector('h1'); const body=app.querySelector('main p, .page p'); if(h1&&body){ out.ratio=+(parseFloat(getComputedStyle(h1).fontSize)/16).toFixed(2); }
    // centered text share
    const tb=[...app.querySelectorAll('h1,h2,h3,p')].filter(vis); if(tb.length){ const c=tb.filter(e=>getComputedStyle(e).textAlign==='center'&&e.getBoundingClientRect().height>24).length; out.center=+(c/tb.length).toFixed(2); }
    // hero split
    const hero=app.querySelector('.hero-site'); if(hero){ const k=[...hero.children].filter(vis).map(x=>x.getBoundingClientRect().width); if(k.length===2&&hero.getBoundingClientRect().width>0&&getComputedStyle(hero).gridTemplateColumns.split(' ').length>1) out.split=+(Math.max(...k)/Math.min(...k)).toFixed(2); }
    // accent buttons (default accent fill)
    out.accent=[...app.querySelectorAll('.btn')].filter(b=>vis(b)&&!/\bsecondary\b|\binverse\b|\bh-/.test(b.className)&&!b.disabled).length;
    // section rhythm
    const secs=[...app.querySelectorAll('.section')].filter(vis); out.rhythm=secs.map(s=>{const cs=getComputedStyle(s);const w=s.querySelector('.wrap');const lay=w?[...w.children].map(c=>c.className.split(' ')[0]||c.tagName).join('+'):'';return [cs.paddingTop,cs.backgroundColor,lay].join('|')});
    // gap between adjacent tap targets (<8px)
    const te=[...app.querySelectorAll('button,a[href],.btn,select,input:not([type=checkbox]):not([type=radio])')].filter(vis); const tt=te.map(e=>e.getBoundingClientRect());
    for(let i=0;i<tt.length;i++)for(let j=i+1;j<tt.length;j++){ if(te[i].closest('.tabbar')!==te[j].closest('.tabbar')||te[i].closest('.mcta')!==te[j].closest('.mcta')) continue; const a=tt[i],b=tt[j]; const vOverlap=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top); const hOverlap=Math.min(a.right,b.right)-Math.max(a.left,b.left); const hg=Math.max(a.left,b.left)-Math.min(a.right,b.right), vg=Math.max(a.top,b.top)-Math.min(a.bottom,b.bottom); if((vOverlap>8&&hg>=0&&hg<8)||(hOverlap>8&&vg>=0&&vg<8)) out.gap.push(Math.round(Math.min(hg<0?99:hg,vg<0?99:vg))); }
    return {h1n:out.h1n,spacing:[...out.spacing],font:[...out.font],measure:out.measure,uniform:out.uniform,ratio:out.ratio,center:out.center,split:out.split,sizes:out.sizes.size,radii:out.radii.size,accent:out.accent,rhythm:out.rhythm,gaps:out.gap.length};
  },SCALE);
  checks+=1;
  const id=`${route}${variant?':'+variant:''}@${w}/${lang}`;
  const add=(type,detail)=>findings.push({id,route,w,type,detail});
  if(res.spacing.length) add('off-grid-spacing',res.spacing.map(([k,n])=>k+' x'+n));
  if(res.font.length) add('off-scale-font',res.font.map(([k,n])=>k+' x'+n));
  if(res.measure.length&&route!=='system') add('measure>75',res.measure.map(m=>m.el+' '+m.cpl+'ch'));
  if(res.uniform.length&&['landing','how','families','signup','login','notfound'].includes(route)) add('uniform-card-row',res.uniform.map(u=>`${u.parent} x${u.n} of ${u.size}`));
  const MKT=['landing','how','families'].includes(route); if(route!=='system'&&res.h1n!==1) add('h1-count!=1',[res.h1n]);
  if(res.ratio!==null&&route!=='system'){ const min=MKT?3:1.5; if(res.ratio<min) add('h1-body-ratio<'+min,[res.ratio]); }
  if(res.center!==null&&res.center>0.5&&!['notfound','result'].includes(route)&&w>=768) add('centered-text-share>50%',[res.center]);
  if(res.split!==null&&res.split<1.15) add('symmetric-hero-split',[res.split]);
  if(res.sizes>9&&route!=='system') add('type-sizes>9',[res.sizes]);
  if(res.radii>6&&route!=='system') add('radii>6',[res.radii]);
  if(res.accent>3&&route!=='system') add('accent-buttons>3',[res.accent]);
  { let run=1; for(let i=1;i<res.rhythm.length;i++){ run=(res.rhythm[i]===res.rhythm[i-1])?run+1:1; if(run>=3){ add('identical-section-rhythm x3',[res.rhythm[i]]); break; } } }
  if(res.gaps) add('tap-gap<8px',[res.gaps+' pairs']);
}
const byType={}; for(const f of findings){ byType[f.type]=(byType[f.type]||0)+1; }
const summary={pages:checks,findings:findings.length,byType};
fs.writeFileSync(out,JSON.stringify({summary,findings},null,1));
console.log('PROPORTION AUDIT:',checks,'page states');
for(const [t,n] of Object.entries(byType).sort((a,b)=>b[1]-a[1])) console.log(String(n).padStart(4)+'x',t);
if(process.env.VERBOSE){ const seen=new Set(); for(const f of findings){ const k=f.type+'|'+(f.detail[0]||''); if(seen.has(k)) continue; seen.add(k); console.log(' ',f.id,f.type,'::',f.detail.slice(0,4).join(' ; ')); } }
await browser.close();
process.exit(findings.length?1:0);
