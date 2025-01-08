let confirmModal = document.getElementById("confirmModal");
let confirmMessage = document.getElementById("confirmMessage");
let confirmYes = document.getElementById("confirmYes");
let confirmNo = document.getElementById("confirmNo");

function showConfirmModal(message, onConfirm) {
  confirmMessage.textContent = message;
  confirmModal.style.display = "block";

  confirmYes.onclick = () => {
    confirmModal.style.display = "none";
    onConfirm();
  };

  confirmNo.onclick = () => {
    confirmModal.style.display = "none";
  };
}

document.querySelectorAll(".delete-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const username = button.getAttribute("data-username");

    showConfirmModal(
      `Are you sure you want to delete the highscore for ${username}?`,
      () => {
        fetch("/delete_highscore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.success) {
              location.reload();
            }
          })
          .catch((error) => console.error("Error:", error));
      }
    );
  });
});
