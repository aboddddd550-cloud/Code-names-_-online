/**
 * Codenames local (rooms via BroadcastChannel + localStorage)
 * - Place these three files in the same folder and open via server or GitHub Pages
 * - Works across tabs of the same browser (same origin) using room codes
 */

// ---------------- Helpers ----------------
function uidRand(len = 6){ return Math.random().toString(36).slice(2,2+len); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function formatTime(sec){ sec=Math.max(0,Math.floor(sec)); const m=String(Math.floor(sec/60)).padStart(2,'0'); const s=String(sec%60).padStart(2,'0'); return `${m}:${s}`; }
function now(){ return new Date().toLocaleTimeString(); }

// ---------------- DOM refs ----------------
const playerNameInput = document.getElementById('playerName');
const roomIdInput = document.getElementById('roomIdInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const myIdSpan = document.getElementById('myId');

const roomLabel = document.getElementById('roomLabel');
const hostLabel = document.getElementById('hostLabel');
const playersListEl = document.getElementById('playersList');

const roleSelect = document.getElementById('roleSelect');
const teamSelect = document.getElementById('teamSelect');
const setRoleBtn = document.getElementById('setRoleBtn');

const customWordsTA = document.getElementById('customWords');
const startingTeamSelect = document.getElementById('startingTeam');
const startGameBtn = document.getElementById('startGameBtn');
const regenBtn = document.getElementById('regenBtn');

const boardEl = document.getElementById('board');
const redLeftEl = document.getElementById('redLeft');
const blueLeftEl = document.getElementById('blueLeft');
const redMembersEl = document.getElementById('redMembers');
const blueMembersEl = document.getElementById('blueMembers');

const historyEl = document.getElementById('history');

const clueWordInput = document.getElementById('clueWord');
const clueNumberInput = document.getElementById('clueNumber');
const giveClueBtn = document.getElementById('giveClueBtn');
const currentClueEl = document.getElementById('currentClue');
const keycardGrid = document.getElementById('keycardGrid');
const showKeyBtn = document.getElementById('showKeyBtn');
const hideKeyBtn = document.getElementById('hideKeyBtn');

const startTimerBtn = document.getElementById('startTimerBtn');
const pauseTimerBtn = document.getElementById('pauseTimerBtn');
const resetTimerBtn = document.getElementById('resetTimerBtn');
const timerSecondsInput = document.getElementById('timerSeconds');
const timerDisplay = document.getElementById('timerDisplay');

// ---------------- Local identity ----------------
const me = { uid: uidRand(8), name: '' };
myIdSpan.textContent = `id:${me.uid}`;

// ---------------- Room storage / broadcast ----------------
let currentRoomId = null;
let channel = null;
function roomKey(r){ return `codenames_room_${r}`; }
function saveRoom(rid, room){ localStorage.setItem(roomKey(rid), JSON.stringify(room)); }
function loadRoom(rid){ const s = localStorage.getItem(roomKey(rid)); return s ? JSON.parse(s) : null; }
function openChannel(rid){
  if(channel) channel.close();
  channel = new BroadcastChannel('codenames_'+rid);
  channel.onmessage = (e)=>{ const {type,payload}=e.data||{}; handleMessage(type,payload); };
  return channel;
}
function broadcast(type,payload){ if(!channel) return; channel.postMessage({type,payload}); }

// ---------------- Default words ----------------
const builtinWords = [
  "قلم","كتاب","شمس","قمر","ماء","نهر","جبل","مدينة","طائرة","سفينة",
  "كرسي","نافذة","باب","كمبيوتر","هاتف","مفتاح","حديقة","زهرة","قطة","كلب",
  "سماء","نار","ثلج","قهوة","موسيقى","قصة","قصر","جسر","مطر","رعد",
  "علم","فيلم","لوحة","مسرح","ملعب","سباق","نجمة","فضاء","روبوت","مخترع"
];

// ---------------- Room model helpers ----------------
function createEmptyRoom(hostId){
  return {
    host: hostId,
    players: {},    // uid -> {uid,name,role,team,joinedAt}
    board: null,    // array of 25 words
    keycard: null,  // array of 25 roles
    revealed: null, // object index->bool
    state: { phase:'lobby', turn:null, clue:null, guessesLeft:0, timer:{running:false,secondsLeft:60} },
    history: {}
  };
}
function generateKeycard(starting){
  const roles = [];
  if(starting === 'red'){ roles.push(...Array(9).fill('red'), ...Array(8).fill('blue')); }
  else { roles.push(...Array(9).fill('blue'), ...Array(8).fill('red')); }
  roles.push('assassin');
  while(roles.length < 25) roles.push('neutral');
  shuffle(roles);
  return roles;
}
function addHistory(room,text){
  const k = Date.now() + '-' + uidRand(4);
  room.history[k] = `[${now()}] ${text}`;
}

// ---------------- Message handler ----------------
function handleMessage(type,payload){
  if(!payload || !payload.roomId) return;
  const rid = payload.roomId;
  let room = loadRoom(rid);
  switch(type){
    case 'join':
      room = room || createEmptyRoom(payload.player.uid);
      room.players[payload.player.uid]=payload.player;
      saveRoom(rid,room);
      renderRoom(rid,room);
      break;
    case 'role_change':
      if(!room) return;
      if(room.players && room.players[payload.uid]){
        room.players[payload.uid].role=payload.role; room.players[payload.uid].team=payload.team;
        saveRoom(rid,room); renderRoom(rid,room);
      }
      break;
    case 'start_game':
      room = room || createEmptyRoom(payload.hostUid);
      room.board = payload.words; room.keycard = payload.keycard; room.revealed = payload.revealed;
      room.state.phase='playing'; room.state.turn=payload.starting; room.state.clue=null; room.state.guessesLeft=0;
      addHistory(room, `المضيف بدأ اللعبة — يبدأ: ${payload.starting}`);
      saveRoom(rid,room); renderRoom(rid,room);
      break;
    case 'give_clue':
      if(!room) return;
      room.state.clue={word:payload.word,number:payload.number,by:payload.uid}; room.state.guessesLeft=payload.number+1;
      addHistory(room, `${room.players[payload.uid]?.name||payload.uid} أعطى تلميح: ${payload.word} (${payload.number})`);
      saveRoom(rid,room); renderRoom(rid,room);
      break;
    case 'guess_request':
      // forward to host (host will handle)
      if(room && room.host === me.uid){
        processGuessAsHost(rid,payload.uid,payload.index);
      }
      break;
    case 'state_update':
      saveRoom(rid,payload.room); renderRoom(rid,payload.room);
      break;
    case 'timer_update':
      if(!room) return;
      room.state.timer = payload.timer; saveRoom(rid,room); renderRoom(rid,room);
      break;
    default:
      break;
  }
}

// ---------------- Host logic (authoritative) ----------------
function processGuessAsHost(roomId,guesserUid,index){
  let room = loadRoom(roomId);
  if(!room) return;
  if(room.revealed && room.revealed[index]) return;
  room.revealed[index]=true;
  const color = room.keycard[index];
  addHistory(room, `${room.players[guesserUid]?.name||guesserUid} خمن بطاقة(${index}) => ${color}`);
  if(color==='assassin'){
    room.state.phase='ended'; room.state.winner=(room.players[guesserUid]?.team==='red')?'blue':'red';
    addHistory(room, `انتهت اللعبة — الفائز: ${room.state.winner} (بسبب Assassin)`);
  } else {
    const guesserTeam = room.players[guesserUid]?.team;
    if(color !== guesserTeam){
      room.state.turn = (room.state.turn==='red')?'blue':'red';
      room.state.clue = null; room.state.guessesLeft = 0;
    } else {
      room.state.guessesLeft = Math.max((room.state.guessesLeft||1)-1,0);
    }
    // check win
    let redLeft=0,blueLeft=0;
    for(let i=0;i<25;i++){
      if(room.keycard[i]==='red' && !room.revealed[i]) redLeft++;
      if(room.keycard[i]==='blue' && !room.revealed[i]) blueLeft++;
    }
    if(redLeft===0){ room.state.phase='ended'; room.state.winner='red'; addHistory(room,'انتهت اللعبة — الفريق الأحمر فاز'); }
    if(blueLeft===0){ room.state.phase='ended'; room.state.winner='blue'; addHistory(room,'انتهت اللعبة — الفريق الأزرق فاز'); }
  }
  saveRoom(roomId,room);
  broadcast('state_update',{roomId,room});
}

// ---------------- UI render ----------------
function renderRoom(rid,room){
  if(!room) return;
  roomLabel.textContent = rid;
  hostLabel.textContent = room.host;
  // players list
  playersListEl.innerHTML='';
  Object.values(room.players||{}).forEach(p=>{
    const d=document.createElement('div'); d.className='pitem'; d.textContent=`${p.name} — ${p.team||'-'} — ${p.role||'-'}` + (p.uid===room.host?' (المضيف)':'');
    playersListEl.appendChild(d);
  });
  // team members
  redMembersEl.innerHTML=''; blueMembersEl.innerHTML='';
  Object.values(room.players||{}).forEach(p=>{
    const el=document.createElement('div'); el.textContent = p.name;
    if(p.team==='red') redMembersEl.appendChild(el); else if(p.team==='blue') blueMembersEl.appendChild(el);
  });

  // board
  if(room.board && room.keycard && room.revealed){
    buildBoard(rid,room);
  } else {
    boardEl.innerHTML = '<div class="muted">اللعبة لم تبدأ بعد</div>';
    redLeftEl.textContent='0'; blueLeftEl.textContent='0';
  }
  // history
  historyEl.innerHTML='';
  const arr = Object.values(room.history||{}).slice(-100).reverse();
  arr.forEach(line => { const el=document.createElement('div'); el.textContent=line; historyEl.appendChild(el); });

  // clue & keycard visibility for spymaster role in this client
  const my = room.players?.[me.uid];
  if(my && my.role==='spymaster'){
    document.getElementById('spymasterPanel').hidden = false;
    // keycard is only shown when user asked; buildKeycard only when visible
  } else {
    document.getElementById('spymasterPanel').hidden = true;
  }

  // timer display
  timerDisplay.textContent = formatTime(room.state?.timer?.secondsLeft || 0);
  if(room.state?.clue) currentClueEl.textContent = `تلميح: ${room.state.clue.word} (${room.state.clue.number}) — تخمينات متبقية: ${room.state.guessesLeft}`;
  else currentClueEl.textContent = 'لا توجد تلميحات';
}

// build board UI
function buildBoard(rid,room){
  boardEl.innerHTML='';
  for(let i=0;i<25;i++){
    const c=document.createElement('div'); c.className='card'; c.textContent = room.board[i] || '';
    if(room.revealed[i]){ c.classList.add('revealed'); c.classList.add(room.keycard[i]); }
    c.onclick = () => {
      // only non-spymaster can guess
      const meP = room.players?.[me.uid];
      if(meP && meP.role === 'spymaster') return;
      // optimistic: notify host via broadcast; host will process and broadcast state_update
      broadcast('guess_request',{roomId:rid,uid:me.uid,index:i});
    };
    boardEl.appendChild(c);
  }
  // update remaining counts
  let redLeft=0,blueLeft=0;
  for(let i=0;i<25;i++){
    if(room.keycard[i]==='red' && !room.revealed[i]) redLeft++;
    if(room.keycard[i]==='blue' && !room.revealed[i]) blueLeft++;
  }
  redLeftEl.textContent = redLeft;
  blueLeftEl.textContent = blueLeft;
}

// build keycard UI (for spymaster when requested)
function buildKeycard(room){
  keycardGrid.innerHTML=''; keycardGrid.hidden=false;
  for(let i=0;i<room.keycard.length;i++){
    const el=document.createElement('div'); el.className='spy-card '+room.keycard[i]; el.textContent = room.board[i] || '';
    keycardGrid.appendChild(el);
  }
}

// ---------------- UI actions ----------------
createRoomBtn.onclick = () => {
  const rid = 'r' + uidRand(6);
  roomIdInput.value = rid;
  joinRoom(rid);
};
joinRoomBtn.onclick = () => {
  const rid = roomIdInput.value.trim();
  if(!rid) return alert('اكتب رمز الغرفة أو أنشئ واحدة');
  joinRoom(rid);
};

function joinRoom(rid){
  currentRoomId = rid;
  openChannel(rid);
  let room = loadRoom(rid);
  if(!room){
    room = createEmptyRoom(me.uid);
    // add me
    me.name = playerNameInput.value.trim() || `لاعب-${me.uid}`;
    room.players[me.uid] = { uid:me.uid, name:me.name, role:roleSelect.value, team:teamSelect.value, joinedAt:Date.now() };
    saveRoom(rid,room);
  } else {
    me.name = playerNameInput.value.trim() || `لاعب-${me.uid}`;
    room.players[me.uid] = { uid:me.uid, name:me.name, role:roleSelect.value, team:teamSelect.value, joinedAt:Date.now() };
    saveRoom(rid,room);
  }
  // broadcast join
  broadcast('join',{roomId:rid,player:room.players[me.uid]});
  renderRoom(rid,room);
}

// set role/team
setRoleBtn.onclick = () => {
  if(!currentRoomId) return alert('انضم لغرفة أولاً');
  const rid = currentRoomId;
  const room = loadRoom(rid);
  if(!room) return;
  const role = roleSelect.value; const team = teamSelect.value;
  if(room.players && room.players[me.uid]){
    room.players[me.uid].role = role; room.players[me.uid].team = team;
    saveRoom(rid,room);
    broadcast('role_change',{roomId:rid,uid:me.uid,role,team});
    renderRoom(rid,room);
  }
};

// start game (host only)
startGameBtn.onclick = () => {
  if(!currentRoomId) return alert('انضم لغرفة');
  const rid = currentRoomId; const room = loadRoom(rid);
  if(!room) return;
  if(room.host !== me.uid) return alert('فقط المضيف يمكنه بدء اللعبة');

  let words = [];
  const raw = customWordsTA.value.trim();
  if(raw.length){
    words = raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    if(words.length !== 25) return alert('يجب إدخال 25 كلمة تماماً');
  } else {
    words = shuffle([...builtinWords]).slice(0,25);
  }
  const starting = startingTeamSelect.value;
  const keycard = generateKeycard(starting);
  const revealed = {}; for(let i=0;i<25;i++) revealed[i]=false;
  // broadcast start_game to all tabs
  broadcast('start_game',{roomId:rid,hostUid:me.uid,words,keycard,revealed,starting});
};

// regenerate
regenBtn.onclick = () => {
  if(!currentRoomId) return alert('انضم لغرفة');
  const rid=currentRoomId; const room=loadRoom(rid);
  if(!room || room.host !== me.uid) return alert('فقط المضيف يمكنه إعادة التوليد');
  const words = shuffle([...builtinWords]).slice(0,25);
  const starting = startingTeamSelect.value;
  const keycard = generateKeycard(starting);
  const revealed = {}; for(let i=0;i<25;i++) revealed[i]=false;
  broadcast('start_game',{roomId:rid,hostUid:me.uid,words,keycard,revealed,starting});
};

// give clue (spymaster)
giveClueBtn.onclick = () => {
  if(!currentRoomId) return alert('انضم لغرفة');
  const rid=currentRoomId; const room=loadRoom(rid);
  const mep = room.players?.[me.uid];
  if(!mep || mep.role !== 'spymaster') return alert('فقط Spymaster يمكنه إرسال تلميح');
  const word = clueWordInput.value.trim();
  const number = parseInt(clueNumberInput.value||'0',10);
  if(!word) return alert('أدخل كلمة التلميح');
  broadcast('give_clue',{roomId:rid,uid:me.uid,word,number});
  clueWordInput.value=''; clueNumberInput.value='';
};

// show/hide keycard (for spymaster in this tab only)
showKeyBtn.onclick = () => {
  const room = loadRoom(currentRoomId); if(!room) return;
  if(!(room.players && room.players[me.uid] && room.players[me.uid].role==='spymaster')) return alert('أنت لست Spymaster');
  buildKeycard(room);
};
hideKeyBtn.onclick = () => { keycardGrid.hidden = true; keycardGrid.innerHTML=''; };

// guesses: guest clicks on card -> broadcast guess_request; host will process

// timer controls (host authoritative)
let hostTimerInterval = null;
startTimerBtn.onclick = () => {
  if(!currentRoomId) return alert('انضم لغرفة');
  const room = loadRoom(currentRoomId); if(!room) return;
  const secs = parseInt(timerSecondsInput.value||'60',10);
  // only host runs timer loop
  if(room.host !== me.uid){
    // tell host to start by adding history request (simple approach)
    broadcast('timer_update',{roomId:currentRoomId,timer:{running:true,secondsLeft:secs}});
    return;
  }
  // host runs
  clearInterval(hostTimerInterval);
  let s = secs;
  room.state.timer = {running:true,secondsLeft:s}; saveRoom(currentRoomId,room); broadcast('timer_update',{roomId:currentRoomId,timer:room.state.timer});
  hostTimerInterval = setInterval(()=> {
    s = Math.max(0,s-1);
    const r = loadRoom(currentRoomId); if(!r){ clearInterval(hostTimerInterval); return; }
    r.state.timer.secondsLeft = s; saveRoom(currentRoomId,r); broadcast('timer_update',{roomId:currentRoomId,timer:r.state.timer});
    if(s<=0){ clearInterval(hostTimerInterval); r.state.timer.running=false; saveRoom(currentRoomId,r); broadcast('timer_update',{roomId:currentRoomId,timer:r.state.timer}); }
  },1000);
};
pauseTimerBtn.onclick = () => { broadcast('timer_update',{roomId:currentRoomId,timer:{running:false}}); };
resetTimerBtn.onclick = () => { const secs = parseInt(timerSecondsInput.value||'60',10); broadcast('timer_update',{roomId:currentRoomId,timer:{running:false,secondsLeft:secs}}); };

// ---------------- Initialization helpers ----------------
(function initFromUrl(){
  const p = new URLSearchParams(location.search); const rid = p.get('room');
  if(rid) roomIdInput.value = rid;
})();

(function tryRenderIfRoom(){
  const rid = roomIdInput.value.trim(); if(!rid) return;
  const r = loadRoom(rid); if(r) renderRoom(rid,r);
})();

// ---------------- End ----------------
