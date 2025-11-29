// app.js — كامل ومرتب
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getDatabase, ref, set, update, push, onValue, get } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

/* ========== إعداد Firebase — استخدمت نفس البيانات التي أرسلتها ========== */
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

/* ========== مراجع DOM ========== */
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

let me = { uid: null, name: null };
let currentRoomId = null;
let localRole = 'guesser';
let localTeam = 'red';
let roomDataCache = null;
let timerInterval = null;

/* ========== مصادقة مجهولة ========= */
signInAnonymously(auth).then((cred) => {
  me.uid = cred.user.uid;
  myIdSpan.textContent = `id: ${me.uid.slice(0,8)}`;
}).catch(console.error);

/* ========== أدوات مساعدة ========== */
function uidRand(len = 6) { return Math.random().toString(36).slice(2, 2 + len); }
function shuffle(a) { return a.sort(() => Math.random() - 0.5); }
function formatTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/* ========== إنشاء/انضمام غرفة ========== */
createRoomBtn.onclick = async () => {
  const rid = 'r' + uidRand(8);
  await ensureJoinRoom(rid);
};

joinRoomBtn.onclick = async () => {
  const rid = roomIdInput.value.trim();
  if (!rid) return alert('أدخل رمز الغرفة أو أنشئ واحدة');
  await ensureJoinRoom(rid);
};

async function ensureJoinRoom(roomId) {
  currentRoomId = roomId;
  roomLabel.textContent = roomId;
  // سجل اللاعب
  me.name = playerNameInput.value.trim() || `لاعب-${me.uid.slice(-4)}`;
  const playerRef = ref(db, `rooms/${roomId}/players/${me.uid}`);
  await set(playerRef, { uid: me.uid, name: me.name, role: localRole, team: localTeam, joinedAt: Date.now() });

  // إذا لم توجد الغرفة أنشئ الهيكل المبدئي (host = أول لاعب ينشئ)
  const roomRef = ref(db, `rooms/${roomId}`);
  const snap = await get(roomRef);
  if (!snap.exists()) {
    await set(roomRef, {
      host: me.uid,
      state: { phase: 'lobby', turn: null, clue: null, guessesLeft: 0, timer: { running: false, secondsLeft: 60 } }
    });
  }

  // استمع لتحديثات الغرفة
  onValue(roomRef, (s) => {
    roomDataCache = s.val();
    renderRoom(roomDataCache);
  });
}

/* ========== تعيين الدور والفريق ========== */
setRoleBtn.onclick = async () => {
  localRole = roleSelect.value;
  localTeam = teamSelect.value;
  if (!currentRoomId) return alert('انضم إلى غرفة أولاً');
  await set(ref(db, `rooms/${currentRoomId}/players/${me.uid}/role`), localRole);
  await set(ref(db, `rooms/${currentRoomId}/players/${me.uid}/team`), localTeam);
};

/* ========== بدء اللعبة (المضيف فقط) ========== */
startGameBtn.onclick = async () => {
  if (!currentRoomId) return alert('انضم إلى غرفة أولاً');
  if (roomDataCache?.host !== me.uid) return alert('فقط المضيف يمكنه بدء اللعبة');

  // اجلب الكلمات من textarea — يجب أن تكون 25 كلمة
  const raw = customWordsTA.value.trim();
  const words = raw.split(/\r?\n/).map(w => w.trim()).filter(w => w.length > 0);
  if (words.length !== 25) return alert('أدخل 25 كلمة بالضبط (كل كلمة في سطر)');

  // افتَرِض الفريق الذي يبدأ
  const starting = startingTeamSelect.value; // 'red' أو 'blue'
  // توزيع الأدوار: الفريق الذي يبدأ يحصل على 9 كلمات
  const roles = [];
  if (starting === 'red') {
    roles.push(...Array(9).fill('red'), ...Array(8).fill('blue'));
  } else {
    roles.push(...Array(9).fill('blue'), ...Array(8).fill('red'));
  }
  roles.push('assassin');
  // باقي محايد (نكمل حتى 25)
  while (roles.length < 25) roles.push('neutral');
  shuffle(roles);

  // خلط الكلمات
  shuffle(words);

  // ادخال البيانات في الغرفة
  const updates = {};
  updates[`rooms/${currentRoomId}/board`] = words;
  updates[`rooms/${currentRoomId}/keycard`] = roles;
  updates[`rooms/${currentRoomId}/revealed`] = Array(25).fill(false);
  updates[`rooms/${currentRoomId}/state/phase`] = 'playing';
  updates[`rooms/${currentRoomId}/state/turn`] = starting;
  updates[`rooms/${currentRoomId}/state/clue`] = null;
  updates[`rooms/${currentRoomId}/state/guessesLeft`] = 0;
  await update(ref(db), updates);
};

