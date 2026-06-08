const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const scoreValue = document.querySelector("#scoreValue");
const bestValue = document.querySelector("#bestValue");
const statusText = document.querySelector("#statusText");
const overlay = document.querySelector("#gameOverlay");
const overlayEyebrow = document.querySelector("#overlayEyebrow");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const overlayButton = document.querySelector("#overlayButton");
const rankPanel = document.querySelector("#rankPanel");
const rankValue = document.querySelector("#rankValue");
const rankList = document.querySelector("#rankList");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");
const restartButton = document.querySelector("#restartButton");

const STORAGE_KEY = "dodge-dash-best-score";
const HISTORY_KEY = "dodge-dash-score-history";
const MAX_HISTORY = 100;
const keys = new Set();
const pointer = {
  active: false,
  x: 0,
  y: 0,
};

let bestScore = Number(localStorage.getItem(STORAGE_KEY) || 0);
let scoreHistory = loadScoreHistory();
let state = "idle";
let animationFrame = 0;
let lastTime = 0;
let elapsed = 0;
let spawnTimer = 0;
let obstacles = [];
let particles = [];

const game = {
  width: 960,
  height: 620,
  dpr: 1,
};

const player = {
  x: 480,
  y: 520,
  radius: 18,
  speed: 420,
  invulnerable: 0,
};

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  game.dpr = Math.min(window.devicePixelRatio || 1, 2);
  game.width = Math.max(320, Math.round(rect.width));
  game.height = Math.max(360, Math.round(rect.height));
  canvas.width = Math.round(game.width * game.dpr);
  canvas.height = Math.round(game.height * game.dpr);
  ctx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
  clampPlayer();
  draw();
}

function resetGame() {
  elapsed = 0;
  spawnTimer = 0;
  obstacles = [];
  particles = [];
  player.x = game.width / 2;
  player.y = game.height - Math.max(64, game.height * 0.14);
  player.radius = Math.max(15, Math.min(22, game.width * 0.024));
  player.invulnerable = 0.6;
  lastTime = performance.now();
}

function startGame() {
  resetGame();
  state = "running";
  hideOverlay();
  syncUi();
}

function pauseGame() {
  if (state !== "running") {
    return;
  }
  state = "paused";
  showOverlay("暂停中", "喘口气", "点击继续回到游戏。", "继续");
  syncUi();
}

function resumeGame() {
  if (state !== "paused") {
    return;
  }
  state = "running";
  lastTime = performance.now();
  hideOverlay();
  syncUi();
}

function endGame() {
  state = "gameOver";
  const score = getScore();
  const rankInfo = recordScore(score);
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(STORAGE_KEY, String(bestScore));
  }
  burst(player.x, player.y, 24, "#ff5b6e");
  showOverlay(
    "挑战结束",
    `得分 ${score}`,
    `本局排在个人历史第 ${rankInfo.rank} 名，最高分 ${bestScore}。`,
    "重新开始",
    rankInfo,
  );
  syncUi();
}

function getScore() {
  return Math.floor(elapsed * 10);
}

function loadScoreHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    if (!Array.isArray(saved)) {
      return [];
    }
    return saved
      .map((entry) => ({
        id: Number(entry.id) || Date.now(),
        score: Math.max(0, Math.floor(Number(entry.score) || 0)),
        playedAt: Number(entry.playedAt) || Date.now(),
      }))
      .filter((entry) => entry.score >= 0)
      .slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

function recordScore(score) {
  const entry = {
    id: Date.now(),
    score,
    playedAt: Date.now(),
  };
  scoreHistory = [entry, ...scoreHistory].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(scoreHistory));

  const ranked = getRankedHistory();
  const rank = ranked.findIndex((item) => item.id === entry.id) + 1;
  return {
    rank,
    total: ranked.length,
    currentId: entry.id,
    topScores: ranked.slice(0, 5),
  };
}

function getRankedHistory() {
  return [...scoreHistory].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.playedAt - b.playedAt;
  });
}

function getDifficulty() {
  return 1 + Math.min(2.8, elapsed / 24);
}

function getSpawnEdges() {
  const score = getScore();
  if (score >= 1500) {
    return ["top", "left", "right", "bottom"];
  }
  if (score >= 1000) {
    return ["top", "left", "right"];
  }
  if (score >= 500) {
    return ["top", "left"];
  }
  return ["top"];
}

