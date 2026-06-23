const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');
const muteBtn = document.getElementById('mute-btn');

// ---------- Audio (sintetizado con Web Audio API, sin archivos externos) ----------
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioCtx();
let muted = false;
let musicTimer = null;
const musicGain = audioCtx.createGain();
musicGain.gain.value = 0.35;
musicGain.connect(audioCtx.destination);

function playJumpSound() {
  if (muted) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(420, t);
  osc.frequency.exponentialRampToValueAtTime(820, t + 0.12);
  gain.gain.setValueAtTime(0.18, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.2);
}

function playHitSound() {
  if (muted) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.35);
  gain.gain.setValueAtTime(0.22, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.4);
}

// melodía sencilla en loop (notas en Hz), estilo chiptune alegre
const MELODY = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 880, 784, 659, 587, 523];
let melodyStep = 0;

function playMelodyNote() {
  if (muted) return;
  const t = audioCtx.currentTime;
  const freq = MELODY[melodyStep % MELODY.length];
  melodyStep++;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.9, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.connect(gain);
  gain.connect(musicGain);
  osc.start(t);
  osc.stop(t + 0.24);
}

function startMusic() {
  if (musicTimer) return;
  melodyStep = 0;
  playMelodyNote();
  musicTimer = setInterval(playMelodyNote, 220);
}

function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}

muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.textContent = muted ? '🔇' : '🔊';
  if (muted) stopMusic();
  else if (state === 'running') startMusic();
});

const W = canvas.width;
const H = canvas.height;
const GROUND_Y = H - 40;
const GRAVITY = 1700;
const JUMP_VELOCITY = -650;

const BEST_KEY = 'duckrun_best';
let best = Number(localStorage.getItem(BEST_KEY)) || 0;
bestEl.textContent = `Mejor: ${best} m`;

let state = 'idle'; // idle | running | gameover
let speed = 320;
let distance = 0;
let obstacles = [];
let spawnTimer = 0;
let lastTime = 0;
let groundOffset = 0;

const duck = {
  x: 90,
  y: GROUND_Y,
  w: 46,
  h: 40,
  vy: 0,
  grounded: true,
  runPhase: 0,
};

function resetGame() {
  speed = 320;
  distance = 0;
  obstacles = [];
  spawnTimer = 0;
  duck.y = GROUND_Y;
  duck.vy = 0;
  duck.grounded = true;
  duck.runPhase = 0;
}

function jump() {
  if (state === 'idle') {
    startGame();
    return;
  }
  if (state === 'gameover') {
    startGame();
    return;
  }
  if (duck.grounded) {
    duck.vy = JUMP_VELOCITY;
    duck.grounded = false;
    playJumpSound();
  }
}

function startGame() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  resetGame();
  state = 'running';
  overlay.classList.add('hidden');
  lastTime = performance.now();
  startMusic();
  requestAnimationFrame(loop);
}

function endGame() {
  state = 'gameover';
  stopMusic();
  playHitSound();
  const meters = Math.floor(distance);
  if (meters > best) {
    best = meters;
    localStorage.setItem(BEST_KEY, String(best));
  }
  bestEl.textContent = `Mejor: ${best} m`;
  overlay.classList.remove('hidden');
  overlay.querySelector('h1').textContent = 'Game Over';
  overlay.querySelector('p').innerHTML = `Distancia: <b>${meters} m</b>`;
  overlay.querySelector('.small').textContent = 'Pulsa Jugar para intentarlo de nuevo';
  startBtn.textContent = 'Reintentar';
}

function spawnObstacle() {
  const isTall = Math.random() < 0.3;
  const w = isTall ? 26 : 34 + Math.random() * 16;
  const h = isTall ? 60 : 30 + Math.random() * 20;
  obstacles.push({
    x: W + 20,
    y: GROUND_Y - h + 6,
    w,
    h,
  });
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function update(dt) {
  distance += speed * dt * 0.05;
  speed += dt * 6; // gradual acceleration
  groundOffset = (groundOffset + speed * dt) % 40;

  duck.vy += GRAVITY * dt;
  duck.y += duck.vy * dt;
  if (duck.y >= GROUND_Y) {
    duck.y = GROUND_Y;
    duck.vy = 0;
    duck.grounded = true;
  }
  if (duck.grounded) duck.runPhase += dt * 12;

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnObstacle();
    spawnTimer = 0.9 + Math.random() * 0.9 - Math.min(speed / 1200, 0.5);
    if (spawnTimer < 0.45) spawnTimer = 0.45;
  }

  const duckBox = { x: duck.x + 6, y: duck.y - duck.h + 8, w: duck.w - 12, h: duck.h - 10 };

  for (const ob of obstacles) {
    ob.x -= speed * dt;
    if (rectsOverlap(duckBox, ob)) {
      endGame();
      return;
    }
  }
  obstacles = obstacles.filter((ob) => ob.x + ob.w > -20);

  scoreEl.textContent = `${Math.floor(distance)} m`;
}

