const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Game settings
const gameWidth = canvas.width;
const gameHeight = canvas.height;
let gameRunning = true;
let playerHealth = 100;
let money = 100;
let selectedTower = null;
let cursorX = 0;
let cursorY = 0;
let isPlacingTower = false;
let isPlacementValid = false;
let paused = false;
let beforemute = 50;
let lastSpawnTime = null;
let elapsedGameTime = 0;
let spawnInterval = 2000;
const spawnIntervalMin = 500;
let spawnRateDecrease = 0.1;
const harderEnemyWeightScaling = 0.005;
let score = 0;
let difficultyMultiplier = 1;
let numberOfPoints = 0;
let healthMultiplier = 1;
let gameTime = 0;
let towers = [];
let enemies = [];
let bullets = [];
let towerDefinitions = {};
let enemyDefinitions = {};
const enemiesToRemove = [];
const path = [];


// Fetches tower definitions from a JSON file and initializes tower data
fetch("static/json/tower.json")
  .then((response) => response.json())
  .then((data) => {
    data.forEach((tower) => {
      towerDefinitions[tower.type] = tower;
    });
  })
  .catch((error) => console.error("Error loading tower definitions:", error));

function selectTower(towerType) {
  selectedTower = towerType;
  if (money < towerDefinitions[selectedTower].cost) {
  } else {
    isPlacingTower = true; 
  }
}

// Fetches enemy definitions from a JSON file and initializes enemy data
fetch("static/json/enemy.json")
  .then((response) => response.json())
  .then((data) => {
    data.forEach((enemy) => {
      enemyDefinitions[enemy.type] = enemy;
    });
  })
  .catch((error) => console.error("Error loading enemy definitions:", error));

// Class representing a Tower
class Tower {
  constructor(x, y, type) {
    const definition = towerDefinitions[type];
    if (!definition) {
      throw new Error(`Tower type "${type}" not defined`);
    }
    this.x = x;
    this.y = y;
    this.type = type;
    this.range = definition.range;
    this.damage = definition.damage;
    this.color = definition.color;
    this.cost = definition.cost;
    this.cooldown = 0;
    this.cooldownTime = definition.cooldown;
  }

  // Draw tower on the canvas, including range and highlights
  draw(isSelected) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - 10, this.y - 10, 20, 20);

    if (isSelected) {
      ctx.strokeStyle = "yellow"; 
      ctx.lineWidth = 3; 
      ctx.strokeRect(this.x - 10, this.y - 10, 20, 20); 

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 0, 0, 0.5)"; 
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  
  // Handles the shooting behavior of the tower
  shoot() {
    if (this.cooldown === 0) {
      let target = enemies.find(
        (enemy) => Math.hypot(enemy.x - this.x, enemy.y - this.y) < this.range
      );
      if (target) {
        bullets.push(new Bullet(this.x, this.y, target, this.damage));
        this.cooldown = this.cooldownTime;
      }
    } else {
      this.cooldown--;
    }
  }
}