/* ========== عرض الغرفة واللاعبين واللوحة ========== */
function renderRoom(room) {
  if (!room) return;
  // players
  playersListEl.innerHTML = '';
  const players = room.players || {};
  Object.values(players).forEach(p => {
    const d = document.createElement('div');
    d.className = 'pitem';
    d.textContent = `${p.name} — ${p.team || '-'} — ${p.role || '-'}`;
    if (p.uid === room.host) d.textContent += ' (المضيف)';
    playersListEl.appendChild(d);
  });

  // التحكمات: إظهار زر البدء فقط للمضيف
  if (room.host === me.uid && room.state?.phase === 'lobby') {
    startGameBtn.style.display = 'block';
  } else {
    startGameBtn.style.display = 'none';
  }

  // عرض المؤقت
  const timer = room.state?.timer || { running: false, secondsLeft: 60 };
  timerDisplay.textContent = formatTime(timer.secondsLeft);
  // build board if موجود
  if (room.board && room.keycard && room.revealed) {
    buildBoard(room.board, room.keycard, room.revealed);
    // spymaster panel visibility: if my role is spymaster show
    const myPlayer = room.players?.[me.uid];
    if (myPlayer?.role === 'spymaster') {
      spymasterPanel.hidden = false;
      buildKeycard(room.keycard, room.board);
    } else {
      spymasterPanel.hidden = true;
    }
    // clue
    if (room.state?.clue) {
      currentClue.textContent = `تلميح: ${room.state.clue.word} (${room.state.clue.number}) — تخمينات متبقية: ${room.state.guessesLeft}`;
    } else {
      currentClue.textContent = 'لا توجد تلميحات بعد';
    }
  }
}

/* ========== بناء اللوحة (اللاعبون) ========== */
function buildBoard(board, keycard, revealed) {
  boardEl.innerHTML = '';
  for (let i = 0; i < 25; i++) {
    const card = document.createElement('div');
    card.className = 'card';
    card.textContent = board[i];
    // إذا مكشوف
    if (revealed[i]) {
      card.classList.add('revealed', keycard[i]);
      card.classList.add(keycard[i]); // class مثل 'red' أو 'blue' أو 'neutral' أو 'assassin'
      card.classList.add('revealed'); // نمط عام
    }
    card.onclick = () => {
      attemptGuess(i);
    };
    boardEl.appendChild(card);
  }
}

/* ========== لوحة Spymaster (تُعرض فقط للـ spymaster) ========== */
function buildKeycard(keycard, board) {
  keycardGrid.innerHTML = '';
  for (let i = 0; i < keycard.length; i++) {
    const el = document.createElement('div');
    el.className = 'spy-card';
    el.textContent = board[i];
    el.style.background = getColor(keycard[i]);
    keycardGrid.appendChild(el);
  }
}
function getColor(type) {
  return type === 'red' ? '#d9534f' : type === 'blue' ? '#0275d8' : type === 'assassin' ? '#000' : '#9ca3af';
}

/* ========== إرسال تلميح (فقط spymaster) ========== */
giveClueBtn.onclick = async () => {
  if (!currentRoomId) return alert('انضم إلى غرفة أولاً');
  const room = roomDataCache;
  const myPlayer = room.players?.[me.uid];
  if (!myPlayer || myPlayer.role !== 'spymaster') return alert('فقط الـ Spymaster يمكنه إرسال تلميح');

  const word = clueWordInput.value.trim();
  const number = parseInt(clueNumberInput.value || '0', 10);
  if (!word) return alert('أدخل كلمة تلميح');

  await update(ref(db, `rooms/${currentRoomId}/state`), { clue: { word, number }, guessesLeft: number + 1 });
  clueWordInput.value = '';
  clueNumberInput.value = '';
};

