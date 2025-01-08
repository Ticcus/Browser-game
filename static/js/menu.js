var modal = document.getElementById("loginRegisterModal");
var loginRegisterBtn = document.getElementById("login-register-btn");
var logoutBtn = document.getElementById("logout-btn");
var startGameBtn = document.getElementById("start-game-btn");
var loginRequiredMsg = document.getElementById("login-required-msg");
var usernameDisplay = document.getElementById("username-display");
var loggedInUsernameSpan = document.getElementById("logged-in-username");
var span = document.getElementsByClassName("close")[0];

fetch("/get_user_status")
  .then((response) => response.json())
  .then((data) => {
    if (data.logged_in) {
      document.getElementById("logged-in-username").textContent = data.username;
      document.getElementById("username-display").style.display = "block";

      if (data.banned) {
        document.getElementById("start-game-btn").style.display = "none";
        document.getElementById("login-required-msg").style.display = "none";
        document.getElementById("banned-msg").style.display = "block";
      } else {
        document.getElementById("start-game-btn").style.display = "block";
        document.getElementById("login-required-msg").style.display = "none";
        document.getElementById("banned-msg").style.display = "none";
      }
    } else {
      document.getElementById("start-game-btn").style.display = "none";
      document.getElementById("login-required-msg").style.display = "block";
      document.getElementById("banned-msg").style.display = "none";
    }
  })
  .catch((error) => console.error("Error fetching user status:", error));

loginRegisterBtn.onclick = function () {
  modal.style.display = "block";
};

span.onclick = function () {
  modal.style.display = "none";
};

window.onclick = function (event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
};

function showAlert(message, isSuccess = true) {
  const alertBox = document.getElementById("alertBox");
  const alertMessage = document.getElementById("alertMessage");
  const closeAlert = document.getElementById("closeAlert");

  alertMessage.textContent = message;
  alertBox.style.backgroundColor = isSuccess ? "#2b2b40" : "#ff6f61";
  alertBox.style.borderColor = isSuccess ? "#00d4ff" : "#c82333";
  alertBox.style.display = "flex";

  closeAlert.onclick = function () {
    alertBox.style.display = "none";
  };

  setTimeout(() => {
    alertBox.style.display = "none";
  }, 5000);
}

document.getElementById("registerBtn").onclick = function (event) {
  event.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  if (username.length < 2) {
    showAlert("Username must be at least 2 characters long.", false);
    return;
  }

  if (password.length < 6) {
    showAlert("Password must be at least 6 characters long.", false);
    return;
  }

  fetch("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((error) => {
          throw new Error(error.message);
        });
      }
      return response.json();
    })
    .then((data) => {
      showAlert(data.message, true);
    })
    .catch((error) => {
      console.error("Error:", error);
      showAlert(error.message, false);
    });
};

document.getElementById("loginBtn").onclick = function (event) {
  event.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((error) => {
          throw new Error(error.message);
        });
      }
      return response.json();
    })
    .then((data) => {
      localStorage.setItem("loginSuccessMessage", data.message);

      location.reload();
    })
    .catch((error) => {
      showAlert(error.message, false);
    });
};

window.onload = function () {
  const successMessage = localStorage.getItem("loginSuccessMessage");
  if (successMessage) {
    showAlert(successMessage, true);
    localStorage.removeItem("loginSuccessMessage"); 
  }
};

logoutBtn.onclick = function () {
  fetch("/logout", { method: "POST" })
    .then((response) => response.json())
    .then((data) => {
      if (data.message === "Logged out successfully!") {
        location.reload(); 
      }
    })
    .catch((err) => console.error(err));
};