// Represents a Bullet fired by a tower towards an enemy
class Bullet {
  constructor(x, y, target, damage) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.speed = 5;
    this.damage = damage; 
  }
  // Updates the bullet's position and checks for collision with the target
  move() {
    const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    this.x += Math.cos(angle) * this.speed;
    this.y += Math.sin(angle) * this.speed;

    if (Math.hypot(this.target.x - this.x, this.target.y - this.y) < 5) {
      if (
        this.target &&
        this.target.health !== undefined &&
        typeof this.target.health === "number"
      ) {
        this.target.health -= this.damage; 
      }

      bullets = bullets.filter((b) => b !== this);
    }
  }

  // Draws the bullet
  draw() {
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function updateMoneyDisplay() {
  const moneyDisplay = document.getElementById("moneyDisplay");
  moneyDisplay.textContent = `Money: $${money}`;
}

// Fetches and applies the selected game difficulty level
function fetchDifficulty() {
  return fetch("/get_difficulty")
    .then((response) => response.json())
    .then((data) => {
      const difficulty = data.difficulty;
      switch (difficulty) {
        case "Easy":
          numberOfPoints = 3;
          difficultyMultiplier = 0.5;
          healthMultiplier = 1.0;
          break;
        case "Medium":
          numberOfPoints = 2;
          difficultyMultiplier = 1.0;
          healthMultiplier = 1.0;
          break;
        case "Hard":
          numberOfPoints = 1;
          difficultyMultiplier = 1.2;
          healthMultiplier = 1.2;
          break;
        case "Extreme":
          numberOfPoints = 0;
          difficultyMultiplier = 1.5;
          healthMultiplier = 1.5;
          break;
        default:
          numberOfPoints = 3;
          difficultyMultiplier = 0.5;
          healthMultiplier = 1.0; 
      }
    })
    .catch((error) => console.error("Error fetching difficulty:", error));
}


// Generate a randomized path for enemies to follow
function generatePath() {
  path.length = 0; // Clear any existing path
 
  // Randomly select a starting side and opposite side for the endpoint
  const startSide = Math.floor(Math.random() * 4); 
  const endSide = (startSide + 2) % 4; 

  // Get the starting point
  let startX, startY;
  if (startSide === 0) {
    // Left side
    startX = 0;
    startY = Math.random() * gameHeight;
  } else if (startSide === 1) {
    // Top side
    startX = Math.random() * gameWidth;
    startY = 0;
  } else if (startSide === 2) {
    // Right side
    startX = gameWidth;
    startY = Math.random() * gameHeight;
  } else if (startSide === 3) {
    // Bottom side
    startX = Math.random() * gameWidth;
    startY = gameHeight;
  }

  // Get the ending point
  let endX, endY;
  if (endSide === 0) {
    // Left side
    endX = 0;
    endY = Math.random() * gameHeight;
  } else if (endSide === 1) {
    // Top side
    endX = Math.random() * gameWidth;
    endY = 0;
  } else if (endSide === 2) {
    // Right side
    endX = gameWidth;
    endY = Math.random() * gameHeight;
  } else if (endSide === 3) {
    // Bottom side
    endX = Math.random() * gameWidth;
    endY = gameHeight;
  }

  path.push({ x: startX, y: startY });

  for (let i = 0; i < numberOfPoints; i++) {
    const x = Math.random() * gameWidth;
    const y = Math.random() * gameHeight;
    path.push({ x, y });
  }

  path.push({ x: endX, y: endY });
}

function drawPath() {
  ctx.strokeStyle = "lightgray";
  ctx.lineWidth = 8;

  // Draw the path lines
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y);
  }
  ctx.stroke();

  // Mark the start point
  const startPoint = path[0];
  ctx.fillStyle = "green"; 
  ctx.beginPath();
  ctx.arc(startPoint.x, startPoint.y, 10, 0, Math.PI * 2);
  ctx.fill();

  // Mark the end point
  const endPoint = path[path.length - 1];
  ctx.fillStyle = "red"; 
  ctx.beginPath();
  ctx.arc(endPoint.x, endPoint.y, 10, 0, Math.PI * 2);
  ctx.fill();
}

// Function to update the player's health bar in the DOM
function drawPlayerHealthBar() {
  const healthBarContainer = document.getElementById("healthBar");
  const healthBarInner =
    document.getElementById("healthBarInner") || document.createElement("div");
  const hpTooltip = document.getElementById("hpTooltip");

  if (!healthBarInner.id) {
    healthBarInner.id = "healthBarInner";
    healthBarContainer.appendChild(healthBarInner);
  }

  const healthRatio = playerHealth / 100;

  healthBarInner.style.width = `${healthRatio * 100}%`;

  hpTooltip.textContent = `${Math.floor(healthRatio * 100)}%`;
}

