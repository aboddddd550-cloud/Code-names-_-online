// --------------------------
// 1) Firebase Import
// --------------------------
import { initializeApp } from 
    "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from 
    "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase();


// --------------------------
// 2) Elements
// --------------------------
const joinRoomBtn = document.getElementById("joinRoom");
const startBtn = document.getElementById("startGame");
const gameBoard = document.getElementById("gameBoard");

let roomID = null;


// --------------------------
// 3) Join or Create Room
// --------------------------
joinRoomBtn.onclick = () => {
    roomID = document.getElementById("roomInput").value.trim();
    if (!roomID) return alert("أدخل اسم روم!");

    alert("تم الدخول إلى الروم: " + roomID);

    // مراقبة تغييرات الروم
    const roomRef = ref(db, `rooms/${roomID}`);
    onValue(roomRef, snapshot => {
        const data = snapshot.val();
        if (data && data.board) renderGame(data.board);
    });
};


// --------------------------
// 4) Start game (generate board)
// --------------------------
startBtn.onclick = () => {
    if (!roomID) return alert("ادخل روم أولاً!");

    const customText = document.getElementById("customWords").value.trim();
    let words = customText.split("\n").map(w => w.trim()).filter(w => w);

    if (words.length < 25) return alert("يجب إدخال 25 كلمة على الأقل");

    words = shuffle(words).slice(0, 25);

    const colors = generateColors();

    const board = words.map((w, i) => ({
        word: w,
        color: colors[i],
        revealed: false
    }));

    set(ref(db, `rooms/${roomID}`), { board });
};


// --------------------------
// 5) Render Game Board
// --------------------------
function renderGame(board) {
    gameBoard.innerHTML = "";

    board.forEach((card, index) => {
        const div = document.createElement("div");
        div.className = "card " + (card.revealed ? card.color : "");
        div.innerText = card.word;

        div.onclick = () => revealCard(index);
        gameBoard.appendChild(div);
    });
}


// --------------------------
// 6) Reveal a card
// --------------------------
function revealCard(index) {
    const roomRef = ref(db, `rooms/${roomID}/board`);

    onValue(roomRef, snapshot => {
        const board = snapshot.val();

        board[index].revealed = true;

        set(ref(db, `rooms/${roomID}/board`), board);
    }, { onlyOnce: true });
}


// --------------------------
// Helpers
// --------------------------
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function generateColors() {
    let arr = [
        ...Array(9).fill("red"),
        ...Array(8).fill("blue"),
        ...Array(7).fill("neutral"),
        "black"
    ];
    return shuffle(arr);
}
