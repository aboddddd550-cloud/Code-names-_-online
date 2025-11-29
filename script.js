document.addEventListener("DOMContentLoaded", () => {

    const words = [
        "صقر","مفتاح","قلم","بحر","جبل",
        "نجم","وردة","مدينة","هاتف","كتاب",
        "شمس","ظل","سيارة","سفينة","لؤلؤ",
        "قمر","غابة","باب","ورق","ثلج",
        "شارع","سيف","حصان","ذهب","خريطة"
    ];

    const keycard = [
        "red","red","red","red","red","red","red","red",
        "blue","blue","blue","blue","blue","blue","blue","blue",
        "neutral","neutral","neutral","neutral","neutral","neutral","neutral",
        "assassin"
    ];

    function shuffle(arr) {
        return arr.sort(() => Math.random() - 0.5);
    }

    shuffle(words);
    shuffle(keycard);

    const board = document.getElementById("board");

    for (let i = 0; i < 25; i++) {
        const div = document.createElement("div");
        div.className = "card";
        div.textContent = words[i];  
        div.dataset.color = keycard[i];

        div.onclick = () => {
            div.classList.add(div.dataset.color);
        };

        board.appendChild(div);
    }
});