// Game over
function checkGameOver() {
  if (!gameRunning || playerHealth > 0) return;
  gameRunning = false; 
  console.log("help i have been runin too many times");
  const currentScore = Math.floor(score);
  fetch("/save_score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ score: currentScore }),
  })
    .then((response) => response.json())
    .then((data) => {
      showGameOverScreen(currentScore);
    })
    .catch((error) => {
      showGameOverScreen(currentScore);
    });
}

// Reset game
function restartGame() {
  playerHealth = 100;
  money = 100;
  score = 0;
  towers = [];
  enemies = [];
  bullets = [];
  elapsedGameTime = 0;
  gameRunning = true;

  const gameOverScreen = document.getElementById("gameOverScreen");
  gameOverScreen.style.display = "none";

  // Restart game
  fetchDifficulty().then(() => {
    generatePath();
    playMusicIfEnabled();
    gameLoop();
  });
}

// Represents an enemy with movement, health, and reward properties
class Enemy {
  constructor(type) {
    const definition = enemyDefinitions[type];
    if (!definition) {
      throw new Error(`Enemy type "${type}" not defined`);
    }

    this.type = type;
    this.x = path[0].x;
    this.y = path[0].y;
    this.speed = definition.speed;
    this.health = definition.health * healthMultiplier; 
    this.maxHealth = this.health;
    this.reward = definition.reward;
    this.color = definition.color;
    this.currentWaypoint = 1;
  }

  move() {
    if (this.currentWaypoint < path.length) {
      const target = path[this.currentWaypoint];
      const angle = Math.atan2(target.y - this.y, target.x - this.x);
      this.x += Math.cos(angle) * this.speed;
      this.y += Math.sin(angle) * this.speed;

      if (Math.hypot(target.x - this.x, target.y - this.y) < 5) {
        this.currentWaypoint++;
      }
    } else {
      playerHealth -= 10; 
      enemies = enemies.filter((e) => e !== this);
    }
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - 10, this.y - 10, 20, 20);

    const healthBarWidth = 20;
    const healthBarHeight = 5;
    const healthRatio = this.health / this.maxHealth;

    ctx.fillStyle = "gray";
    ctx.fillRect(this.x - 10, this.y - 15, healthBarWidth, healthBarHeight);

    ctx.fillStyle = "green";
    ctx.fillRect(
      this.x - 10,
      this.y - 15,
      healthBarWidth * healthRatio,
      healthBarHeight
    );
  }
}

// Determines if a point is near any segment of the enemy path
function isNearPath(x, y) {
  for (let i = 0; i < path.length - 1; i++) {
    const segmentStart = path[i];
    const segmentEnd = path[i + 1];

    const distance = pointToSegmentDistance(x, y, segmentStart, segmentEnd);
    if (distance < 25) {
      return true;
    }
  }
  return false;
}

// Calculates the shortest distance from a point to a line segment
function pointToSegmentDistance(px, py, start, end) {
  const x1 = start.x,
    y1 = start.y;
  const x2 = end.x,
    y2 = end.y;

  const dx = x2 - x1;
  const dy = y2 - y1;

  const lengthSquared = dx * dx + dy * dy;
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;

  t = Math.max(0, Math.min(1, t)); 

  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  return Math.hypot(px - closestX, py - closestY);
}

// Adds an event listener to deselect a tower when the deselect button is clicked
document.getElementById("deselectButton").addEventListener("click", () => {
  deselectTower();
});

// Spawns an enemy based on weighted probabilities of enemy types
function spawnEnemy() {
  const enemyTypes = Object.keys(enemyDefinitions);

  const weightedEnemies = enemyTypes.map((type) => {
    const weight =
      (enemyDefinitions[type].difficultyFactor || 1) *
      (1 + elapsedGameTime * harderEnemyWeightScaling); 
    return { type, weight };
  });

  const totalWeight = weightedEnemies.reduce(
    (sum, enemy) => sum + enemy.weight,
    0
  );

  const randomValue = Math.random() * totalWeight;
  let cumulativeWeight = 0;

  for (const enemy of weightedEnemies) {
    cumulativeWeight += enemy.weight;
    if (randomValue <= cumulativeWeight) {
      enemies.push(new Enemy(enemy.type)); 
      break;
    }
  }
}