function spawnObstacle() {
  const difficulty = getDifficulty();
  const size = randomBetween(18, 34 + difficulty * 4);
  const speed = randomBetween(170, 260 + difficulty * 85);
  const colors = ["#33d6ff", "#ff5b6e", "#ffc247", "#b6f33b"];
  const edges = getSpawnEdges();
  const edge = edges[Math.floor(Math.random() * edges.length)];
  const drift = randomBetween(-0.28, 0.28) * speed;
  const obstacle = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    size,
    spin: randomBetween(-2.4, 2.4),
    angle: randomBetween(0, Math.PI * 2),
    color: colors[Math.floor(Math.random() * colors.length)],
  };

  if (edge === "left") {
    obstacle.x = -size - 8;
    obstacle.y = randomBetween(size, game.height - size);
    obstacle.vx = speed;
    obstacle.vy = drift;
  } else if (edge === "right") {
    obstacle.x = game.width + size + 8;
    obstacle.y = randomBetween(size, game.height - size);
    obstacle.vx = -speed;
    obstacle.vy = drift;
  } else if (edge === "bottom") {
    obstacle.x = randomBetween(size, game.width - size);
    obstacle.y = game.height + size + 8;
    obstacle.vx = drift;
    obstacle.vy = -speed;
  } else {
    obstacle.x = randomBetween(size, game.width - size);
    obstacle.y = -size - 8;
    obstacle.vx = drift;
    obstacle.vy = speed;
  }

  obstacles.push({
    ...obstacle,
  });
}

function update(delta) {
  if (state !== "running") {
    updateParticles(delta);
    return;
  }

  elapsed += delta;
  player.invulnerable = Math.max(0, player.invulnerable - delta);
  updatePlayer(delta);
  updateObstacles(delta);
  updateParticles(delta);
  updateScore();
}

function updatePlayer(delta) {
  const direction = {
    x: 0,
    y: 0,
  };

  if (keys.has("arrowleft") || keys.has("a")) direction.x -= 1;
  if (keys.has("arrowright") || keys.has("d")) direction.x += 1;
  if (keys.has("arrowup") || keys.has("w")) direction.y -= 1;
  if (keys.has("arrowdown") || keys.has("s")) direction.y += 1;

  if (pointer.active) {
    const easing = Math.min(1, delta * 12);
    player.x += (pointer.x - player.x) * easing;
    player.y += (pointer.y - player.y) * easing;
  } else if (direction.x || direction.y) {
    const length = Math.hypot(direction.x, direction.y) || 1;
    player.x += (direction.x / length) * player.speed * delta;
    player.y += (direction.y / length) * player.speed * delta;
  }

  clampPlayer();
}

function updateObstacles(delta) {
  const difficulty = getDifficulty();
  spawnTimer -= delta;
  if (spawnTimer <= 0) {
    spawnObstacle();
    spawnTimer = Math.max(0.22, randomBetween(0.78, 1.08) / difficulty);
  }

  obstacles.forEach((obstacle) => {
    obstacle.x += obstacle.vx * delta;
    obstacle.y += obstacle.vy * delta;
    obstacle.angle += obstacle.spin * delta;
  });

  obstacles = obstacles.filter((obstacle) => (
    obstacle.x + obstacle.size > -80
    && obstacle.x - obstacle.size < game.width + 80
    && obstacle.y + obstacle.size > -80
    && obstacle.y - obstacle.size < game.height + 80
  ));

  if (player.invulnerable > 0) {
    return;
  }

  for (const obstacle of obstacles) {
    const hitRadius = player.radius + obstacle.size * 0.68;
    if (Math.hypot(player.x - obstacle.x, player.y - obstacle.y) < hitRadius) {
      endGame();
      return;
    }
  }
}

function updateParticles(delta) {
  particles.forEach((particle) => {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.life -= delta;
    particle.size *= 0.98;
  });
  particles = particles.filter((particle) => particle.life > 0 && particle.size > 0.4);
}

function updateScore() {
  const score = getScore();
  scoreValue.textContent = String(score);
  if (score > bestScore) {
    bestValue.textContent = String(score);
  }
}

function clampPlayer() {
  player.x = Math.min(game.width - player.radius, Math.max(player.radius, player.x));
  player.y = Math.min(game.height - player.radius, Math.max(player.radius, player.y));
}

function burst(x, y, count, color) {
  for (let index = 0; index < count; index += 1) {
    const angle = randomBetween(0, Math.PI * 2);
    const speed = randomBetween(90, 280);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: randomBetween(3, 8),
      life: randomBetween(0.35, 0.8),
      color,
    });
  }
}