function drawGround() {
  const dirtTop = GROUND_Y + 6;

  // tierra con franja de textura
  const dirtGrad = ctx.createLinearGradient(0, dirtTop, 0, H);
  dirtGrad.addColorStop(0, '#a9804f');
  dirtGrad.addColorStop(1, '#8a6740');
  ctx.fillStyle = dirtGrad;
  ctx.fillRect(0, dirtTop, W, H - dirtTop);

  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let x = -groundOffset; x < W; x += 26) {
    ctx.beginPath();
    ctx.ellipse(x + 10, dirtTop + 14, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // capa de césped
  const grassGrad = ctx.createLinearGradient(0, dirtTop - 14, 0, dirtTop + 4);
  grassGrad.addColorStop(0, '#9be08a');
  grassGrad.addColorStop(1, '#6fb35f');
  ctx.fillStyle = grassGrad;
  ctx.fillRect(0, dirtTop - 6, W, 10);

  // hierba puntiaguda individual
  ctx.strokeStyle = '#5a9a4c';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let x = -groundOffset; x < W + 20; x += 9) {
    const seed = (x * 13) % 7;
    const h = 5 + (seed % 4);
    const lean = (seed % 2 === 0 ? 1 : -1) * 2;
    ctx.beginPath();
    ctx.moveTo(x, dirtTop + 1);
    ctx.lineTo(x + lean, dirtTop + 1 - h);
    ctx.stroke();
  }
  // mechones más claros encima
  ctx.strokeStyle = '#bdf0a8';
  ctx.lineWidth = 1.4;
  for (let x = -groundOffset + 4; x < W + 20; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, dirtTop);
    ctx.lineTo(x + 1, dirtTop - 7);
    ctx.stroke();
  }
}

