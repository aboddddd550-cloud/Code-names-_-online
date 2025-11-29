// كلمات اللعبة (يمكنك تعديلها)
const words = [
  "شمس","قمر","نجم","سماء","بحر",
  "جبل","نهر","وردة","شجرة","كتاب",
  "سيارة","طائرة","قط","كلب","فيل",
  "مطر","ثلج","نار","هواء","زجاج",
  "مفتاح","قفل","باب","نافذة","كرسي"
];

// مراجع عناصر HTML
const board = document.getElementById("board");
const currentTeamSpan = document.getElementById("current-team");
const roleSpan = document.getElementById("role");
const redLeftSpan = document.getElementById("red-left");
const blueLeftSpan = document.getElementById("blue-left");
const newGameBtn = document.getElementById("newGameBtn");

let boardCards = [];
let colors = [];
let redLeft = 9;
let blueLeft = 8;
let currentTeam = "blue"; // الفريق الأزرق يبدأ

// دالة لخلط مصفوفة
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// إنشاء لعبة جديدة
function newGame() {
  board.innerHTML = "";
  boardCards = [];
  colors = [];
  redLeft = 9;
  blueLeft = 8;
  currentTeam = "blue";
  currentTeamSpan.textContent = currentTeam === "blue" ? "أزرق" : "أحمر";
  redLeftSpan.textContent = redLeft;
  blueLeftSpan.textContent = blueLeft;

  const shuffledWords = shuffle(words.slice());

  // توزيع الألوان بشكل دقيق
  colors = Array(9).fill("red")
    .concat(Array(8).fill("blue"))
    .concat(Array(7).fill("neutral"))
    .concat(["assassin"]);
  shuffle(colors);

  for (let i = 0; i < 25; i++) {
    const card = document.createElement("div");
    card.className = "card";
    card.textContent = shuffledWords[i];
    card.dataset.color = colors[i];
    card.dataset.revealed = "false";

    card.addEventListener("click", () => revealCard(card));

    board.appendChild(card);
    boardCards.push(card);
  }
}

// كشف البطاقة
function revealCard(card) {
  if (card.dataset.revealed === "true") return;

  const color = card.dataset.color;

  if (roleSpan.textContent === "Spymaster") {
    // Spymaster يرى كل الألوان دون تغيير الدور
    if (color === "red") card.style.backgroundColor = "#ff4d4d";
    else if (color === "blue") card.style.backgroundColor = "#4d79ff";
    else if (color === "neutral") card.style.backgroundColor = "#d9d9d9";
    else if (color === "assassin") card.style.backgroundColor = "#000";
  } else {
    // Guessers
    if (color === "red") {
      card.style.backgroundColor = "#ff4d4d";
      redLeft--;
    } else if (color === "blue") {
      card.style.backgroundColor = "#4d79ff";
      blueLeft--;
    } else if (color === "neutral") {
      card.style.backgroundColor = "#d9d9d9";
    } else if (color === "assassin") {
      card.style.backgroundColor = "#000";
      alert("لقد اكتشفت بطاقة القاتل! انتهت اللعبة.");
    }

    // تحديث العداد
    redLeftSpan.textContent = redLeft;
    blueLeftSpan.textContent = blueLeft;

    // تغيير الدور إذا اخترت بطاقة الفريق الخصم
    if ((currentTeam === "blue" && color === "red") || (currentTeam === "red" && color === "blue") || color === "neutral") {
      currentTeam = currentTeam === "blue" ? "red" : "blue";
      currentTeamSpan.textContent = currentTeam === "blue" ? "أزرق" : "أحمر";
    }
  }

  card.dataset.revealed = "true";
}

// زر لعبة جديدة
newGameBtn.addEventListener("click", newGame);

// بدء اللعبة مباشرة
newGame();