/* ========== محاولة التخمين ========== */
async function attemptGuess(index) {
  if (!currentRoomId) return;
  const room = roomDataCache;
  if (!room) return;
  if (room.revealed?.[index]) return; // سبق كشفها
  // يمكن إضافة تحقق إضافي: هل الدور يسمح بالتخمين؟
  // سنعمد إلى عملية موثوقة: اكتمال التغيير في DB
  const revealedRef = ref(db, `rooms/${currentRoomId}/revealed`);
  const snap = await get(revealedRef);
  const arr = snap.val() || Array(25).fill(false);
  if (arr[index]) return;

  // كشف البطاقة
  arr[index] = true;
  // write back as object of indices (Realtime DB)
  const obj = arr.reduce((acc, v, i) => { acc[i] = v; return acc; }, {});
  await update(ref(db, `rooms/${currentRoomId}`), { revealed: obj });

  // سجل الحدث - (اختياري يمكنك إضافة سجل history)
}

/* ========== مؤقت الدور (مزامن عبر الغرفة) ========== */
startTimerBtn.onclick = async () => {
  if (!currentRoomId) return alert('انضم إلى غرفة أولاً');
  // المضيف أو أي لاعب يمكن بدء المؤقت — يمكن تقييده لاحقًا
  const secs = parseInt(timerSecondsInput.value || '60', 10);
  await update(ref(db, `rooms/${currentRoomId}/state/timer`), { running: true, secondsLeft: secs });
  runLocalTimer();
};

pauseTimerBtn.onclick = async () => {
  if (!currentRoomId) return;
  await update(ref(db, `rooms/${currentRoomId}/state/timer`), { running: false });
  clearInterval(timerInterval);
};

resetTimerBtn.onclick = async () => {
  if (!currentRoomId) return;
  const secs = parseInt(timerSecondsInput.value || '60', 10);
  await update(ref(db, `rooms/${currentRoomId}/state/timer`), { running: false, secondsLeft: secs });
  clearInterval(timerInterval);
};

/* ========== استماع لمستجدات المؤقت في DB وتزامن عرض الوقت محليًا ========== */
onValue(ref(db), (snap) => {
  const root = snap.val();
  if (!root || !currentRoomId) return;
  const room = root.rooms?.[currentRoomId];
  if (!room) return;
  // حفظ نسخة محلية
  roomDataCache = room;
  renderRoom(room);

  const timer = room.state?.timer || { running: false, secondsLeft: 60 };
  timerDisplay.textContent = formatTime(timer.secondsLeft);
  if (timer.running) {
    runLocalTimer();
  } else {
    clearInterval(timerInterval);
  }
});

/* ========== عدّاد محلي للتزامن (يعمل عندما running=true) ========== */
function runLocalTimer() {
  if (!currentRoomId) return;
  clearInterval(timerInterval);
  timerInterval = setInterval(async () => {
    const tRef = ref(db, `rooms/${currentRoomId}/state/timer/secondsLeft`);
    const snap = await get(tRef);
    let secs = snap.exists() ? snap.val() : 0;
    secs = Math.max(0, secs - 1);
    await set(tRef, secs);
    if (secs <= 0) {
      clearInterval(timerInterval);
      await update(ref(db, `rooms/${currentRoomId}/state/timer`), { running: false });
    }
  }, 1000);
}

/* ========== توصيات أمنية حول التحقق ========== */
/*
ملاحظة مهمة:
- هذا التنفيذ يعتمد على client-side writes إلى Realtime DB. للحصول على أمان حقيقي:
  1) ضع قواعد Database تمنع كتابة keycard أو تغييره من العميل.
  2) ضع Cloud Functions تجعل server-authoritative للتحقق من بدء اللعبة وعمليات التخمين المهمة (مثلاً change revealed).
  3) ضع قواعد بحيث أن only host can set board/keycard/state.phase from 'lobby' to 'playing'.
*/
