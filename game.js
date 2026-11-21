(() => {
"use strict";
const N=8,COLORS=["#ff5b85","#ffbd4a","#54d8c8","#6f8cff","#bd79f5","#8ed85d"],ICONS=["●","◆","⬟","★","✿","♥"];
const $=id=>document.getElementById(id),boardEl=$("board");
let grid=[],score=0,moves=25,level=1,target=600,selected=null,locked=false,paused=false,soundOn=true,audio=null;
const rand=()=>Math.floor(Math.random()*COLORS.length),sleep=ms=>new Promise(r=>setTimeout(r,ms));
function sound(freq=440,duration=.07){if(!soundOn)return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=freq;o.type="sine";g.gain.setValueAtTime(.04,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration)}catch(e){}}
function hasRunOn(board,r,c,v){return(c>=2&&board[r][c-1].color===v&&board[r][c-2].color===v)||(r>=2&&board[r-1][c].color===v&&board[r-2][c].color===v)}
function fresh(){const next=[];for(let r=0;r<N;r++){const row=[];for(let c=0;c<N;c++){let v=rand(),tries=0;while(hasRunOn(next,r,c,v)&&tries++<20)v=rand();row.push({color:v,power:null})}next.push(row)}grid=next}
function matches(){
 const s=new Set(),runs=[];
 for(let r=0;r<N;r++){let a=0;for(let c=1;c<=N;c++){if(c<N&&grid[r][c].color===grid[r][a].color)continue;if(c-a>=3){const cells=[];for(let k=a;k<c;k++){s.add(r*N+k);cells.push(r*N+k)}runs.push(cells)}a=c}}
 for(let c=0;c<N;c++){let a=0;for(let r=1;r<=N;r++){if(r<N&&grid[r][c].color===grid[a][c].color)continue;if(r-a>=3){const cells=[];for(let k=a;k<r;k++){s.add(k*N+c);cells.push(k*N+c)}runs.push(cells)}a=r}}
 return{set:s,runs};
}
function render(){
 boardEl.innerHTML="";
 for(let r=0;r<N;r++)for(let c=0;c<N;c++){
  const cell=grid[r][c],b=document.createElement("button");
  b.className="gem"+(selected&&selected.r===r&&selected.c===c?" selected":"")+(cell.power?" special-gem "+cell.power:"");
  b.style.setProperty("--gem",COLORS[cell.color]);b.setAttribute("role","gridcell");
  b.setAttribute("aria-label","Row "+(r+1)+", column "+(c+1)+", "+(cell.power==="bomb"?"bomb":cell.power==="rainbow"?"rainbow gem":"gem"));
  b.innerHTML="<span>"+(cell.power==="bomb"?"💣":cell.power==="rainbow"?"🌈":ICONS[cell.color])+"</span>";
  b.disabled=locked||paused;b.addEventListener("click",()=>tap(r,c));boardEl.appendChild(b);
 }
}
function update(){$("score").textContent=score.toLocaleString();$("moves").textContent=moves;$("target").textContent=target.toLocaleString();$("level").textContent=level;$("progressBar").style.width=Math.min(100,score/target*100)+"%"}
function adjacent(a,b){return Math.abs(a.r-b.r)+Math.abs(a.c-b.c)===1}
function specialForSwap(a,b,runs){
 const line=runs.find(run=>run.length>=5&&run.includes(b.r*N+b.c))||runs.find(run=>run.length>=5&&run.includes(a.r*N+a.c));
 if(line)return{index:line.includes(b.r*N+b.c)?b.r*N+b.c:a.r*N+a.c,power:"rainbow"};
 const four=runs.find(run=>run.length===4&&run.includes(b.r*N+b.c))||runs.find(run=>run.length===4&&run.includes(a.r*N+a.c));
 if(four)return{index:four.includes(b.r*N+b.c)?b.r*N+b.c:a.r*N+a.c,power:"bomb"};
 return null;
}
async function tap(r,c){
 if(locked||paused)return;const p={r,c};
 if(!selected){selected=p;render();return}
 if(selected.r===r&&selected.c===c){selected=null;render();return}
 if(!adjacent(selected,p)){selected=p;render();return}
 const a=selected,b=p;selected=null;[grid[a.r][a.c],grid[b.r][b.c]]=[grid[b.r][b.c],grid[a.r][a.c]];
 const found=matches();
 if(!found.set.size){[grid[a.r][a.c],grid[b.r][b.c]]=[grid[b.r][b.c],grid[a.r][a.c]];sound(180);$("hint").textContent="No match — try another swap!";render();return}
 const created=specialForSwap(a,b,found.runs);locked=true;moves--;sound(520);
 await resolve([...found.set],created);locked=false;update();render();
 if(score>=target)showModal(true);else if(moves<=0)showModal(false);
}
async function resolve(initial,created){
 let clear=initial;
 while(clear.length){
  const clearSet=new Set(clear);
  if(created){const i=created.index, r=Math.floor(i/N),c=i%N;grid[r][c].power=created.power;clearSet.delete(i);$("hint").textContent=created.power==="rainbow"?"Rainbow Gem created! 🌈":"Bomb created! 💣";}
  let activated=true;
  while(activated){activated=false;
   for(const i of [...clearSet]){
    const cell=grid[Math.floor(i/N)][i%N];
    if(!cell||!cell.power)continue;
    if(cell.power==="bomb"){
     const r=Math.floor(i/N),c=i%N;
     for(let rr=Math.max(0,r-1);rr<=Math.min(N-1,r+1);rr++)for(let cc=Math.max(0,c-1);cc<=Math.min(N-1,c+1);cc++){const j=rr*N+cc;if(!clearSet.has(j)){clearSet.add(j);activated=true}}
    }else if(cell.power==="rainbow"){
     const counts=Array(COLORS.length).fill(0);
     grid.flat().forEach(x=>{if(x)counts[x.color]++});
     const chosen=counts.indexOf(Math.max(...counts));
     grid.flat().forEach((x,j)=>{if(x&&x.color===chosen&&!clearSet.has(j)){clearSet.add(j);activated=true}});
    }
   }
  }
  score+=clearSet.size*20+(clearSet.size>=4?50:0);
  clearSet.forEach(i=>{grid[Math.floor(i/N)][i%N]=null});
  render();sound(660,.12);await sleep(180);
  for(let c=0;c<N;c++){
   const kept=[];for(let r=N-1;r>=0;r--)if(grid[r][c])kept.push(grid[r][c]);
   for(let r=N-1;r>=0;r--)grid[r][c]=r>=N-kept.length?kept[N-1-r]:{color:rand(),power:null};
  }
  render();await sleep(130);clear=matches().set.size?[...matches().set]:[];created=null;
 }
 update();$("hint").textContent="Great match! Keep it going!";
}
function showModal(won){$("modalIcon").textContent=won?"🏆":"💫";$("modalEyebrow").textContent=won?"LEVEL CLEARED":"NICE TRY";$("modalTitle").textContent=won?"Amazing!":"Out of moves!";$("modalText").textContent=won?"You scored "+score.toLocaleString()+" points! Ready for the next level?":"You scored "+score.toLocaleString()+" points. Try again and beat the target!";$("modalAction").textContent=won?"Next level →":"Try again ↻";$("modalAction").onclick=()=>{$("modal").classList.add("hidden");if(won){level++;target=Math.round(target*1.3);moves=25}else{score=0;moves=25}start()};$("modal").classList.remove("hidden")}
function start(){selected=null;paused=false;locked=false;fresh();update();render();$("pauseBtn").innerHTML="Ⅱ <span>Pause</span>";$("hint").textContent="Swap two gems to match 3 or more!"}
$("restartBtn").addEventListener("click",()=>{score=0;moves=25;start();sound(350)});
$("shuffleBtn").addEventListener("click",()=>{if(locked||paused)return;fresh();selected=null;render();$("hint").textContent="Fresh board! Find a match.";sound(480)});
$("pauseBtn").addEventListener("click",()=>{if(locked)return;paused=!paused;$("pauseBtn").innerHTML=paused?"▶ <span>Resume</span>":"Ⅱ <span>Pause</span>";$("hint").textContent=paused?"Game paused. Tap Resume to continue.":"Back to the puzzle!";render()});
$("soundBtn").addEventListener("click",()=>{soundOn=!soundOn;$("soundBtn").textContent=soundOn?"♫":"♪";if(soundOn)sound(500)});
start();
})();