// Handles user clicks on the game canvas, such as tower selection and placement
canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const clickedTower = towers.find(
    (tower) => Math.hypot(tower.x - x, tower.y - y) < 10
  );

  if (clickedTower && !isPlacingTower) {
    if (selectedTower === clickedTower) {
      return;
    }

    highlightTower(clickedTower);

    selectedTower = clickedTower;

    showTowerMenu(clickedTower);
  } else if (!isPlacingTower) {
    deselectTower();
  }

  if (isPlacingTower && selectedTower) {
    const towerCost = towerDefinitions[selectedTower].cost;

    if (money < towerCost) {
      alert(`You don't have enough money for this tower!`); 
      return;
    }

    const isOnPath = isNearPath(x, y);
    const isOnOtherTower = towers.some(
      (tower) => Math.hypot(tower.x - x, tower.y - y) < 25
    );

    if (isOnPath || isOnOtherTower) {
      return;
    }

    money -= towerCost;
    towers.push(new Tower(x, y, selectedTower));
    hideGhostTower(); 
    isPlacingTower = false;
  }
});

// Deselects the currently selected tower and hides the tower menu
function deselectTower() {
  if (selectedTower && !isPlacingTower) {
    selectedTower.highlighted = false; 
    selectedTower = null;
  }
  hideTowerMenu();
  isPlacingTower = false;
}

// Updates the cursor position and validates tower placement when moving the mouse
canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  cursorX = event.clientX - rect.left;
  cursorY = event.clientY - rect.top;
  if (selectedTower && isPlacingTower) {
    const isOnPath = isNearPath(cursorX, cursorY);
    const isOnOtherTower = towers.some(
      (tower) => Math.hypot(tower.x - cursorX, tower.y - cursorY) < 25
    );
    isPlacementValid = !isOnPath && !isOnOtherTower;
  }
});

// Hides the visual representation of a tower being placed
function hideGhostTower() {
  if (selectedTower) {
    selectedTower = null;
  }
}

// Displays the tower menu for a selected tower
function showTowerMenu(tower) {
  if (!tower || !tower.type) {
    return;
  }
  const towerDefinition = towerDefinitions[tower.type];
  if (!towerDefinition) {
    return;
  }

  const towerMenu = document.getElementById("towerMenu");
  const towerName = document.getElementById("towerName");
  const towerDetails = document.getElementById("towerDetails");
  const sellButton = document.getElementById("sellButton");
  const sellValue = Math.floor((towerDefinition.cost || 0) * 0.5);

  towerName.textContent = `Tower: ${tower.type}`;
  towerDetails.innerHTML = `
    Range: ${tower.range}<br>
    Damage: ${tower.damage}<br>
    Fire rate: ${tower.cooldownTime}<br>
    Sell Value: $${sellValue}
  `;

  towerMenu.style.visibility = "visible";
  towerMenu.style.opacity = "1";

  sellButton.onclick = () => {
    money += sellValue;
    towers = towers.filter((t) => t !== tower);
    updateMoneyDisplay();
    hideTowerMenu();
  };
}

// Highlights a selected tower on the game canvas
function highlightTower(tower) {
  tower.highlighted = true;
}

// Hides the tower menu from view
function hideTowerMenu() {
  const towerMenu = document.getElementById("towerMenu");
  towerMenu.style.visibility = "hidden";
  towerMenu.style.opacity = "0";
}

// Updates the displayed player score
function updateScoreDisplay() {
  const scoreDisplay = document.getElementById("scoreDisplay");
  scoreDisplay.textContent = `Score: ${Math.floor(score)}`;
}

