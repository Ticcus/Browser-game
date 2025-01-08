document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".difficulty-btn");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const difficulty = button.getAttribute("data-difficulty");
      selectDifficulty(difficulty);
    });
  });

  function selectDifficulty(difficulty) {
    fetch("/set_difficulty", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ difficulty }),
    })
      .then((response) => {
        if (response.ok) {
          window.location.href = "/game";
        } else {
          console.error("Error setting difficulty:", response.statusText);
        }
      })
      .catch((error) => console.error("Error setting difficulty:", error));
  }
});
