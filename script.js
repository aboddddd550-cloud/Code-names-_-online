// app.js (module) — Codenames Multiplayer (Firebase Realtime DB)
// متطلبات: فتح الصفحة من خادم (GitHub Pages أو Live Server) لأننا نستخدم imports من موقع Firebase

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getDatabase, ref, set, update, push, onValue, get
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

/* ========== Firebase config (استعملت config الذي زودتني به) ========== */
const firebaseConfig = {
  apiKey: "AIzaSyDQ9PFMO7k_eY78Fl6vxe18g_VbCMXTe3E",
  authDomain: "code-online-e0a52.firebaseapp.com",
  databaseURL: "https://code-online-e0a52-default-rtdb.firebaseio.com",
  projectId: "code-online-e0a52",
  storageBucket: "code-online-e0a52.firebasestorage.app",
  messagingSenderId: "785121976090",
  appId: "1:785121976090:web:4a45161ca1a887970416a3",
  measurementId: "G-PN3N2ZZ8VX"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

/* ========== DOM refs ========== */
const playerNameInput = document.getElementById('playerName');
const roomIdInput = document.getElementById('roomIdInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomLabel = document.getElementById('roomLabel');
const playersListEl = document.getElementById('playersList');
const teamSelect = document.getElementById('teamSelect');
const roleSelect = document.getElementById('roleSelect');
const setRoleBtn = document.getElementById('setRoleBtn');
const customWordsTA = document.getElementById('customWords');
const startGameBtn = document.getElementById('startGameBtn');
const regenerateBtn = document.getElementById('regenerateBtn');
const startingTeamSelect = document.getElementById('startingTeam');
const boardEl = document.getElementById('board');
const spymasterPanel = document.getElementById('spymasterPanel');
const keycardGrid = document.getElementById('keycardGrid');
const giveClueBtn = document.getElementById('giveClueBtn');
const clueWordInput = document.getElementById('clueWord');
const clueNumberInput = document.getElementById('clueNumber');
const currentClue = document.getElementById('currentClue');
const myIdSpan = document.getElementById('myId');
const timerDisplay = document.getElementById('timerDisplay');
const startTimerBtn = document.getElementById('startTimerBtn');
const pauseTimerBtn = document.getElementById('pauseTimerBtn');
const resetTimerBtn = document.getElementById('resetTimerBtn');
const timerSecondsInput = document.getElementById('timerSeconds');
const historyEl = document.getElementById('history');

/* ========== Local state ========== */
let me = { uid: null, name: null };
let currentRoomId = null;
let localRole = 'guesser';
let localTeam = 'red';
let roomCache = null;
let timerInterval = null;

/* ========== Auth anonymous ========= */
signInAnonymously(auth).then(cred => {
  me.uid = cred.user.uid;
  myIdSpan.textContent = `id: ${me.uid.slice(0,8)}`;
}).catch(err => console.error('Auth error', err));

/* ========== Helpers ========== */
function uidRand(len = 6){ return Math.random().toString(36).slice(2,2+len); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function formatTime(sec){ sec = Math.max(0, Math.floor(sec)); const m = String(Math.floor(sec/60)).padStart(2,'0'); const s = String(sec%60).padStart(2,'0'); return `${m}:${s}`; }
function pushHistory(msg){ const d=document.createElement('div'); d.textContent = `${new Date().toLocaleTimeString()} — ${msg}`; historyEl.prepend(d); }

/* ========== Create / Join Room ========== */
createRoomBtn.onclick = async () => {
  const rid = 'r' + uidRand(8);
  await joinRoom(rid);
};
joinRoomBtn.onclick = async () => {
  const rid = roomIdInput.value.trim();
  if(!rid) return alert('أدخل رمز الغرفة أو أنشئ واحدة');
  await joinRoom(rid);
};

async function joinRoom(roomId){
  currentRoomId = roomId;
  roomLabel.textContent = roomId;
  me.name = playerNameInput.value.trim() || `لاعب-${me.uid.slice(-4)}`;

  // record player
  await set(ref(db, `rooms/${roomId}/players/${me.uid}`), { uid: me.uid, name: me.name, role: localRole, team: localTeam, joinedAt: Date.now() });

  // if room not exist -> create initial skeleton
  const roomRef = ref(db, `rooms/${roomId}`);
  const snap = await get(roomRef);
  if(!snap.exists()){
    await set(roomRef, {
      host: me.uid,
      board: null,
      keycard: null,
      revealed: null,
      state: { phase: 'lobby', turn: null, clue: null, guessesLeft:0, timer: { running:false, secondsLeft:60 } }
    });
  }

  // listen to room updates
  onValue(roomRef, s => {
    const data = s.val();
    roomCache = data;
    renderRoom(data);
  });

  pushHistory(`${me.name} انضم إلى الغرفة`);
}

/* ========== Set role/team ========== */
setRoleBtn.onclick = async () => {
  localRole = roleSelect.value;
  localTeam = teamSelect.value;
  if(!currentRoomId) return alert('انضم إلى غرفة أولاً');
  await set(ref(db, `rooms/${currentRoomId}/players/${me.uid}/role`), localRole);
  await set(ref(db, `rooms/${currentRoomId}/players/${me.uid}/team`), localTeam);
};

/* ========== Start / Regenerate Game (host only) ========== */
startGameBtn.onclick = () => startGame(false);
regenerateBtn.onclick = () => startGame(true);

async function startGame(forceRandom=false){
  if(!currentRoomId) return alert('انضم إلى غرفة أولاً');
  if(roomCache?.host !== me.uid) return alert('فقط المضيف يمكنه بدء/تجديد اللعبة');

  // words from textarea (if provided and not forceRandom)
  let words = [];
  const raw = customWordsTA.value.trim();
  if(!forceRandom && raw.length){
    words = raw.split(/\r?\n/).map(w=>w.trim()).filter(Boolean);
    if(words.length !== 25) return alert('أدخل 25 كلمة بالضبط في الكلمات الخاصة أو أتركها فارغة لاستخدام عشوائي');
  } else {
    // built-in fallback list (enough to pick 25)
    const builtin = ["قلم","كتاب","شمس","قمر","ماء","نهر","جبل","مدينة","طائرة","سفينة","كرسي","نافذة","باب","كمبيوتر","هاتف","مفتاح","حديقة","زهرة","قطة","كلب","سماء","نار","ثلج","قهوة","موسيقى","قصة","قصر","قارب","مطر","رعد","علم","مسرح","لوحة","فيلم","مفتاح_براغي","مطرقة","مسمار","سيارة","سباق","ملاك","كوكب","نجمة","فضاء","مكتبة","مدرسة","مستشفى","طبيب","مهندس"];
    words = shuffle(builtin).slice(0,25);
  }

  // Keycard: starting team gets 9
  const starting = startingTeamSelect.value;
  let roles = [];
  if(starting === 'red'){ roles.push(...Array(9).fill('red'), ...Array(8).fill('blue')); }
  else { roles.push(...Array(9).fill('blue'), ...Array(8).fill('red')); }
  roles.push('assassin');
  while(roles.length < 25) roles.push('neutral');
  shuffle(roles);
  shuffle(words);

  // revealed as object {0:false,...24:false}
  const revealedObj = {}; for(let i=0;i<25;i++) revealedObj[i]=false;

  // write to DB (host only)
  await update(ref(db, `rooms/${currentRoomId}`), {
    board: words,
    keycard: roles,
    revealed: revealedObj,
    'state/phase': 'playing',
    'state/turn': starting,
    'state/clue': null,
    'state/guessesLeft': 0
  });
  await push(ref(db, `rooms/${currentRoomId}/history`), `المضيف بدأ اللعبة — يبدأ: ${starting}`);
}

/* ========== Render room UI ========== */
function renderRoom(room){
  if(!room) return;
  // players list
  playersListEl.innerHTML = '';
  const players = room.players || {};
  Object.values(players).forEach(p=>{
    const d = document.createElement('div'); d.className='pitem';
    d.textContent = `${p.name} — ${p.team||'-'} — ${p.role||'-'}` + (p.uid === room.host ? ' (المضيف)' : '');
    playersListEl.appendChild(d);
  });

  // show/hide start button
  startGameBtn.style.display = (room.host === me.uid && room.state?.phase === 'lobby') ? 'block' : 'none';

  // timer
  const timer = room.state?.timer || { running:false, secondsLeft:60 };
  timerDisplay.textContent = formatTime(timer.secondsLeft);

  // board/keycard
  if(room.board && room.keycard && room.revealed){
    buildBoard(room.board, room.keycard, room.revealed);
    const myPlayer = room.players?.[me.uid];
    if(myPlayer?.role === 'spymaster'){
      spymasterPanel.hidden = false;
      buildKeycard(room.keycard, room.board);
    } else {
      spymasterPanel.hidden = true;
    }
    // clue
    if(room.state?.clue){
      currentClue.textContent = `تلميح: ${room.state.clue.word} (${room.state.clue.number}) — تخمينات متبقية: ${room.state.guessesLeft}`;
    } else currentClue.textContent = 'لا توجد تلميحات';
    // history
    if(room.history){
      historyEl.innerHTML = '';
      const arr = Object.values(room.history).slice(-80).reverse();
      arr.forEach(h => { const el = document.createElement('div'); el.textContent = h; historyEl.appendChild(el); });
    }
  }
  roomCache = room;
}

/* ========== Build board & keycard ========== */
function buildBoard(board, keycard, revealed){
  boardEl.innerHTML = '';
  for(let i=0;i<25;i++){
    const card = document.createElement('div');
    card.className = 'card';
    card.textContent = board[i];
    if(revealed[i]) card.classList.add('revealed', keycard[i]);
    card.onclick = () => onCardClick(i);
    boardEl.appendChild(card);
  }
}

function buildKeycard(keycard, board){
  keycardGrid.innerHTML = '';
  for(let i=0;i<25;i++){
    const el = document.createElement('div');
    el.className = 'spy-card';
    el.textContent = board[i];
    el.style.background = getColor(keycard[i]);
    keycardGrid.appendChild(el);
  }
}
function getColor(type){ return type==='red' ? '#e53935' : type==='blue' ? '#1e88e5' : type==='assassin' ? '#111' : '#9ca3af'; }

/* ========== Give clue (spymaster only) ========== */
giveClueBtn.onclick = async () => {
  if(!currentRoomId) return alert('انضم لغرفة أولاً');
  const room = roomCache;
  const mePlayer = room.players?.[me.uid];
  if(!mePlayer || mePlayer.role !== 'spymaster') return alert('فقط Spymaster يمكنه إرسال تلميح');
  const word = clueWordInput.value.trim();
  const number = parseInt(clueNumberInput.value || '0',10);
  if(!word) return alert('أدخل كلمة التلميح');
  await update(ref(db, `rooms/${currentRoomId}/state`), { clue: { word, number }, guessesLeft: number + 1 });
  await push(ref(db, `rooms/${currentRoomId}/history`), `${mePlayer.name} أعطى تلميح: ${word} (${number})`);
  clueWordInput.value=''; clueNumberInput.value='';
};

/* ========== Guess handling ========== */
async function onCardClick(index){
  if(!currentRoomId) return;
  const room = roomCache;
  if(!room) return;
  if(room.revealed?.[index]) return;

  // optimistic lock: read revealed & keycard
  const revealedRef = ref(db, `rooms/${currentRoomId}/revealed`);
  const keyRef = ref(db, `rooms/${currentRoomId}/keycard`);
  const [revealedSnap, keySnap] = await Promise.all([get(revealedRef), get(keyRef)]);
  const revealedObj = revealedSnap.exists() ? revealedSnap.val() : {};
  if(revealedObj[index]) return;

  // mark revealed
  revealedObj[index] = true;
  await set(revealedRef, revealedObj);

  const key = keySnap.exists() ? keySnap.val() : [];
  const color = key[index];
  const name = room.players?.[me.uid]?.name || 'لاعب';
  await push(ref(db, `rooms/${currentRoomId}/history`), `${name} خمن بطاقة (${index}) => ${color}`);

  // update game state
  const stateRef = ref(db, `rooms/${currentRoomId}/state`);
  const stateSnap = await get(stateRef);
  const state = stateSnap.exists() ? stateSnap.val() : {};

  // find guesserTeam
  const guesserTeam = room.players?.[me.uid]?.team;

  if(color === 'assassin'){
    const winner = guesserTeam === 'red' ? 'blue' : 'red';
    await update(ref(db, `rooms/${currentRoomId}/state`), { winner, phase: 'ended' });
    await push(ref(db, `rooms/${currentRoomId}/history`), `انتهت اللعبة — ${winner} فاز (بسبب Assassin)`);
    return;
  }

  if(color !== guesserTeam){
    const next = (state.turn === 'red') ? 'blue' : 'red';
    await update(ref(db, `rooms/${currentRoomId}/state`), { turn: next, guessesLeft: 0, clue: null });
  } else {
    const newGuesses = Math.max((state.guessesLeft || 1) - 1, 0);
    await update(ref(db, `rooms/${currentRoomId}/state`), { guessesLeft: newGuesses });
  }

  await checkWinCondition();
}

/* ========== Win check ========== */
async function checkWinCondition(){
  const room = roomCache;
  if(!room) return;
  const key = room.keycard || [];
  const revealed = room.revealed || {};
  const counts = { red:0, blue:0 };
  for(let i=0;i<25;i++){
    if(key[i] === 'red' && !revealed[i]) counts.red++;
    if(key[i] === 'blue' && !revealed[i]) counts.blue++;
  }
  if(counts.red === 0){
    await update(ref(db, `rooms/${currentRoomId}/state`), { winner: 'red', phase: 'ended' });
    await push(ref(db, `rooms/${currentRoomId}/history`), `انتهت اللعبة — الفريق الأحمر فاز`);
  } else if(counts.blue === 0){
    await update(ref(db, `rooms/${currentRoomId}/state`), { winner: 'blue', phase: 'ended' });
    await push(ref(db, `rooms/${currentRoomId}/history`), `انتهت اللعبة — الفريق الأزرق فاز`);
  }
}

/* ========== Timer sync ========== */
startTimerBtn.onclick = async () => {
  if(!currentRoomId) return alert('انضم لغرفة أولاً');
  const secs = parseInt(timerSecondsInput.value || '60',10);
  await update(ref(db, `rooms/${currentRoomId}/state/timer`), { running: true, secondsLeft: secs });
  runLocalTimer();
};
pauseTimerBtn.onclick = async () => { if(!currentRoomId) return; await update(ref(db, `rooms/${currentRoomId}/state/timer`), { running:false }); clearInterval(timerInterval); };
resetTimerBtn.onclick = async () => { if(!currentRoomId) return; const secs = parseInt(timerSecondsInput.value || '60',10); await update(ref(db, `rooms/${currentRoomId}/state/timer`), { running:false, secondsLeft: secs }); clearInterval(timerInterval); };

function runLocalTimer(){
  clearInterval(timerInterval);
  timerInterval = setInterval(async () => {
    const tRef = ref(db, `rooms/${currentRoomId}/state/timer/secondsLeft`);
    const tSnap = await get(tRef);
    let secs = tSnap.exists() ? tSnap.val() : 0;
    secs = Math.max(0, secs - 1);
    await set(tRef, secs);
    if(secs <= 0){ clearInterval(timerInterval); await update(ref(db, `rooms/${currentRoomId}/state/timer`), { running:false }); }
  }, 1000);
}

/* ========== Global DB listener for the current room (efficient for demo) ========== */
onValue(ref(db), snap => {
  const root = snap.val();
  if(!root || !currentRoomId) return;
  const room = root.rooms?.[currentRoomId];
  if(!room) return;
  roomCache = room;
  renderRoom(room);

  const t = room.state?.timer || { running:false, secondsLeft:60 };
  timerDisplay.textContent = formatTime(t.secondsLeft);
  if(t.running) runLocalTimer(); else clearInterval(timerInterval);
});

/* ========== Security notes (موصى به بقوة) ========== */
/*
نقاط أمان أساسية قبل النشر الفعلي:
1) استخدم قواعد Realtime DB لتقييد الكتابات:
   - فقط المضيف (rooms/$roomId/host) يمكن كتابة board و keycard و تبديل phase إلى 'playing'.
   - قراءة keycard يجب أن تكون متاحة فقط للاعبي دور spymaster (يمكنك وضع قائمة spymasters أو تفويض).
   - revealed يمكن السماح للكل بكتابتها، لكن الأفضل إرسال التخمينات عبر Cloud Function لتجنب تزوير revealed.
2) الأفضل: أن تجعل Cloud Functions هي السلطـة عند startGame, giveClue, guessCard — حيث تقوم الدوال بالتحقق من أن المرسل هو المضيف أو spymaster قبل تعديل الـ DB.
3) تأكد من تفعيل Authentication (anonymous جيد للبدء) وخلافه للمستخدمين الحقيقيين.
مثال قواعد سريعة (بدائية، تحتاج تخصيص):
{
 "rules": {
  "rooms": {
    "$roomId": {
      ".read": "auth != null",
      ".write": "auth != null",
      "keycard": {
         ".read": "data.exists() ? root.child('rooms').child($roomId).child('players').child(auth.uid).child('role').val() == 'spymaster' : false",
         ".write": "false"
      },
      "board": {
         ".write": "root.child('rooms').child($roomId).child('host').val() == auth.uid"
      },
      "state": {
         ".write": "root.child('rooms').child($roomId).child('host').val() == auth.uid"
      }
    }
  }
 }
}
*/

/* ========== انتهى الكود ========= */
