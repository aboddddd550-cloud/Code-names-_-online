/* script.js
   Codenames — local rooms using BroadcastChannel + localStorage
   Limitations: sync works across tabs/windows of the same origin + same browser (not across devices).
*/

// ---------- Helpers ----------
function uidRand(len = 6){ return Math.random().toString(36).slice(2, 2+len); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function nowStr(){ return new Date().toLocaleTimeString(); }
function formatTime(sec){ sec = Math.max(0, Math.floor(sec)); const m = String(Math.floor(sec/60)).padStart(2,'0'); const s = String(sec%60).padStart(2,'0'); return `${m}:${s}`; }

// ---------- DOM ----------
const playerNameInput = document.getElementById('playerName');
const roomIdInput = document.getElementById('roomIdInput');
const joinBtn = document.getElementById('joinBtn');
const createBtn = document.getElementById('createBtn');
const myIdSpan = document.getElementById('myId');
const roomLabel = document.getElementById('roomLabel');
const hostLabel = document.getElementById('hostLabel');
const playersList = document.getElementById('playersList');

const roleSelect = document.getElementById('roleSelect');
const teamSelect = document.getElementById('teamSelect');
const setRoleBtn = document.getElementById('setRoleBtn');

const customWordsTA = document.getElementById('customWords');
const startingTeamSel = document.getElementById('startingTeam');
const startBtn = document.getElementById('startBtn');
const regenBtn = document.getElementById('regenBtn');

const boardEl = document.getElementById('board');
const spymasterPanel = document.getElementById('spymasterPanel');
const keycardGrid = document.getElementById('keycardGrid');

const clueWordInput = document.getElementById('clueWord');
const clueNumberInput = document.getElementById('clueNumber');
const giveClueBtn = document.getElementById('giveClueBtn');
const currentClue = document.getElementById('currentClue');

const historyEl = document.getElementById('history');

const timerDisplay = document.getElementById('timerDisplay');
const timerSecondsInput = document.getElementById('timerSeconds');
const startTimerBtn = document.getElementById('startTimerBtn');
const pauseTimerBtn = document.getElementById('pauseTimerBtn');
const resetTimerBtn = document.getElementById('resetTimerBtn');

// ---------- Local identity ----------
const me = { uid: uidRand(8), name: '' };
myIdSpan.textContent = `id: ${me.uid}`;

// ---------- Broadcast channel (room-scoped) ----------
let channel = null;
function getChannel(roomId){
  if(channel) channel.close();
  channel = new BroadcastChannel('codenames-' + roomId);
  channel.onmessage = msg => {
    if(!msg || !msg.data) return;
    const { type, payload } = msg.data;
    handleMessage(type, payload);
  };
  return channel;
}

// ---------- Room state storage helpers ----------
function roomKey(roomId){ return `codenames_room_${roomId}`; }
function saveRoomState(roomId, state){
  localStorage.setItem(roomKey(roomId), JSON.stringify(state));
}
function loadRoomState(roomId){
  const s = localStorage.getItem(roomKey(roomId));
  return s ? JSON.parse(s) : null;
}

// ---------- Default words (fallback) ----------
const builtinWords = [
  "قلم","كتاب","شمس","قمر","ماء","نهر","جبل","مدينة","طائرة","سفينة",
  "كرسي","نافذة","باب","كمبيوتر","هاتف","مفتاح","حديقة","زهرة","قطة","كلب",
  "سماء","نار","ثلج","قهوة","موسيقى","قصة","قصر","جسر","مطر","رعد",
  "علم","فيلم","لوحة","مسرح","ملعب","سباق","نجمة","فضاء","مخترع","روبوت"
];

// ---------- Room actions / model ----------
function createEmptyRoom(hostId){
  return {
    host: hostId,
    players: {},    // uid -> {uid,name,role,team,joinedAt}
    board: null,    // array 25 words
    keycard: null,  // array 25 roles
    revealed: null, // object idx->bool
    state: { phase:'lobby', turn:null, clue:null, guessesLeft:0, timer:{ running:false, secondsLeft:60 } },
    history: {}     // timestamp-keyed messages (we'll use push with uid/time)
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

function addHistory(room, text){
  const k = Date.now() + '-' + uidRand(4);
  room.history[k] = `[${new Date().toLocaleTimeString()}] ${text}`;
}

// ---------- Message handling (Broadcast) ----------
function broadcast(roomId, type, payload){
  const ch = getChannel(roomId);
  ch.postMessage({ type, payload });
}

// Central handler for incoming messages
async function handleMessage(type, payload){
  if(!payload || !payload.roomId) return;
  const roomId = payload.roomId;
  let room = loadRoomState(roomId);
  switch(type){
    case 'join':
      // payload: {roomId, player}
      room = room || createEmptyRoom(payload.player.uid);
      room.players[payload.player.uid] = payload.player;
      saveRoomState(roomId, room);
      renderRoomUI(roomId, room);
      break;

    case 'role_change':
      // payload: {roomId, uid, role, team}
      if(!room) return;
      if(room.players && room.players[payload.uid]){
        room.players[payload.uid].role = payload.role;
        room.players[payload.uid].team = payload.team;
        saveRoomState(roomId, room);
        renderRoomUI(roomId, room);
      }
      break;

    case 'start_game':
      // payload: {roomId, hostUid, words, keycard, revealed, starting}
      room = room || createEmptyRoom(payload.hostUid);
      room.board = payload.words;
      room.keycard = payload.keycard;
      room.revealed = payload.revealed;
      room.state.phase = 'playing';
      room.state.turn = payload.starting;
      room.state.clue = null;
      room.state.guessesLeft = 0;
      addHistory(room, `المضيف بدأ اللعبة — يبدأ: ${payload.starting}`);
      saveRoomState(roomId, room);
      renderRoomUI(roomId, room);
      break;

    case 'give_clue':
      // payload: {roomId, uid, word, number}
      if(!room) return;
      room.state.clue = { word: payload.word, number: payload.number, by: payload.uid };
      room.state.guessesLeft = payload.number + 1;
      addHistory(room, `${room.players[payload.uid]?.name || 'لاعب'} أعطى تلميح: ${payload.word} (${payload.number})`);
      saveRoomState(roomId, room);
      renderRoomUI(roomId, room);
      break;

    case 'guess':
      // payload: {roomId, uid, index}
      if(!room) return;
      if(room.revealed && room.revealed[payload.index]) return; // already
      // Host processes guess (authoritative)
      if(room.host !== me.uid){
        // forward to host by storing request in localStorage and broadcasting; host will handle 'guess_process'
        broadcast(roomId, 'guess_request', payload);
        return;
      }
      // host handles directly
      processGuessAsHost(roomId, payload.uid, payload.index);
      break;

    case 'guess_request':
      // Host receives a request and processes
      if(room && room.host === me.uid){
        processGuessAsHost(roomId, payload.uid, payload.index);
      }
      break;

    case 'state_update':
      // payload: {roomId, room}
      saveRoomState(roomId, payload.room);
      renderRoomUI(roomId, payload.room);
      break;

    case 'timer_update':
      // payload: {roomId, timer}
      if(!room) return;
      room.state.timer = payload.timer;
      saveRoomState(roomId, room);
      renderRoomUI(roomId, room);
      break;

    default:
      // ignore
      break;
  }
}

// ---------- Host: process guess and update logic ----------
async function processGuessAsHost(roomId, guesserUid, index){
  const room = loadRoomState(roomId);
  if(!room) return;
  if(room.revealed[index]) return;
  // reveal
  room.revealed[index] = true;
  const color = room.keycard[index];
  addHistory(room, `${room.players[guesserUid]?.name || guesserUid} خمن بطاقة ${index} => ${color}`);
  // if assassin -> end game
  if(color === 'assassin'){
    room.state.phase = 'ended';
    room.state.winner = (room.players[guesserUid]?.team === 'red') ? 'blue' : 'red';
    addHistory(room, `انتهت اللعبة — الفائز: ${room.state.winner} (بسبب Assassin)`);
  } else {
    // if guessed color != guesser.team => switch turn
    const guesserTeam = room.players[guesserUid]?.team;
    if(color !== guesserTeam){
      room.state.turn = (room.state.turn === 'red') ? 'blue' : 'red';
      room.state.clue = null;
      room.state.guessesLeft = 0;
    } else {
      // correct -> decrease guessesLeft
      room.state.guessesLeft = Math.max((room.state.guessesLeft || 1) - 1, 0);
    }
    // check win
    let redLeft = 0, blueLeft = 0;
    for(let i=0;i<25;i++){
      if(room.keycard[i]==='red' && !room.revealed[i]) redLeft++;
      if(room.keycard[i]==='blue' && !room.revealed[i]) blueLeft++;
    }
    if(redLeft===0){ room.state.phase='ended'; room.state.winner='red'; addHistory(room, `انتهت اللعبة — الفريق الأحمر فاز`); }
    if(blueLeft===0){ room.state.phase='ended'; room.state.winner='blue'; addHistory(room, `انتهت اللعبة — الفريق الأزرق فاز`); }
  }
  saveRoomState(roomId, room);
  // broadcast full state update
  broadcast(roomId, 'state_update', { roomId, room });
}

// ---------- UI rendering ----------
function renderRoomUI(roomId, room){
  if(!room) return;
  roomLabel.textContent = roomId;
  hostLabel.textContent = room.host;
  // players
  playersList.innerHTML = '';
  Object.values(room.players || {}).forEach(p => {
    const d = document.createElement('div');
    d.className = 'pitem';
    d.textContent = `${p.name} — ${p.team || '-'} — ${p.role || '-'}` + (p.uid === room.host ? ' (المضيف)' : '');
    playersList.appendChild(d);
  });
  // board
  if(room.board && room.keycard && room.revealed){
    buildBoard(roomId, room);
  } else {
    boardEl.innerHTML = '<div class="muted">اللعبة لم تبدأ بعد</div>';
  }
  // keycard spymaster
  const my = room.players?.[me.uid];
  if(my && my.role === 'spymaster') spymasterPanel.hidden = false; else spymasterPanel.hidden = true;
  if(spymasterPanel.hidden === false) buildKeycard(roomId, room);

  // history
  historyEl.innerHTML = '';
  const arr = Object.values(room.history || {}).slice(-80).reverse();
  arr.forEach(h => {
    const el = document.createElement('div'); el.textContent = h; historyEl.appendChild(el);
  });

  // timer display
  timerDisplay.textContent = formatTime(room.state?.timer?.secondsLeft || 0);
  // current clue
  if(room.state?.clue) currentClue.textContent = `تلميح: ${room.state.clue.word} (${room.state.clue.number}) — تخمينات متبقية: ${room.state.guessesLeft}`;
  else currentClue.textContent = 'لا توجد تلميحات';
}

// ---------- Build board UI (players) ----------
function buildBoard(roomId, room){
  boardEl.innerHTML = '';
  for(let i=0;i<25;i++){
    const c = document.createElement('div');
    c.className = 'card';
    c.textContent = room.board[i] || '';
    if(room.revealed[i]){ c.classList.add('revealed'); c.classList.add(room.keycard[i]); }
    c.onclick = () => {
      // local optimistic click sends guess message
      if(room.state.phase !== 'playing') return;
      // if my role is spymaster, don't allow guessing
      const my = room.players?.[me.uid];
      if(my && my.role === 'spymaster') return;
      // send guess
      broadcast(roomId, 'guess', { roomId, uid: me.uid, index: i });
    };
    boardEl.appendChild(c);
  }
}

// ---------- Build keycard UI ----------
function buildKeycard(roomId, room){
  keycardGrid.innerHTML = '';
  for(let i=0;i<room.keycard.length;i++){
    const el = document.createElement('div');
    el.className = 'spy-card';
    el.textContent = room.board[i];
    el.style.background = (room.keycard[i] === 'red') ? '#e53935' : (room.keycard[i] === 'blue') ? '#1e88e5' : (room.keycard[i] === 'assassin' ? '#111' : '#9ca3af');
    keycardGrid.appendChild(el);
  }
}

// ---------- UI Actions: join/create/setRole/start/regenerate/giveClue ----------
joinBtn.onclick = () => {
  const rid = roomIdInput.value.trim();
  if(!rid) return alert('أدخل رمز الغرفة');
  joinRoom(rid);
};

createBtn.onclick = () => {
  const rid = 'r' + uidRand(6);
  roomIdInput.value = rid;
  joinRoom(rid);
};

function joinRoom(roomId){
  me.name = (playerNameInput.value.trim() || `لاعب-${me.uid}`);
  const ch = getChannel(roomId);
  // load or create room
  let room = loadRoomState(roomId);
  if(!room){
    room = createEmptyRoom(me.uid);
    // add me
    room.players[me.uid] = { uid: me.uid, name: me.name, role: localRole, team: localTeam, joinedAt: Date.now() };
    saveRoomState(roomId, room);
  } else {
    // add me
    room.players[me.uid] = { uid: me.uid, name: me.name, role: localRole, team: localTeam, joinedAt: Date.now() };
    saveRoomState(roomId, room);
  }
  // broadcast join so others update
  ch.postMessage({ type:'join', payload:{ roomId, player: room.players[me.uid] } });
  renderRoomUI(roomId, room);
}

// set role/team
setRoleBtn.onclick = () => {
  if(!roomIdInput.value.trim()) return alert('انضم لغرفة أولاً');
  localRole = roleSelect.value;
  localTeam = teamSelect.value;
  // update local storage
  const roomId = roomIdInput.value.trim();
  const room = loadRoomState(roomId);
  if(room && room.players && room.players[me.uid]){
    room.players[me.uid].role = localRole;
    room.players[me.uid].team = localTeam;
    saveRoomState(roomId, room);
    broadcast(roomId, 'role_change', { roomId, uid: me.uid, role: localRole, team: localTeam });
    renderRoomUI(roomId, room);
  }
};

// start game (host only)
startBtn.onclick = () => {
  if(!roomIdInput.value.trim()) return alert('ادخل رمز الغرفة');
  const roomId = roomIdInput.value.trim();
  const room = loadRoomState(roomId);
  if(!room) return alert('الرجاء الانضمام أولاً');
  if(room.host !== me.uid) return alert('فقط المضيف يمكنه بدء اللعبة');

  let words = [];
  const raw = customWordsTA.value.trim();
  if(raw.length){
    words = raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    if(words.length !== 25) return alert('يجب إدخال 25 كلمة تماماً');
  } else {
    words = shuffle([...builtinWords]).slice(0,25);
  }

  const starting = startingTeamSel.value;
  const keycard = generateKeycard(starting);
  const revealed = {}; for(let i=0;i<25;i++) revealed[i]=false;

  // broadcast start_game
  broadcast(roomId, 'start_game', { roomId, hostUid: me.uid, words, keycard, revealed, starting });
};

// regenerate (host)
regenBtn.onclick = () => {
  if(!roomIdInput.value.trim()) return alert('ادخل رمز الغرفة');
  const roomId = roomIdInput.value.trim();
  const room = loadRoomState(roomId);
  if(!room || room.host !== me.uid) return alert('فقط المضيف يمكنه إعادة التوليد');
  // same as start but force random
  const words = shuffle([...builtinWords]).slice(0,25);
  const starting = startingTeamSel.value;
  const keycard = generateKeycard(starting);
  const revealed = {}; for(let i=0;i<25;i++) revealed[i]=false;
  broadcast(roomId, 'start_game', { roomId, hostUid: me.uid, words, keycard, revealed, starting });
};

// give clue
giveClueBtn.onclick = () => {
  if(!roomIdInput.value.trim()) return alert('انضم لغرفة');
  const roomId = roomIdInput.value.trim();
  const room = loadRoomState(roomId);
  const myp = room.players?.[me.uid];
  if(!myp || myp.role !== 'spymaster') return alert('فقط Spymaster يمكنه إعطاء تلميح');
  const word = clueWordInput.value.trim();
  const number = parseInt(clueNumberInput.value || '0',10);
  if(!word) return alert('أدخل كلمة تلميح');
  broadcast(roomId, 'give_clue', { roomId, uid: me.uid, word, number });
};

// ---------- Timer controls ----------
startTimerBtn.onclick = () => {
  if(!roomIdInput.value.trim()) return;
  const roomId = roomIdInput.value.trim();
  const secs = parseInt(timerSecondsInput.value || '60',10);
  // host updates timer in state (host authoritative)
  const room = loadRoomState(roomId);
  if(!room || room.host !== me.uid){
    // request host to start via broadcast: host will update timer
    broadcast(roomId, 'timer_update', { roomId, timer: { running:true, secondsLeft:secs } });
    return;
  }
  // host runs timer and broadcasts updates every second
  runHostTimer(roomId, secs);
};

pauseTimerBtn.onclick = () => {
  if(!roomIdInput.value.trim()) return;
  const roomId = roomIdInput.value.trim();
  broadcast(roomId, 'timer_update', { roomId, timer: { running:false } });
};

resetTimerBtn.onclick = () => {
  if(!roomIdInput.value.trim()) return;
  const roomId = roomIdInput.value.trim();
  const secs = parseInt(timerSecondsInput.value || '60',10);
  broadcast(roomId, 'timer_update', { roomId, timer: { running:false, secondsLeft:secs } });
};

// Host-run timer loop (host authoritative)
let hostTimerInterval = null;
async function runHostTimer(roomId, startSeconds){
  clearInterval(hostTimerInterval);
  let secs = startSeconds;
  // save initial
  let room = loadRoomState(roomId);
  if(!room) return;
  room.state.timer = { running:true, secondsLeft:secs };
  saveRoomState(roomId, room);
  broadcast(roomId, 'timer_update', { roomId, timer: room.state.timer });

  hostTimerInterval = setInterval(() => {
    secs = Math.max(0, secs - 1);
    let room = loadRoomState(roomId);
    if(!room) { clearInterval(hostTimerInterval); return; }
    room.state.timer.secondsLeft = secs;
    saveRoomState(roomId, room);
    broadcast(roomId, 'timer_update', { roomId, timer: room.state.timer });
    if(secs <= 0){ clearInterval(hostTimerInterval); room.state.timer.running = false; saveRoomState(roomId, room); broadcast(roomId,'timer_update',{roomId,timer:room.state.timer}); }
  }, 1000);
}

// ---------- Initialize: if room param in URL join automatically ----------
(function initFromUrl(){
  const params = new URLSearchParams(location.search);
  const rid = params.get('room');
  if(rid){ roomIdInput.value = rid; }
})();

// ---------- Utility: initial render if local room exists ----------
(function tryRenderExistingRoom(){
  const rid = roomIdInput.value.trim();
  if(!rid) return;
  const room = loadRoomState(rid);
  if(room) renderRoomUI(rid, room);
})();

// ---------- End ----------
