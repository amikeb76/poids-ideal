const timerEl = document.querySelector("#timer");
const phaseBadgeEl = document.querySelector("#phase-badge");
const phaseLabelEl = document.querySelector("#phase-label");
const roundCountEl = document.querySelector("#round-count");
const totalTimeEl = document.querySelector("#total-time");
const progressBarEl = document.querySelector("#progress-bar");
const startPauseButton = document.querySelector("#start-pause");
const resetButton = document.querySelector("#reset");
const soundToggle = document.querySelector("#sound-toggle");
const fullscreenToggle = document.querySelector("#fullscreen-toggle");
const wakeStatusEl = document.querySelector("#wake-status");
const settingsForm = document.querySelector("#settings-form");
const presetButtons = document.querySelectorAll(".preset");

let audioContext;
let bellBuffer = null;
let bellBufferPromise = null;
let activeBellSources = [];
let wakeLock = null;
let soundEnabled = false;
let running = false;
let intervalId = null;
let phase = "prep";
let round = 1;
let remaining = 10;
let phaseTotal = 10;

const labels = {
  prep: "Preparation",
  work: "Travail",
  rest: "Repos",
  done: "Termine",
  ready: "Pret",
};

function getSettings() {
  return {
    prep: clamp(Number(document.querySelector("#prep").value), 0, 300),
    work: clamp(Number(document.querySelector("#work").value), 5, 900),
    rest: clamp(Number(document.querySelector("#rest").value), 0, 600),
    rounds: clamp(Number(document.querySelector("#rounds").value), 1, 99),
  };
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function setInputsDisabled(disabled) {
  settingsForm.querySelectorAll("input").forEach((input) => {
    input.disabled = disabled;
  });
  presetButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) {
    wakeStatusEl.textContent = "Anti-veille non disponible sur ce navigateur.";
    wakeStatusEl.classList.remove("active");
    return;
  }

  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeStatusEl.textContent = "Ecran garde actif pendant le timer.";
    wakeStatusEl.classList.add("active");
    wakeLock.addEventListener("release", () => {
      wakeStatusEl.textContent = running
        ? "Anti-veille interrompu, touche l'ecran pour le reactiver."
        : "Ecran actif pendant le timer si le telephone le permet.";
      wakeStatusEl.classList.remove("active");
    });
  } catch {
    wakeStatusEl.textContent = "Anti-veille bloque par le navigateur.";
    wakeStatusEl.classList.remove("active");
  }
}

async function releaseWakeLock() {
  if (wakeLock) {
    await wakeLock.release().catch(() => {});
    wakeLock = null;
  }

  wakeStatusEl.textContent = "Ecran actif pendant le timer si le telephone le permet.";
  wakeStatusEl.classList.remove("active");
}

function getAudioContext() {
  audioContext ||= new AudioContext();
  return audioContext;
}

function loadBellBuffer() {
  if (bellBuffer) {
    return Promise.resolve(bellBuffer);
  }

  bellBufferPromise ||= fetch("./assets/boxing-bell.wav")
    .then((response) => response.arrayBuffer())
    .then((arrayBuffer) => getAudioContext().decodeAudioData(arrayBuffer))
    .then((buffer) => {
      bellBuffer = buffer;
      return buffer;
    });

  return bellBufferPromise;
}

function stopActiveBells() {
  activeBellSources.forEach((source) => {
    try {
      source.stop();
    } catch {}
  });
  activeBellSources = [];
}

function playBellAudio(volume = 1, durationSeconds = 0.14, delaySeconds = 0) {
  if (!soundEnabled) {
    return;
  }

  if (!bellBuffer) {
    loadBellBuffer()
      .then(() => playBellAudio(volume, durationSeconds))
      .catch(() => playSyntheticBell(volume));
    return;
  }

  const context = getAudioContext();
  const source = context.createBufferSource();
  const gain = context.createGain();
  const startAt = context.currentTime + delaySeconds;
  const stopAt = startAt + durationSeconds;

  source.buffer = bellBuffer;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.min(1, Math.max(0, volume)), startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
  source.connect(gain);
  gain.connect(context.destination);
  source.addEventListener("ended", () => {
    activeBellSources = activeBellSources.filter((item) => item !== source);
  });
  activeBellSources.push(source);
  source.start(startAt, 0, durationSeconds);
  source.stop(stopAt + 0.02);
}

