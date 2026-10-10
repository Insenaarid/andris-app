// Uudised: news.json (GitHub Actions kogub iga 2 h, tools/news.py) + 👍/👎 hääled telefonis.
// „Sulle“ järjestab hääletuste põhjal õpitud kaalude järgi (allikas, kategooria, märksõnad).
const News = (() => {
  const SRC = ["https://raw.githubusercontent.com/Insenaarid/andris-app/main/news.json", "news.json"];
  const CATS = [["for","Sulle"],["ee","Eesti"],["eu","Euroopa"],["world","Maailm"],["energy","Energia"],["sci","Teadus"]];
  const CN = {ee:"Eesti",eu:"Euroopa",world:"Maailm",energy:"Energia",sci:"Teadus"};
  const STOP = new Set("that this with from have will were their about after over into more than been says said what when they your which also just could would there while where some other most only says says new uus ning ning kui aga see mis oli ole nad kes oma veel ning seda selle ning samuti pärast juba võib võiks kuid ning nende ning tema enam ning".split(" "));
  let N = null, cat = (()=>{try{return localStorage.getItem("ncat")||"for"}catch{return"for"}})(), err = "";
  const votes = (()=>{try{return JSON.parse(localStorage.getItem("nvotes")||"{}")}catch{return{}}})();
  const save = () => {try{const k=Object.keys(votes);if(k.length>3000)k.sort((a,b)=>votes[a].at-votes[b].at).slice(0,k.length-3000).forEach(x=>delete votes[x]);localStorage.setItem("nvotes",JSON.stringify(votes))}catch{}};
  const toks = t => [...new Set(t.toLowerCase().split(/[^a-zõäöüšž0-9]+/).filter(w=>w.length>3&&!STOP.has(w)).map(w=>w.slice(0,6)))];
  const feats = i => ["s:"+i.s, ...i.c.map(c=>"c:"+c), ...toks(i.t).map(w=>"w:"+w)];

  async function load(){
    for(const u of SRC){
      try{const r=await fetch(u+(u.startsWith("http")?"?t="+Math.floor(Date.now()/3e5):""),{cache:"no-store"});if(!r.ok)continue;
        N=await r.json();err="";try{localStorage.setItem("ncache",JSON.stringify(N))}catch{};return}catch{}
    }
    if(!N){try{N=JSON.parse(localStorage.getItem("ncache"))}catch{}}
    err=N?"":"Uudiseid ei saanud laadida";
  }

  // Õpitud kaal igale tunnusele: (meeldib − ei meeldi) / (hääli + 2). Energeetika saab algselt boonuse.
  function model(){
    const w={};
    for(const v of Object.values(votes)) for(const f of v.f){const x=w[f]||(w[f]={s:0,n:0});x.s+=v.v;x.n++}
    const k=f=>w[f]?w[f].s/(w[f].n+2):0;
    return i=>{const f=feats(i);let s=0,ws=0,nw=0;
      for(const x of f){if(x[0]==="w"){if(w[x]){ws+=k(x);nw++}}else s+=k(x)*(x[0]==="s"?1:1.5)}
      if(nw)s+=ws/Math.sqrt(nw);
      if(i.c.includes("energy"))s+=.6;
      return s-(Date.now()/1e3-i.d)/86400*.8};
  }

  function list(){
    if(!N) return [];
    let it=N.items.filter(i=>cat==="for"||i.c.includes(cat));
    if(cat==="for"){const sc=model();it=it.filter(i=>votes[i.id]?.v!==-1).map(i=>[sc(i),i]).sort((a,b)=>b[0]-a[0]).map(x=>x[1])}
    return it.slice(0,120);
  }

  function row(i){
    const v=votes[i.id]?.v||0;
    return `<div class="nrow${v<0?" down":""}" data-nid="${esc(i.id)}">
      <a class="nlink" href="${esc(i.u)}" target="_blank" rel="noopener">
        <div class="main"><div class="nt">${esc(i.t)}</div>${i.x?`<div class="nx">${esc(i.x)}</div>`:""}
        <div class="m">${esc(i.s)} · ${ago(i.d)}${i.c.filter(c=>c!==cat).map(c=>` · ${CN[c]}`).join("")}</div></div>
        ${i.img?`<img class="nimg" src="${esc(i.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:""}</a>
      <div class="vote"><button data-vote="1" class="${v>0?"on":""}" aria-label="Meeldib">👍</button><button data-vote="-1" class="${v<0?"on":""}" aria-label="Ei meeldi">👎</button></div></div>`;
  }

  function render(el){
    const nv=Object.keys(votes).length, l=list();
    el.innerHTML=`<div class="filters">${CATS.map(([k,n])=>`<button class="pill${k===cat?" on":""}" data-ncat="${k}">${n}</button>`).join("")}</div>
      ${cat==="for"?`<p class="hint">${nv<15?`Hinda 👍/👎, siis õpin, mis sulle meeldib. Hääli: ${nv}.`:`Järjestatud ${nv} hääle põhjal.`}</p>`:""}
      <div class="card" style="margin-top:10px">${l.map(row).join("")||`<div class="empty">${N?"Uudiseid pole":err||"Laen…"}</div>`}</div>
      <p class="hint">Allikad: ERR, BBC, Guardian, Politico, DW, Carbon Brief, Euractiv, IEEE Spectrum, Nature jt. Hääled jäävad telefoni.</p>`;
    $("#sub").textContent=N?`Uuendatud ${ago(N.generated)} tagasi`:"";
  }

  function vote(id,v){
    const i=N?.items.find(x=>x.id===id);if(!i)return;
    if(votes[id]?.v===v)delete votes[id];else votes[id]={v,f:feats(i),at:Date.now()};
    save();
    const r=document.querySelector(`[data-nid="${CSS.escape(id)}"]`);
    if(r){r.outerHTML=row(i)}
    if(v<0&&cat==="for"&&votes[id])toast("Peidetud, näitan vähem selliseid");
  }

  document.addEventListener("click",e=>{
    const c=e.target.closest("[data-ncat]");if(c){cat=c.dataset.ncat;try{localStorage.setItem("ncat",cat)}catch{};render($("#v-uudised"));return}
    const b=e.target.closest("[data-vote]");if(b){const r=b.closest("[data-nid]");vote(r.dataset.nid,+b.dataset.vote)}
  });
  return {load,render,votes};
})();