// Main game loop that updates and renders the game state
function gameLoop(timestamp) {
  if (paused) {
    requestAnimationFrame(gameLoop);
    return; 
  }
  timestamp = timestamp || performance.now();
  drawPlayerHealthBar();

  checkGameOver();
  if (!gameRunning) return;

  ctx.clearRect(0, 0, gameWidth, gameHeight);

  if (lastSpawnTime === null) {
    lastSpawnTime = timestamp;
  }

  const deltaTime = timestamp - lastSpawnTime;

  elapsedGameTime += deltaTime / 1000;

  spawnInterval = Math.max(
    spawnIntervalMin,
    spawnInterval - spawnRateDecrease * (deltaTime / 1000)
  );

  if (deltaTime >= spawnInterval) {
    spawnEnemy(); 
    lastSpawnTime = timestamp;
  }

  updateMoneyDisplay();
  updateScoreDisplay();
  drawPath();

  towers.forEach((tower) => {
    tower.draw(tower === selectedTower);
    tower.shoot();
  });

  enemies.forEach((enemy) => {
    enemy.move();
    enemy.draw();
  });

  enemies.forEach((enemy) => {
    if (enemy.health <= 0) {
      money += enemy.reward;
      score += enemyDefinitions[enemy.type].scoreValue * difficultyMultiplier;
      enemiesToRemove.push(enemy);
    }
  });

  enemies = enemies.filter((enemy) => !enemiesToRemove.includes(enemy));

  bullets.forEach((bullet) => {
    bullet.move();
    bullet.draw();
  });

  if (selectedTower && isPlacingTower) {
    const towerDefinition = towerDefinitions[selectedTower];
    const ghostColor = isPlacementValid
      ? "rgba(0, 255, 0, 0.5)"
      : "rgba(255, 0, 0, 0.5)";
    ctx.fillStyle = ghostColor;
    ctx.fillRect(cursorX - 10, cursorY - 10, 20, 20);
    ctx.beginPath();
    ctx.arc(cursorX, cursorY, towerDefinition.range, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 255, 0.3)";
    ctx.fill();
  }

  requestAnimationFrame(gameLoop);
}

// Opens the options modal and pauses the game
function openOptions() {
  paused = true;
  const modal = document.getElementById("optionsModal");
  modal.style.display = "block";
}

// Closes the options modal and resumes the game
function closeOptions() {
  if (paused) {
    paused = false; 
    const modal = document.getElementById("optionsModal");
    modal.style.display = "none";
    gameLoop(); 
  }
}

// Handles outside clicks to close the options modal
window.onclick = function (event) {
  const modal = document.getElementById("optionsModal");
  if (event.target === modal) {
    closeOptions();
  }
};

// Ends the current game run
function endRun() {
  closeOptions();
  playerHealth = 0;
}


// Displays the game over screen with the final score
function showGameOverScreen(finalScore) {
  const gameOverScreen = document.getElementById("gameOverScreen");
  const finalScoreDisplay = document.getElementById("finalScore");

  finalScoreDisplay.textContent = finalScore;

  gameOverScreen.style.display = "flex";

  document
    .getElementById("restartGameButton")
    .addEventListener("click", restartGame);
  document.getElementById("backToMenuButton").addEventListener("click", () => {
    window.location.href = "/";
  });
}

const backgroundMusic = document.getElementById("backgroundMusic");
const musicVolumeSlider = document.getElementById("musicVolumeSlider");
const musicToggleIcon = document.getElementById("musicToggleIcon");

// Initializes background music settings on page load
window.onload = function () {
  backgroundMusic.volume = musicVolumeSlider.value / 100;
  updateSpeakerIcon();
};

// Plays background music if enabled
function playMusicIfEnabled() {
  if (backgroundMusic.volume > 0 && !backgroundMusic.muted) {
    backgroundMusic
      .play()
      .then(() => console.log("Music playing"))
      .catch((error) => {
        console.warn("Autoplay blocked. Waiting for user interaction.", error);
        enableMusicOnInteraction(); 
      });
  }
}

// Enables music playback on user interaction if autoplay is blocked
function enableMusicOnInteraction() {
  const playMusic = () => {
    backgroundMusic
      .play()
      .then(() => {
        console.log("Music started after user interaction");
        document.removeEventListener("click", playMusic); 
      })
      .catch((error) =>
        console.error("Error starting music after interaction:", error)
      );
  };

  document.addEventListener("click", playMusic);
}

