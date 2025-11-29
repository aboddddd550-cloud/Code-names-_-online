// كلمات تجريبية — يمكنك استبدالها لاحقاً
const words = [
    "صقر", "مفتاح", "قلم", "بحر", "جبل",
    "نجم", "وردة", "مدينة", "هاتف", "كتاب",
    "شمس", "ظل", "سيارة", "سفينة", "لؤلؤ",
    "قمر", "غابة", "باب", "ورق", "ثلج",
    "شارع", "سيف", "حصان", "ذهب", "خريطة"
];

// توزيع الألوان مثل اللعبة الأصلية
const keycard = [
    "red","red","red","red","red","red","red","red",
    "blue","blue","blue","blue","blue","blue","blue","blue",
    "neutral","neutral","neutral","neutral","neutral","neutral","neutral",
    "assassin"
];

// خلط الكلمات
function shuffle(arr) {
    return arr.sort(() => Math.random() - 0.5);
}

shuffle(words);
shuffle(keycard);

// بناء اللوحة
const board = document.getElementById("board");

for (let i = 0; i < 25; i++) {

    const div = document.createElement("div");
    div.className = "card";

    div.textContent = words[i];       // عرض الكلمة

    div.dataset.color = keycard[i];   // حفظ اللون الحقيقي داخل data attribute

    div.onclick = () => {
        div.classList.add(div.dataset.color);
    };

    board.appendChild(div);
}
