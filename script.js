// استيراد Firebase Realtime Database
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

// إعداد Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDQ9PFMO7k_eY78Fl6vxe18g_VbCMXTe3E",
  authDomain: "code-online-e0a52.firebaseapp.com",
  databaseURL: "https://code-online-e0a52-default-rtdb.firebaseio.com",
  projectId: "code-online-e0a52",
  storageBucket: "code-online-e0a52.firebasestorage.app",
  messagingSenderId: "785121976090",
  appId: "1:785121976090:web:4a45161ca1a887970416a3"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// كلمات اللعبة
const words = [
  "شمس","قمر","مفتاح","باب","سيارة",
  "وردة","نهر","جبل","سفينة","وقت",
  "ملك","عين","قلم","مدينة","طريق",
  "بيت","ثعلب","كرة","كتاب","ذهب",
  "رمل","بحر","هاتف","سماء","سيف"
];

// ألوان البطاقات
const roles = [];
for(let i=0;i<25;i++){
  if(i<8) roles.push("red");
  else if(i<16) roles.push("blue");
  else if(i===16) roles.push("black");
  else roles.push("neutral");
}

// خلط الكلمات والأدوار
words.sort(()=>Math.random()-0.5);
roles.sort(()=>Math.random()-0.5);

const board = document.getElementById("board");
const gameRef = ref(db, "room1"); // الغرفة الافتراضية

// إذا لا توجد بيانات، انشئها
set(gameRef, {cards: words.map((w,i)=>({word:w,role:roles[i],revealed:false}))});

// استماع للتغييرات في الوقت الفعلي
onValue(gameRef, (snapshot)=>{
  const data = snapshot.val();
  if(!data) return;
  board.innerHTML = "";
  data.cards.forEach((c,i)=>{
    const card = document.createElement("div");
    card.className = "card";
    card.textContent = c.word;
    if(c.revealed) card.classList.add(c.role);
    card.onclick = ()=>{
      if(!c.revealed){
        c.revealed = true;
        set(ref(db, "room1/cards/"+i), c);
      }
    };
    board.appendChild(card);
  });
});
