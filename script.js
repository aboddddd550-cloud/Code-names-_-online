// Imports (Firebase v12 modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, update } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

// ======== ضع هنا تكوين مشروع Firebase الخاص بك ========
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

// ======= Basic UI refs =======
const createBtn = document.getElementById('createRoomBtn');
const joinBtn = document.getElementById('joinRoomBtn');
const roomIdInput = document.getElementById('roomIdInput');
const boardEl = document.getElementById('board');
const cardTemplate = document.getElementById('cardTemplate');
const roomInfo = document.getElementById('roomInfo');
const playersList = document.getElementById('playersList');
const logEl = document.getElementById('log');
const beSpymasterBtn = document.getElementById('beSpymaster');
const beGuesserBtn = document.getElementById('beGuesser');
const spymasterPanel = document.getElementById('spymasterPanel');
const keycardGrid = document.getElementById('keycardGrid');
const myIdEl = document.getElementById('myId');
const giveClueBtn = document.getElementById('giveClue');
const clueWordInput = document.getElementById('clueWord');
const clueNumberInput = document.getElementById('clueNumber');

let myUser = null;
let currentRoomId = null;
let localRole = 'guesser'; // or 'spymaster'
let localTeam = 'red';
let boardState = [];
let keycard = [];

// ======= Utility =======
function uid(){ return 'u'+Math.random().toString(36).slice(2,9); }
function log(msg){ const el = document.createElement('div'); el.textContent = msg; logEl.prepend(el); }

// ======= Auth (anonymous) =======
signInAnonymously(auth).then((cred)=>{
  myUser = { id: cred.user.uid };
  myIdEl.textContent = `id: ${myUser.id}`;
  log('Signed in anonymously.');
}).catch(err=>{console.error(err); log('Auth error: '+err.message)});

// ======= Room creation via Cloud Function endpoint (recommended) =======
async function createRoom(){
  // Use Cloud Function API: /createRoom
  const res = await fetch('/createRoom', {method:'POST'});
  const j = await res.json();
  if(j.roomId){
    joinRoom(j.roomId);
  } else {
    alert('فشل إنشاء الغرفة');
  }
}

// ======= Join a room (or open existing) =======
function joinRoom(roomId){
  if(!roomId) roomId = roomIdInput.value.trim();
  if(!roomId) return alert('أدخل رمز الغرفة');
  currentRoomId = roomId;
  roomInfo.textContent = `غرفة: ${roomId}`;
  const roomRef = ref(db, `rooms/${roomId}`);

  // add player
  const pRef = ref(db, `rooms/${roomId}/players/${myUser.id}`);
  set(pRef, { id: myUser.id, name: `لاعب-${myUser.id.slice(-4)}`, role: localRole, team: localTeam });

  // listen to whole room state
  onValue(roomRef, (snap)=>{
    const data = snap.val();
    renderRoom(data);
  });
}

createBtn.addEventListener('click', createRoom);
joinBtn.addEventListener('click', ()=>joinRoom(roomIdInput.value.trim()));

beSpymasterBtn.addEventListener('click', ()=>{
  localRole = 'spymaster';
  if(currentRoomId){
    set(ref(db, `rooms/${currentRoomId}/players/${myUser.id}/role`), 'spymaster');
  }
  spymasterPanel.hidden = false;
});

beGuesserBtn.addEventListener('click', ()=>{
  localRole = 'guesser';
  spymasterPanel.hidden = true;
  if(currentRoomId){
    set(ref(db, `rooms/${currentRoomId}/players/${myUser.id}/role`), 'guesser');
  }
});

// Give clue (client triggers server-side function to validate)
giveClueBtn.addEventListener('click', async ()=>{
  const word = clueWordInput.value.trim();
  const number = parseInt(clueNumberInput.value||'0',10);
  if(!word) return alert('أدخل كلمة تلميح');
  const res = await fetch('/giveClue', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({roomId: currentRoomId, playerId: myUser.id, clue: {word, number}})});
  const j = await res.json();
  if(j.ok) log('تم إرسال التلميح'); else log('خطأ إرسال التلميح: '+(j.error||''));
});

// Render room
function renderRoom(data){
  if(!data) return;
  // players
  playersList.innerHTML='';
  const players = data.players || {};
  Object.values(players).forEach(p=>{
    const d = document.createElement('div'); d.textContent = `${p.name} — ${p.team} — ${p.role}`; playersList.appendChild(d);
  });

  // board
  if(data.board){
    boardState = data.board;
    renderBoard(data.board, data.revealed || {});
  }

  // keycard (only local spymaster should view; server keeps truth but we display the key if our role is spymaster)
  if(data.keycard && localRole==='spymaster'){
    keycard = data.keycard;
    renderKeycard(keycard);
    spymasterPanel.hidden = false;
  }

  // logs
  if(data.history) {
    // show recent
    logEl.innerHTML='';
    const arr = Object.values(data.history);
    arr.slice(-30).reverse().forEach(entry=> log(entry));
  }
}

function renderBoard(board, revealed){
  boardEl.innerHTML='';
  board.forEach((word, idx)=>{
    const tpl = cardTemplate.content.cloneNode(true);
    const btn = tpl.querySelector('.card');
    btn.dataset.index = idx;
    tpl.querySelector('.word').textContent = word;
    if(revealed && revealed[idx]){
      btn.classList.add('revealed');
      btn.classList.add(revealed[idx]);
      btn.disabled = true;
    }
    btn.addEventListener('click', ()=>onCardClick(idx));
    boardEl.appendChild(tpl);
  });
}

function renderKeycard(kc){
  keycardGrid.innerHTML='';
  kc.forEach((c, i)=>{
    const d = document.createElement('div'); d.textContent = `${i+1}: ${c}`; keycardGrid.appendChild(d);
  });
}

// on card click -> request server to process guess
async function onCardClick(index){
  if(!currentRoomId) return;
  const res = await fetch('/guessCard', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({roomId:currentRoomId, playerId: myUser.id, index})});
  const j = await res.json();
  if(j.ok) log(`تم التخمين على بطاقة ${index}`); else log('تعذر التخمين: '+(j.error||''));
}

// helper to create a client-side quick demo room (only if no Cloud Functions)
async function createDemoRoomLocal(){
  const roomId = 'demo-'+Math.random().toString(36).slice(2,8);
  const words = ['قلم','كتاب','شمس','قمر','ماء','نهر','جبل','مدينة','طائرة','سفينة','كرسي','نافذة','باب','كمبيوتر','هاتف','مفتاح','حديقة','زهرة','حد','سباق','قطة','كلب','سماء','نار','ثلج'];
  const key = Array(25).fill('neutral');
  let indices = Array.from({length:25},(_,i)=>i);
  function takeRandom(n, val){ for(let i=0;i<n;i++){ const r = Math.floor(Math.random()*indices.length); key[indices[r]] = val; indices.splice(r,1);} }
  takeRandom(9,'red'); takeRandom(8,'blue'); takeRandom(1,'assassin');

  await set(ref(db, `rooms/${roomId}/board`), words);
  await set(ref(db, `rooms/${roomId}/keycard`), key);
  await set(ref(db, `rooms/${roomId}/revealed`), {});
  await set(ref(db, `rooms/${roomId}/history`), {0:'غرفة انشئت محلياً'});
  roomIdInput.value = roomId;
  joinRoom(roomId);
}

// For quick testing uncomment to create a demo local room on load
// createDemoRoomLocal();

// End of app.js
