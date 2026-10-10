// Mängud: lõputu Wordle (EE/EN), 24 (nelja arvuga 24) ja Jada (jätka arvujada). Kõik telefonis, ilma võrguta.
const Games = (() => {
  const L = { get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch{return d}}, set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}} };
  const rnd = n => Math.floor(Math.random()*n);
  const pick = a => a[rnd(a.length)];
  let game = L.get("game","wordle"), el = null;

  // ---------- Wordle ----------
  const KB = { et:["qwertyuiopüõ","asdfghjklöä","↵zxcvbnm⌫"], en:["qwertyuiop","asdfghjkl","↵zxcvbnm⌫"] };
  const WL = {}; // lang -> {a:[], set:Set}
  let lang = L.get("wlang","et"), W = null, busy = false;
  async function words(l){
    if(!WL[l]){const r=await fetch(`words-${l}.json`);const j=await r.json();WL[l]={a:j.a,set:new Set([...j.a,...j.g])}}
    return WL[l];
  }
  async function newWord(){
    const w=await words(lang), used=new Set(L.get("wused-"+lang,[]));
    let pool=w.a.filter(x=>!used.has(x)); if(!pool.length){pool=w.a;used.clear()}
    const ans=pick(pool); used.add(ans); L.set("wused-"+lang,[...used]);
    W={ans,rows:[],cur:"",done:false}; L.set("wstate-"+lang,W);
  }
  function score(g,a){
    const r=Array(5).fill("b"), left={};
    [...a].forEach((c,i)=>{if(g[i]===c)r[i]="g";else left[c]=(left[c]||0)+1});
    [...g].forEach((c,i)=>{if(r[i]!=="g"&&left[c]){r[i]="y";left[c]--}});
    return r;
  }
  function keyState(){const s={};const rank={g:3,y:2,b:1};
    W.rows.forEach(g=>score(g,W.ans).forEach((x,i)=>{if((rank[x]||0)>(rank[s[g[i]]]||0))s[g[i]]=x}));return s}
  function wStats(){return L.get("wstats-"+lang,{p:0,w:0,s:0,best:0,d:[0,0,0,0,0,0]})}
  function vWordle(){
    const ks=keyState(), st=wStats();
    const rows=[...Array(6)].map((_,r)=>{const g=W.rows[r], cur=r===W.rows.length&&!W.done?W.cur:"";const sc=g?score(g,W.ans):null;
      return `<div class="wrow${r===W.rows.length&&!W.done?" cur":""}">${[...Array(5)].map((_,i)=>{const c=g?g[i]:cur[i]||"";
        return `<div class="tile${sc?" "+sc[i]:c?" fill":""}" style="${sc?`animation-delay:${i*90}ms`:""}">${esc(c)}</div>`}).join("")}</div>`}).join("");
    const kb=KB[lang].map(r=>`<div class="krow">${[...r].map(k=>`<button data-k="${k}" class="key ${ks[k]||""}${k==="↵"||k==="⌫"?" wide":""}">${k==="↵"?"OK":k}</button>`).join("")}</div>`).join("");
    const won=W.done&&W.rows[W.rows.length-1]===W.ans;
    return `<div class="wtop"><div class="seg sm">${[["et","Eesti"],["en","English"]].map(([k,n])=>`<button data-wl="${k}" class="${k===lang?"on":""}">${n}</button>`).join("")}</div>
        <span class="wst">🔥 ${st.s} · võite ${st.w}/${st.p}</span></div>
      <div class="board" id="board">${rows}</div>
      ${W.done?`<div class="wend"><div>${won?["Geniaalne!","Suurepärane!","Väga hea!","Hea!","Napilt!","Phew!"][W.rows.length-1]:`Sõna oli <b>${esc(W.ans.toUpperCase())}</b>`}</div>
        <button class="btn" data-act="wnew">Uus sõna →</button></div>`:`<div class="kb">${kb}</div>`}`;
  }
  async function wKey(k){
    if(!W||W.done||busy)return;
    if(k==="⌫"){W.cur=W.cur.slice(0,-1)}
    else if(k==="↵"){
      if(W.cur.length<5){shake("Liiga lühike");return}
      const w=await words(lang); if(!w.set.has(W.cur)){shake(lang==="et"?"Pole sõnastikus":"Not in word list");return}
      W.rows.push(W.cur); W.cur="";
      if(W.rows[W.rows.length-1]===W.ans||W.rows.length===6){W.done=true;const st=wStats(),win=W.rows[W.rows.length-1]===W.ans;
        st.p++;if(win){st.w++;st.s++;st.d[W.rows.length-1]++;st.best=Math.max(st.best,st.s)}else st.s=0;L.set("wstats-"+lang,st)}
      busy=true;setTimeout(()=>busy=false,600);
    }
    else if(W.cur.length<5&&/^[a-zõäöüšž]$/.test(k)) W.cur+=k;
    L.set("wstate-"+lang,W); draw();
  }
  function shake(msg){toast(msg);const r=el.querySelector(".wrow.cur");if(r){r.classList.remove("shake");void r.offsetWidth;r.classList.add("shake")}}

  // ---------- 24 ----------
  const OPS = {"+":(a,b)=>a+b,"−":(a,b)=>a-b,"×":(a,b)=>a*b,"÷":(a,b)=>b?a/b:NaN};
  function solve(ns){ // ns: [{v,e}] → avaldis või null
    if(ns.length===1)return Math.abs(ns[0].v-24)<1e-9?ns[0].e:null;
    for(let i=0;i<ns.length;i++)for(let j=0;j<ns.length;j++){if(i===j)continue;
      const rest=ns.filter((_,k)=>k!==i&&k!==j);
      for(const o in OPS){if((o==="+"||o==="×")&&i>j)continue;const v=OPS[o](ns[i].v,ns[j].v);if(!isFinite(v))continue;
        const r=solve([...rest,{v,e:`(${ns[i].e} ${o} ${ns[j].e})`}]);if(r)return r}}
    return null;
  }
  let T = L.get("t24",null), tsel = null, top = null;
  function new24(){
    const lvl=L.get("t24s",{s:0}).s;
    for(;;){const n=[...Array(4)].map(()=>1+rnd(lvl>=5?13:9));const s=solve(n.map(v=>({v,e:String(v)})));
      if(s){T={start:n,cards:n.map((v,i)=>({v,id:i})),hist:[],sol:s.replace(/^\((.*)\)$/,"$1"),done:false,shown:false};break}}
    tsel=null;top=null;L.set("t24",T);
  }
  const fmt=v=>Number.isInteger(v)?String(v):(Math.round(v*100)/100).toString().replace(".",",");
  function v24(){
    const st=L.get("t24s",{s:0,w:0,best:0});
    return `<div class="wtop"><span class="wst">Saa nelja arvuga <b>24</b>. Iga arv täpselt korra.</span><span class="wst">🔥 ${st.s} · ${st.w}</span></div>
      <div class="cards24">${T.cards.map(c=>`<button class="c24${tsel===c.id?" on":""}${T.done?" ok":""}" data-c="${c.id}">${fmt(c.v)}</button>`).join("")}</div>
      <div class="ops">${Object.keys(OPS).map(o=>`<button class="op${top===o?" on":""}" data-op="${o}">${o}</button>`).join("")}</div>
      ${T.shown?`<div class="clash" style="background:var(--accent-soft);color:var(--ink)">Lahendus: ${esc(T.sol)} = 24</div>`:""}
      ${T.done?`<div class="wend"><div>${T.shown?"Järgmine kord saad ise!":"Õige! 🎉"}</div><button class="btn" data-act="t24new">Järgmine →</button></div>`:
      `<div class="row3"><button class="btn ghost" data-act="t24undo">↶ Tagasi</button><button class="btn ghost" data-act="t24reset">Algusesse</button><button class="btn ghost" data-act="t24show">Näita</button></div>`}`;
  }
  function t24tap(id){
    if(T.done)return;
    if(tsel==null||top==null){tsel=tsel===id?null:id;draw();return}
    if(id===tsel){tsel=null;draw();return}
    const a=T.cards.find(c=>c.id===tsel),b=T.cards.find(c=>c.id===id),v=OPS[top](a.v,b.v);
    if(!isFinite(v)){toast("Nulliga ei saa jagada");return}
    T.hist.push(T.cards.map(c=>({...c})));
    const nid=Math.max(...T.cards.map(c=>c.id))+1;
    T.cards=T.cards.filter(c=>c!==a&&c!==b);T.cards.splice(0,0,{v,id:nid});
    tsel=nid;top=null;
    if(T.cards.length===1){
      if(Math.abs(v-24)<1e-9){T.done=true;const st=L.get("t24s",{s:0,w:0,best:0});if(!T.shown){st.s++;st.w++;st.best=Math.max(st.best,st.s)}L.set("t24s",st)}
      else{toast(`${fmt(v)}, mitte 24`);setTimeout(()=>{t24reset();draw()},700)}
    }
    L.set("t24",T);draw();
  }
  function t24reset(){T.cards=T.start.map((v,i)=>({v,id:i}));T.hist=[];tsel=null;top=null;L.set("t24",T)}

  // ---------- Jada ----------
  const SEQ = [ // [raskus, generaator → {s:[...], a, why}]
    [0,()=>{const a=rnd(20)+1,d=rnd(9)+2;return{s:[0,1,2,3,4].map(i=>a+i*d),a:a+5*d,why:`iga kord +${d}`}}],
    [0,()=>{const a=rnd(60)+40,d=rnd(7)+2;return{s:[0,1,2,3,4].map(i=>a-i*d),a:a-5*d,why:`iga kord −${d}`}}],
    [1,()=>{const a=rnd(4)+1,r=rnd(2)+2;return{s:[0,1,2,3,4].map(i=>a*r**i),a:a*r**5,why:`iga kord ×${r}`}}],
    [1,()=>{const o=rnd(5);return{s:[1,2,3,4,5].map(i=>(i+o)**2),a:(6+o)**2,why:"järjestikused ruudud"}}],
    [1,()=>{const a=rnd(5)+1,b=rnd(5)+2;const s=[a,b];while(s.length<6)s.push(s.at(-1)+s.at(-2));return{s:s.slice(0,5),a:s[5],why:"kaks eelmist kokku"}}],
    [2,()=>{const a=rnd(10)+1,d=rnd(3)+1,e=rnd(3)+1;const s=[a];let k=d;while(s.length<6){s.push(s.at(-1)+k);k+=e}return{s:s.slice(0,5),a:s[5],why:`vahe kasvab iga kord ${e} võrra`}}],
    [2,()=>{const a=rnd(9)+1,b=rnd(30)+20,d=rnd(4)+2,e=rnd(4)+2;const s=[];for(let i=0;i<6;i++)s.push(i%2?b-(i>>1)*e:a+(i>>1)*d);return{s:s.slice(0,5),a:s[5],why:`kaks jada vaheldumisi: +${d} ja −${e}`}}],
    [2,()=>{const a=rnd(4)+1,m=rnd(2)+2,p=rnd(3)+1;const s=[a];while(s.length<6)s.push(s.at(-1)*m+p);return{s:s.slice(0,5),a:s[5],why:`×${m}, siis +${p}`}}],
    [3,()=>{const P=[2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53];const o=rnd(8);return{s:P.slice(o,o+5),a:P[o+5],why:"algarvud"}}],
    [3,()=>{const o=rnd(3)+1;return{s:[0,1,2,3,4].map(i=>(i+o)**3),a:(5+o)**3,why:"järjestikused kuubid"}}],
    [3,()=>{const a=rnd(3)+2;const s=[a];let k=2;while(s.length<6){s.push(s.at(-1)*k);k++}return{s:s.slice(0,5),a:s[5],why:"×2, ×3, ×4, …"}}],
    [3,()=>{const o=rnd(4)+1,c=rnd(5)-2;return{s:[0,1,2,3,4].map(i=>(i+o)**2+c*(i+o)),a:(5+o)**2+c*(5+o),why:`n² ${c<0?"−":"+"} ${Math.abs(c)}n`}}],
  ];
  let J = L.get("jada",null);
  function newJ(){
    const st=L.get("jadas",{s:0,w:0,p:0,best:0}), lvl=Math.min(3,Math.floor(st.s/3));
    const g=pick(SEQ.filter(x=>x[0]<=lvl&&x[0]>=lvl-1)), q=g[1]();
    const opts=new Set([q.a]);const sp=Math.max(2,Math.round(Math.abs(q.a)*.15));
    while(opts.size<4){const d=q.a+(rnd(2)?1:-1)*(1+rnd(sp));if(d!==q.a)opts.add(d)}
    J={...q,o:[...opts].sort(()=>Math.random()-.5),pick:null,lvl};L.set("jada",J);
  }
  function vJada(){
    const st=L.get("jadas",{s:0,w:0,p:0,best:0});
    return `<div class="wtop"><span class="wst">Mis tuleb järgmiseks? Tase ${J.lvl+1}/4</span><span class="wst">🔥 ${st.s} · ${st.w}/${st.p}</span></div>
      <div class="seq">${J.s.map(x=>`<span>${x}</span>`).join("")}<span class="q">${J.pick==null?"?":J.a}</span></div>
      <div class="opts">${J.o.map(o=>`<button class="opt${J.pick!=null?(o===J.a?" good":o===J.pick?" bad":""):""}" data-opt="${o}">${o}</button>`).join("")}</div>
      ${J.pick!=null?`<div class="wend"><div>${J.pick===J.a?"Õige! 🎉":"Vale."} Reegel: ${esc(J.why)}.</div><button class="btn" data-act="jnew">Järgmine →</button></div>`:""}`;
  }
  function jPick(o){if(J.pick!=null)return;J.pick=o;const st=L.get("jadas",{s:0,w:0,p:0,best:0});st.p++;
    if(o===J.a){st.w++;st.s++;st.best=Math.max(st.best,st.s)}else st.s=0;L.set("jadas",st);L.set("jada",J);draw()}

  // ---------- shell ----------
  const GAMES=[["wordle","Wordle"],["t24","24"],["jada","Jada"]];
  async function draw(){
    if(!el)return;
    let body;
    if(game==="wordle"){if(!W||W.lang!==lang){W=L.get("wstate-"+lang,null);if(!W)await newWord();W.lang=lang}body=vWordle()}
    else if(game==="t24"){if(!T)new24();body=v24()}
    else{if(!J)newJ();body=vJada()}
    el.innerHTML=`<div class="seg">${GAMES.map(([k,n])=>`<button data-game="${k}" class="${k===game?"on":""}">${n}</button>`).join("")}</div><div class="gbody g-${game}">${body}</div>`;
  }
  function render(e){el=e;$("#sub").textContent="Doomscrolli asemel 🧠";draw()}

  document.addEventListener("click",async e=>{
    if(!el||!el.contains(e.target))return;
    const t=e.target.closest("[data-game],[data-wl],[data-k],[data-act],[data-c],[data-op],[data-opt]");if(!t)return;
    const d=t.dataset;
    if(d.game){game=d.game;L.set("game",game);draw()}
    else if(d.wl){lang=d.wl;L.set("wlang",lang);W=null;draw()}
    else if(d.k)wKey(d.k);
    else if(d.c)t24tap(+d.c);
    else if(d.op){if(T.done)return;top=top===d.op?null:d.op;if(tsel==null&&top)toast("Vali enne arv");draw()}
    else if(d.opt)jPick(+d.opt);
    else if(d.act==="wnew"){await newWord();W.lang=lang;draw()}
    else if(d.act==="t24new"){new24();draw()}
    else if(d.act==="t24undo"){if(T.hist.length){T.cards=T.hist.pop();tsel=null;top=null;L.set("t24",T)}draw()}
    else if(d.act==="t24reset"){t24reset();draw()}
    else if(d.act==="t24show"){T.shown=true;T.done=true;const st=L.get("t24s",{s:0,w:0,best:0});st.s=0;L.set("t24s",st);L.set("t24",T);draw()}
    else if(d.act==="jnew"){newJ();draw()}
  });
  addEventListener("keydown",e=>{
    if(game!=="wordle"||!el||!el.closest(".view.on")||e.metaKey||e.ctrlKey||e.target.tagName==="INPUT")return;
    const k=e.key==="Enter"?"↵":e.key==="Backspace"?"⌫":e.key.toLowerCase();
    if(k==="↵"||k==="⌫"||/^[a-zõäöüšž]$/.test(k)){e.preventDefault();wKey(k)}
  });
  return {render};
})();
