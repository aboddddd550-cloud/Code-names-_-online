// كلمات مبدئية (يمكنك تعديلها لاحقاً)
const words = [
  "شمس","قمر","نجم","سماء","بحر",
  "جبل","نهر","وردة","شجرة","كتاب",
  "سيارة","طائرة","قط","كلب","فيل",
  "مطر","ثلج","نار","هواء","زجاج",
  "مفتاح","قفل","باب","نافذة","كرسي"
];

// لوحات اللعبة
const board = document.getElementById("board");

// توزيع الكلمات عشوائياً على البطاقات
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const shuffledWords = shuffle(words.slice());

for (let i = 0; i < 25; i++) {
  const card = document.getElementById(`card${i}`);
  card.textContent = shuffledWords[i];

  // إضافة حدث عند الضغط على البطاقة
  card.addEventListener("click", () => {
    card.style.backgroundColor = "#d9d9d9"; // اللون الافتراضي عند الكشف
  });
}