function drawObstacle(ob) {
  if (ob.h > 45) {
    // poste de madera alto
    const grad = ctx.createLinearGradient(ob.x, ob.y, ob.x + ob.w, ob.y);
    grad.addColorStop(0, '#7a5536');
    grad.addColorStop(0.5, '#946941');
    grad.addColorStop(1, '#6b4a2f');
    ctx.fillStyle = grad;
    ctx.fillRect(ob.x, ob.y, ob.w, ob.h);

    // vetas horizontales
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1.5;
    for (let yy = ob.y + 6; yy < ob.y + ob.h; yy += 8) {
      ctx.beginPath();
      ctx.moveTo(ob.x + 2, yy);
      ctx.lineTo(ob.x + ob.w - 2, yy + 1);
      ctx.stroke();
    }
    // tapa superior
    ctx.fillStyle = '#5a3c24';
    ctx.fillRect(ob.x - 2, ob.y, ob.w + 4, 6);
    ctx.fillStyle = '#412a18';
    ctx.fillRect(ob.x - 2, ob.y + 4, ob.w + 4, 2);
  } else {
    // tronco caído
    const grad = ctx.createLinearGradient(ob.x, ob.y, ob.x, ob.y + ob.h);
    grad.addColorStop(0, '#8a6240');
    grad.addColorStop(1, '#5e4128');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(ob.x + 4, ob.y);
    ctx.lineTo(ob.x + ob.w - 4, ob.y);
    ctx.quadraticCurveTo(ob.x + ob.w, ob.y, ob.x + ob.w, ob.y + 6);
    ctx.lineTo(ob.x + ob.w, ob.y + ob.h);
    ctx.lineTo(ob.x, ob.y + ob.h);
    ctx.lineTo(ob.x, ob.y + 6);
    ctx.quadraticCurveTo(ob.x, ob.y, ob.x + 4, ob.y);
    ctx.closePath();
    ctx.fill();

    // anillos en la punta (corte del tronco)
    ctx.save();
    ctx.translate(ob.x + ob.w - 6, ob.y + ob.h / 2);
    ctx.fillStyle = '#caa06b';
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, ob.h / 2 - 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a87a45';
    ctx.lineWidth = 1.2;
    for (let r = 2; r < ob.h / 2 - 2; r += 3) {
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(1, 6 - r * 0.5), r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // textura de corteza
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1.2;
    for (let xx = ob.x + 6; xx < ob.x + ob.w - 10; xx += 7) {
      ctx.beginPath();
      ctx.moveTo(xx, ob.y + 2);
      ctx.lineTo(xx, ob.y + ob.h - 2);
      ctx.stroke();
    }
  }
}

function drawDuck() {
  const x = duck.x;
  const y = duck.y;
  const bob = duck.grounded ? Math.sin(duck.runPhase) * 3 : 0;
  const wingFlap = duck.grounded ? Math.sin(duck.runPhase * 1.5) : Math.sin(performance.now() / 60);

  ctx.save();
  ctx.translate(x, y - duck.h / 2 + bob);

  // sombra de contacto con el suelo
  const groundDist = Math.max(0, GROUND_Y - (y - bob));
  ctx.save();
  ctx.globalAlpha = Math.max(0.08, 0.32 - groundDist / 300);
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.ellipse(0, duck.h / 2 + (GROUND_Y - y) + 2, duck.w / 2.6, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // patas
  const legSwing = duck.grounded ? Math.sin(duck.runPhase) * 9 : -4;
  ctx.strokeStyle = '#e08b1d';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-5 + legSwing * 0.4, duck.h / 2 - 6);
  ctx.lineTo(-7 + legSwing, duck.h / 2 + 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(7 - legSwing * 0.4, duck.h / 2 - 6);
  ctx.lineTo(9 - legSwing, duck.h / 2 + 8);
  ctx.stroke();
  // patas (palmeadas)
  ctx.fillStyle = '#f5a623';
  ctx.beginPath();
  ctx.ellipse(-7 + legSwing, duck.h / 2 + 9, 6, 3, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(9 - legSwing, duck.h / 2 + 9, 6, 3, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // cola
  ctx.fillStyle = '#f3f3f3';
  ctx.beginPath();
  ctx.moveTo(-duck.w / 2.4, 2);
  ctx.quadraticCurveTo(-duck.w / 1.5, -2, -duck.w / 1.7, 8);
  ctx.quadraticCurveTo(-duck.w / 1.9, 4, -duck.w / 2.4, 6);
  ctx.closePath();
  ctx.fill();

  // cuerpo (degradado para dar volumen)
  const bodyGrad = ctx.createRadialGradient(-4, -6, 4, 0, 0, duck.w / 1.6);
  bodyGrad.addColorStop(0, '#ffffff');
  bodyGrad.addColorStop(1, '#e9e9e9');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, duck.w / 2.3, duck.h / 2.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // ala (con leve aleteo)
  ctx.save();
  ctx.translate(-3, 1);
  ctx.rotate(0.25 + wingFlap * 0.15);
  ctx.fillStyle = '#dcdcdc';
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c7c7c7';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(8, 0);
  ctx.stroke();
  ctx.restore();

  // pecho con sombreado sutil
  ctx.fillStyle = 'rgba(220,220,220,0.4)';
  ctx.beginPath();
  ctx.ellipse(2, duck.h / 4, duck.w / 4, duck.h / 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // cabeza
  const headX = duck.w / 2.6;
  const headY = -duck.h / 2.4;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(headX, headY, 12, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // mechón en la cabeza
  ctx.strokeStyle = '#dcdcdc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(headX - 2, headY - 11);
  ctx.lineTo(headX, headY - 16);
  ctx.stroke();

  // pico
  ctx.fillStyle = '#f5a623';
  ctx.beginPath();
  ctx.moveTo(headX + 8, headY - 1);
  ctx.lineTo(headX + 22, headY + 1);
  ctx.lineTo(headX + 8, headY + 7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d68a14';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(headX + 9, headY + 1);
  ctx.lineTo(headX + 17, headY + 2);
  ctx.stroke();
  // fosa nasal
  ctx.fillStyle = '#a8650f';
  ctx.beginPath();
  ctx.arc(headX + 12, headY, 1, 0, Math.PI * 2);
  ctx.fill();

  // ojo con brillo
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.arc(headX + 3, headY - 3, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(headX + 2.2, headY - 3.8, 0.9, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawGround();
  for (const ob of obstacles) drawObstacle(ob);
  drawDuck();
}

function loop(now) {
  if (state !== 'running') return;
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    jump();
  }
});
canvas.addEventListener('pointerdown', jump);
startBtn.addEventListener('click', startGame);

draw();