function draw() {
  ctx.clearRect(0, 0, game.width, game.height);
  drawBackground();
  drawObstacles();
  drawParticles();
  drawPlayer();

  if (state === "idle") {
    drawHint("按开始进入闪避节奏");
  }
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, game.width, game.height);
  gradient.addColorStop(0, "#172033");
  gradient.addColorStop(1, "#101522");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, game.width, game.height);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
  ctx.lineWidth = 1;
  const grid = 44;
  const offset = (elapsed * 28) % grid;

  for (let x = -grid; x < game.width + grid; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + offset, game.height);
    ctx.stroke();
  }

  for (let y = offset - grid; y < game.height + grid; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(game.width, y);
    ctx.stroke();
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  if (player.invulnerable > 0) {
    ctx.globalAlpha = 0.55 + Math.sin(performance.now() / 60) * 0.25;
  }

  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, player.radius * 2.8);
  glow.addColorStop(0, "rgba(182, 243, 59, 0.4)");
  glow.addColorStop(1, "rgba(182, 243, 59, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius * 2.8, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(-player.radius * 0.35, -player.radius * 0.45, 2, 0, 0, player.radius);
  body.addColorStop(0, "#ffffff");
  body.addColorStop(0.32, "#b6f33b");
  body.addColorStop(1, "#20b8ff");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function drawObstacles() {
  obstacles.forEach((obstacle) => {
    ctx.save();
    ctx.translate(obstacle.x, obstacle.y);
    ctx.rotate(obstacle.angle);
    ctx.fillStyle = obstacle.color;
    ctx.shadowColor = obstacle.color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    const points = 5;
    for (let i = 0; i < points * 2; i += 1) {
      const radius = i % 2 === 0 ? obstacle.size : obstacle.size * 0.46;
      const angle = -Math.PI / 2 + (i * Math.PI) / points;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  });
}

function drawParticles() {
  particles.forEach((particle) => {
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

function drawHint(text) {
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.font = "800 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, game.width / 2, game.height / 2 + 120);
  ctx.restore();
}

function loop(time) {
  const delta = Math.min(0.033, (time - lastTime) / 1000 || 0);
  lastTime = time;
  update(delta);
  draw();
  animationFrame = requestAnimationFrame(loop);
}

function syncUi() {
  scoreValue.textContent = String(getScore());
  bestValue.textContent = String(Math.max(bestScore, getScore()));

  startButton.textContent = state === "running" ? "进行中" : "开始";
  startButton.disabled = state === "running";
  pauseButton.disabled = state !== "running" && state !== "paused";
  pauseButton.textContent = state === "paused" ? "继续" : "暂停";

  const statusMap = {
    idle: "准备好后开始",
    running: "正在闪避",
    paused: "暂停中",
    gameOver: "挑战结束",
  };
  statusText.textContent = statusMap[state];
}

function showOverlay(eyebrow, title, text, buttonText, rankInfo = null) {
  overlayEyebrow.textContent = eyebrow;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlayButton.textContent = buttonText;
  renderRankPanel(rankInfo);
  overlay.classList.add("is-visible");
}

function hideOverlay() {
  overlay.classList.remove("is-visible");
  renderRankPanel(null);
}

function renderRankPanel(rankInfo) {
  if (!rankInfo) {
    rankPanel.hidden = true;
    rankList.innerHTML = "";
    return;
  }

  rankPanel.hidden = false;
  rankValue.textContent = `#${rankInfo.rank}`;
  rankList.innerHTML = rankInfo.topScores
    .map((entry, index) => {
      const marker = entry.id === rankInfo.currentId ? "本局" : formatPlayedAt(entry.playedAt);
      const currentClass = entry.id === rankInfo.currentId ? " class=\"is-current\"" : "";
      return `<li${currentClass}><span>#${index + 1}</span><strong>${entry.score}</strong><span>${marker}</span></li>`;
    })
    .join("");
}

function formatPlayedAt(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function setPointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * game.width;
  pointer.y = ((event.clientY - rect.top) / rect.height) * game.height;
  pointer.x = Math.min(game.width - player.radius, Math.max(player.radius, pointer.x));
  pointer.y = Math.min(game.height - player.radius, Math.max(player.radius, pointer.y));
}

function handlePrimaryAction() {
  if (state === "paused") {
    resumeGame();
  } else {
    startGame();
  }
}

window.addEventListener("resize", resizeCanvas);

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", "w", "a", "s", "d", " "].includes(key)) {
    event.preventDefault();
  }

  if (key === " " && state === "running") {
    pauseGame();
    return;
  }

  if (key === " " && state === "paused") {
    resumeGame();
    return;
  }

  keys.add(key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

canvas.addEventListener("pointerdown", (event) => {
  if (state === "idle" || state === "gameOver") {
    startGame();
  }
  pointer.active = true;
  setPointerFromEvent(event);
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!pointer.active) {
    return;
  }
  setPointerFromEvent(event);
});

canvas.addEventListener("pointerup", () => {
  pointer.active = false;
});

canvas.addEventListener("pointercancel", () => {
  pointer.active = false;
});

overlayButton.addEventListener("click", handlePrimaryAction);
startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", () => {
  if (state === "paused") {
    resumeGame();
  } else {
    pauseGame();
  }
});

bestValue.textContent = String(bestScore);
resizeCanvas();
showOverlay("街机生存挑战", "别被砸中", "用方向键、WASD 或触屏拖动移动，坚持越久分数越高。", "开始游戏");
syncUi();
animationFrame = requestAnimationFrame(loop);

window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(animationFrame);
});
