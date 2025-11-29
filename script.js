// كلمات اللعبة (يمكنك تعديلها)
const words = [
  "شمس","قمر","نجم","سماء","بحر",
  "جبل","نهر","وردة","شجرة","كتاب",
  "سيارة","طائرة","قط","كلب","فيل",
  "مطر","ثلج","نار","هواء","زجاج",
  "مفتاح","قفل","باب","نافذة","كرسي"
];

const board = document.getElementById("board");
const roleSpan = document.getElementById("role");
const teamSpan = document.getElementById("current-team");
const newGameBtn = document.getElementById("newGameBtn");

let boardCards = [];
let colors = []; // توزيع ألوان الفرق

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

  const shuffledWords = shuffle(words.slice());

  // توزيع الألوان
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

    card.addEventListener("click", () => {
      if (card.dataset.revealed === "false") {
        revealCard(card);
      }
    });

    board.appendChild(card);
    boardCards.push(card);
  }
}

function revealCard(card) {
  const color = card.dataset.color;
  if (color === "red") card.style.backgroundColor = "#ff4d4d";
  else if (color === "blue") card.style.backgroundColor = "#4d79ff";
  else if (color === "neutral") card.style.backgroundColor = "#d9d9d9";
  else if (color === "assassin") card.style.backgroundColor = "#000";
  card.dataset.revealed = "true";
}

// زر لعبة جديدة
newGameBtn.addEventListener("click", newGame);

// بدء اللعبة مباشرة عند تحميل الصفحة
newGame();