function playSyntheticBell(strength = 1) {
  if (!soundEnabled) {
    return;
  }

  audioContext ||= new AudioContext();
  const now = audioContext.currentTime;
  const masterGain = audioContext.createGain();
  const duration = 1.55;
  const partials = [
    { frequency: 520, gain: 0.42, type: "triangle" },
    { frequency: 810, gain: 0.28, type: "sine" },
    { frequency: 1215, gain: 0.18, type: "sine" },
    { frequency: 1680, gain: 0.11, type: "square" },
    { frequency: 2240, gain: 0.06, type: "sine" },
  ];

  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.exponentialRampToValueAtTime(0.58 * strength, now + 0.01);
  masterGain.gain.exponentialRampToValueAtTime(0.24 * strength, now + 0.12);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  masterGain.connect(audioContext.destination);

  partials.forEach((partial, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = partial.type;
    oscillator.frequency.setValueAtTime(partial.frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(partial.frequency * (index === 0 ? 0.975 : 0.99), now + duration);
    gain.gain.setValueAtTime(partial.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start(now);
    oscillator.stop(now + duration);
  });
}

function playCountdownBell() {
  stopActiveBells();
  playBellAudio(0.9, 0.14);
}

function playRoundBell() {
  stopActiveBells();
  playBellAudio(1, 0.14);
  playBellAudio(1, 0.14, 0.2);
}

function playEndBell() {
  stopActiveBells();
  playBellAudio(1, 0.14);
  playBellAudio(1, 0.14, 0.2);
}

function announcePhase(nextPhase) {
  if (nextPhase === "work" || nextPhase === "rest") {
    playRoundBell();
  } else if (nextPhase === "done") {
    playEndBell();
  } else if (remaining <= 3 && remaining > 0) {
    playCountdownBell();
  }
}

function setPhase(nextPhase, totalSeconds) {
  phase = nextPhase;
  phaseTotal = totalSeconds;
  remaining = totalSeconds;
  announcePhase(nextPhase);
  render();
}

function startSession() {
  const settings = getSettings();
  round = 1;

  if (settings.prep > 0) {
    setPhase("prep", settings.prep);
  } else {
    setPhase("work", settings.work);
  }

  running = true;
  requestWakeLock();
  setInputsDisabled(true);
  startPauseButton.textContent = "Pause";
  startPauseButton.classList.add("running");
  intervalId = window.setInterval(tick, 1000);
  render();
}

function pauseSession() {
  running = false;
  window.clearInterval(intervalId);
  releaseWakeLock();
  startPauseButton.textContent = "Reprendre";
  startPauseButton.classList.remove("running");
  render();
}

function resumeSession() {
  running = true;
  requestWakeLock();
  startPauseButton.textContent = "Pause";
  startPauseButton.classList.add("running");
  intervalId = window.setInterval(tick, 1000);
  render();
}

function resetSession() {
  running = false;
  window.clearInterval(intervalId);
  releaseWakeLock();
  intervalId = null;
  phase = "ready";
  round = 0;
  const settings = getSettings();
  phaseTotal = settings.prep || settings.work;
  remaining = phaseTotal;
  setInputsDisabled(false);
  startPauseButton.textContent = "Demarrer";
  startPauseButton.classList.remove("running");
  render();
}

function finishSession() {
  running = false;
  window.clearInterval(intervalId);
  releaseWakeLock();
  intervalId = null;
  phase = "done";
  remaining = 0;
  setInputsDisabled(false);
  startPauseButton.textContent = "Recommencer";
  startPauseButton.classList.remove("running");
  announcePhase("done");
  render();
}

function tick() {
  if (!running) {
    return;
  }

  remaining -= 1;

  if (remaining > 0) {
    if (remaining <= 3) {
      announcePhase(phase);
    }
    render();
    return;
  }

  const settings = getSettings();

  if (phase === "prep") {
    setPhase("work", settings.work);
    return;
  }

  if (phase === "work") {
    if (settings.rest > 0) {
      setPhase("rest", settings.rest);
      return;
    }

    if (round < settings.rounds) {
      round += 1;
      setPhase("work", settings.work);
      return;
    }

    finishSession();
    return;
  }

  if (phase === "rest") {
    if (round < settings.rounds) {
      round += 1;
      setPhase("work", settings.work);
      return;
    }

    finishSession();
  }
}

function render() {
  const settings = getSettings();
  const displayPhase = phase === "ready" ? "prep" : phase;
  const progress = phaseTotal > 0 ? remaining / phaseTotal : 0;
  const totalSeconds = settings.prep + settings.rounds * settings.work + Math.max(0, settings.rounds - 1) * settings.rest;

  timerEl.textContent = formatTime(Math.max(0, remaining));
  phaseBadgeEl.textContent = labels[phase] || labels.ready;
  phaseBadgeEl.className = `phase-badge ${phase}`;
  phaseLabelEl.textContent = labels[displayPhase];
  roundCountEl.textContent = `${round} / ${settings.rounds}`;
  totalTimeEl.textContent = formatTime(totalSeconds);
  progressBarEl.style.transform = `scaleX(${Math.max(0, progress)})`;
  progressBarEl.style.background = `var(--${displayPhase})`;

  document.body.className = phase === "work" ? "phase-work" : phase === "rest" ? "phase-rest" : phase === "done" ? "phase-done" : "";
}

startPauseButton.addEventListener("click", async () => {
  if (soundEnabled && audioContext?.state === "suspended") {
    await audioContext.resume();
  }

  if (phase === "done") {
    resetSession();
    startSession();
    return;
  }

  if (!intervalId && !running) {
    startSession();
    return;
  }

  if (running) {
    pauseSession();
  } else {
    resumeSession();
  }
});

resetButton.addEventListener("click", resetSession);

fullscreenToggle.addEventListener("click", async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    await document.exitFullscreen?.().catch(() => {});
  }
});

document.addEventListener("fullscreenchange", () => {
  const full = Boolean(document.fullscreenElement);
  fullscreenToggle.textContent = full ? "Quitter" : "Plein";
  fullscreenToggle.classList.toggle("active", full);
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && running) {
    requestWakeLock();
  }
});

soundToggle.addEventListener("click", async () => {
  soundEnabled = !soundEnabled;
  soundToggle.textContent = soundEnabled ? "Son ON" : "Son";

  if (soundEnabled) {
    await getAudioContext().resume();
    await loadBellBuffer().catch(() => {});
    stopActiveBells();
    playBellAudio(0.75, 0.14);
  }
});

settingsForm.addEventListener("input", () => {
  presetButtons.forEach((button) => button.classList.remove("active"));
  if (!running && !intervalId) {
    resetSession();
  }
});

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector("#prep").value = button.dataset.prep;
    document.querySelector("#work").value = button.dataset.work;
    document.querySelector("#rest").value = button.dataset.rest;
    document.querySelector("#rounds").value = button.dataset.rounds;
    presetButtons.forEach((item) => item.classList.toggle("active", item === button));
    resetSession();
  });
});

resetSession();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("../sw.js").catch(() => {});
}
