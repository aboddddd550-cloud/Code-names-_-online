// --- Firebase imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

// --- Firebase Config (كما أرسلته لي أنت تماماً) ---
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

// --- Init ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// الكلمات
const wordsList = [
    "صقر","جبل","بحر","هاتف","قلم","مدينة","كتاب","قمر","شمس","نجم",
    "ذهب","باب","ثلج","سفينة","حصان","سيف","خريطة","سيارة","غابة","وردة",
    "ظل","ورق","لؤلؤ","مفتاح","شارع"
];

// خلط
function shuffle(a) { return a.sort(() => Math.random() - 0.5); }

// متغيرات
let currentRoom = "";
let boardDiv = document.getElementById("board");
let spyDiv = document.getElementById("spymasterView");

// --- دخول الغرفة ---
window.joinRoom = async function () {
    const name = document.getElementById("roomInput").value.trim();
    if (name === "") return;
    currentRoom = name;

    document.getElementById("roomName").innerText = `الغرفة: ${currentRoom}`;

    const roomRef = ref(db, "rooms/" + currentRoom);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) {
        // أول لاعب ينشئ الغرفة
        const shuffledWords = shuffle([...wordsList]);
        const keycard = shuffle([
            ...Array(9).fill("red"),
            ...Array(8).fill("blue"),
            ...Array(7).fill("neutral"),
            "assassin"
        ]);

        await set(roomRef, {
            words: shuffledWords,
            keycard: keycard,
            revealed: Array(25).fill(false)
        });
    }

    // ابدأ مزامنة البيانات
    startSync();
};

// --- المزامنة مع Firebase ---
function startSync() {
    const r = ref(db, "rooms/" + currentRoom);

    onValue(r, snap => {
        if (!snap.exists()) return;

        const data = snap.val();
        buildBoard(data.words, data.revealed, data.keycard);
        buildSpymaster(data.keycard, data.words);
    });
}

// --- بناء اللوحة للاعبين ---
function buildBoard(words, revealed, keycard) {
    boardDiv.innerHTML = "";

    for (let i = 0; i < 25; i++) {
        const c = document.createElement("div");
        c.className = "card";
        c.textContent = words[i];

        if (revealed[i]) c.classList.add("revealed", keycard[i]);

        c.onclick = () => reveal(i);

        boardDiv.appendChild(c);
    }
}

// --- بناء لوحة Spymaster ---
function buildSpymaster(keycard, words) {
    spyDiv.innerHTML = "";

    for (let i = 0; i < 25; i++) {
        const s = document.createElement("div");
        s.className = "spy-card";
        s.style.background = getColor(keycard[i]);
        s.textContent = words[i];
        spyDiv.appendChild(s);
    }
}

function getColor(type) {
    return {
        red: "#d9534f",
        blue: "#0275d8",
        neutral: "#cfcfcf",
        assassin: "black"
    }[type];
}

// --- عند كشف بطاقة ---
function reveal(i) {
    const refRoom = ref(db, "rooms/" + currentRoom + "/revealed");

    get(refRoom).then(snap => {
        const arr = snap.val();
        arr[i] = true;
        update(refRoom, arr.reduce((a, x, idx) => ({ ...a, [idx]: x }), {}));
    });
}