// Loads saved volume and mute settings on page load
window.onload = function () {
  const savedVolume = localStorage.getItem("musicVolume");
  const savedMuted = localStorage.getItem("musicMuted") === "true";

  if (savedVolume !== null) {
    musicVolumeSlider.value = savedVolume;
    backgroundMusic.volume = savedVolume / 100;
  } else {
    musicVolumeSlider.value = 50; 
    backgroundMusic.volume = 0.5;
  }

  backgroundMusic.muted = savedMuted;
  updateSpeakerIcon();

  playMusicIfEnabled();
};

// Toggles music mute state
function toggleMusicMute() {
  if (backgroundMusic.muted || backgroundMusic.volume === 0) {
    backgroundMusic.muted = false;
    if (beforemute === 0) {
      restoredVolume = 50;
    } else {
      restoredVolume = beforemute;
    }
    console.log(restoredVolume);
    musicVolumeSlider.value = restoredVolume;
    backgroundMusic.volume = restoredVolume / 100;
  } else {
    beforemute = backgroundMusic.volume * 100;
    backgroundMusic.muted = true;
    musicVolumeSlider.value = 0;
    backgroundMusic.volume = 0;
  }

  updateSpeakerIcon();
  localStorage.setItem("musicVolume", musicVolumeSlider.value);
  localStorage.setItem("musicMuted", backgroundMusic.muted);
}

// Updates music volume dynamically
function updateMusicVolume() {
  const volume = musicVolumeSlider.value;
  backgroundMusic.volume = volume / 100; 

  backgroundMusic.muted = volume === "0";
  updateSpeakerIcon();
}

// Updates the speaker icon based on volume and mute state
function updateSpeakerIcon() {
  const volumePercentage = backgroundMusic.volume * 100; 
  if (backgroundMusic.muted || volumePercentage === 0) {
    musicToggleIcon.src = "static/images/music_muted.png";
  } else if (volumePercentage > 0 && volumePercentage <= 33) {
    musicToggleIcon.src = "static/images/low_volume.png";
  } else if (volumePercentage > 33 && volumePercentage <= 66) {
    musicToggleIcon.src = "static/images/medium_volume.png";
  } else {
    musicToggleIcon.src = "static/images/high_volume.png";
  }
}

// Applies music volume settings and saves them to the server
function applySettings() {
  const volume = musicVolumeSlider.value;

  if (volume > 0 && !backgroundMusic.muted) {
    backgroundMusic
      .play()
      .then(() => console.log("Music started"))
      .catch((error) => console.error("Error playing music:", error));
  } else {
    backgroundMusic.pause();
  }

  fetch("/save_preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ volume: parseInt(volume) }),
  })
    .then((response) => response.json())
    .then((data) => console.log(data.message))
    .catch((error) => console.error("Error saving preferences:", error));
}

// Closes the options modal and resumes the game
function closeOptions() {
  applySettings();
  const modal = document.getElementById("optionsModal");
  modal.style.display = "none";
  paused = false; 
  gameLoop();
}

// Opens the options modal and pauses the game
function openOptions() {
  const modal = document.getElementById("optionsModal");
  modal.style.display = "block";
  paused = true; 
}

// Fetches saved preferences on page load and initializes the game
window.onload = function () {
  fetch("/get_preferences")
    .then((response) => response.json())
    .then((data) => {
      const savedVolume = data.volume;
      musicVolumeSlider.value = savedVolume;
      backgroundMusic.volume = savedVolume / 100;
      updateSpeakerIcon();
      playMusicIfEnabled();
    })
    .catch((error) => console.error("Error fetching preferences:", error));
};

// Fetches difficulty, initializes the game, and starts the game loop
fetchDifficulty().then(() => {
  playMusicIfEnabled();
  generatePath();
  gameLoop();
});
