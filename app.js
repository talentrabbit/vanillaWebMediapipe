import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

const videoElement = document.querySelector(".input-video");
const handCanvas = document.querySelector(".output-canvas");
const handCanvasCtx = handCanvas.getContext("2d");
const sceneCanvas = document.querySelector("#sceneCanvas");
const stagePanelEl = document.querySelector(".stage-panel");
const cameraCardEl = document.querySelector(".camera-card");
const cameraHeaderEl = document.querySelector(".camera-header");
const sceneCardEl = document.querySelector(".scene-card");
const toggleCaptureButton = document.querySelector("#toggleCaptureButton");
const toggleSceneFullscreenButton = document.querySelector("#toggleSceneFullscreen");
const gestureValueEl = document.querySelector("#gestureValue");
const gestureHintEl = document.querySelector("#gestureHint");
const ribbonStatusEl = document.querySelector("#ribbonStatus");
const trackingStateEl = document.querySelector("#trackingState");
const fullscreenTrackingStateEl = document.querySelector("#fullscreenTrackingState");
const cameraSelectEl = document.querySelector("#cameraSelect");
const handRecognitionStateEl = document.querySelector("#handRecognitionState");
const CAMERA_DEVICE_ID_KEY = "gestureParticles.cameraDeviceId.v1";
const trainerHintEl = document.querySelector("#trainerHint");
const gestureTrainerGridEl = document.querySelector("#gestureTrainerGrid");
const trainerPanelBodyEl = document.querySelector("#trainerPanelBody");
const toggleTrainerPanelButton = document.querySelector("#toggleTrainerPanel");
const exportCustomGesturesButton = document.querySelector("#exportCustomGestures");
const importCustomGesturesButton = document.querySelector("#importCustomGestures");
const importCustomGesturesInput = document.querySelector("#importCustomGesturesInput");
const resetCustomGesturesButton = document.querySelector("#resetCustomGestures");
const ribbonHintEl = document.querySelector("#ribbonHint");
const ribbonGestureCountEl = document.querySelector("#ribbonGestureCount");
const saveRibbonGestureButton = document.querySelector("#saveRibbonGesture");
const clearRibbonGestureButton = document.querySelector("#clearRibbonGesture");
const triggerRibbonEffectButton = document.querySelector("#triggerRibbonEffectButton");
const triggerFireworksEffectButton = document.querySelector("#triggerFireworksEffectButton");
const specialEffectTypeEl = document.querySelector("#specialEffectType");
const specialEffectHoldSecondsEl = document.querySelector("#specialEffectHoldSeconds");
const specialEffectMatchWindowSecondsEl = document.querySelector("#specialEffectMatchWindowSeconds");
const ribbonProtectionSecondsEl = document.querySelector("#ribbonProtectionSeconds");
const digitHoldSecondsEl = document.querySelector("#digitHoldSeconds");
const handSizePercentEl = document.querySelector("#handSizePercent");

const DIGIT_COLORS = [
  ["#7cf5c0", "#3f8cff"],
  ["#ffbc7d", "#ff7b7b"],
  ["#7de7ff", "#4b7dff"],
  ["#ffd86b", "#ff9d4d"], 
  ["#f58aff", "#7a7bff"],
  ["#7cf5c0", "#ffbc7d"],
  ["#88f7e2", "#3f8cff"],
  ["#ffb58e", "#ff6d8f"],
  ["#99c6ff", "#56f3cf"],
  ["#ffe08f", "#ff8a58"]
];

const SPECIAL_DIGIT_EFFECTS = {
  3: { kind: "word", label: "Mission", scale: 5.8 },
  2: { kind: "word", label: "First", scale: 5.6 },
  1: { kind: "word", label: "Delivery", scale: 5.4 },
  0: { kind: "word", label: "Cheers", scale: 4.8, fireworks: true }
};

const CUSTOM_DIGIT_FOLDER = "./assets/custom-png";
const CUSTOM_GESTURES_STORAGE_KEY = "gestureParticles.customGestures.v1";
const RIBBON_GESTURES_STORAGE_KEY = "gestureParticles.ribbonGestures.v1";
const RIBBON_CONFIG_STORAGE_KEY = "gestureParticles.ribbonConfig.v1";
const DIGIT_CONFIG_STORAGE_KEY = "gestureParticles.digitConfig.v1";
const PRELOADED_GESTURES_URL = "./assets/gesture-samples.json";
const GESTURE_CHANGE_SOUND_URL = "./assets/audio/gesture-change.wav";
const FIREWORKS_SOUND_URL = "./assets/audio/fireworks.wav";
const RIBBON_CUT_SOUND_URL = "./assets/audio/ribboncut.wav";
const SPECIAL_EFFECT_MATCH_THRESHOLD = 0.2;
const NO_DIGIT_CLEAR_DELAY_MS = 3000;

if (typeof window !== "undefined") {
  window.SOUND_ENABLED = typeof window.SOUND_ENABLED === "boolean" ? window.SOUND_ENABLED : false;

  window.maxNumHands = Number.isInteger(window.maxNumHands) ? window.maxNumHands : 1;
  window.particleLevel = ["low", "medium", "high"].includes(String(window.particleLevel).toLowerCase()) ? String(window.particleLevel).toLowerCase() : "medium";
  window.minHandSizeThreshold = Number.isFinite(window.minHandSizeThreshold) ? Math.max(0.01, Math.min(1, Number(window.minHandSizeThreshold))) : 0.10;
  window.PARTICLE_LEVEL_COUNTS = {
    low: 1100,
    medium: 2200,
    high: 4400
  };

  window.getParticleCount = function getParticleCount() {
    return window.PARTICLE_LEVEL_COUNTS[window.particleLevel] || 2200;
  };

  window.setMaxNumHands = function setMaxNumHands(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) {
      console.warn("setMaxNumHands expects an integer between 1 and 4.");
      return;
    }
    window.maxNumHands = parsed;
    if (typeof window.updateHandTrackingOptions === "function") {
      window.updateHandTrackingOptions();
    }
    console.info("maxNumHands set to", parsed);
  };

  window.setParticleLevel = function setParticleLevel(level) {
    const normalized = String(level).toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(window.PARTICLE_LEVEL_COUNTS, normalized)) {
      console.warn("setParticleLevel expects one of: low, medium, high.");
      return;
    }
    window.particleLevel = normalized;
    if (typeof window.applyParticleLevelSetting === "function") {
      window.applyParticleLevelSetting();
    }
    console.info("particleLevel set to", normalized, "(", window.getParticleCount(), "particles)");
  };

  window.setSoundEnabled = function setSoundEnabled(value) {
    window.SOUND_ENABLED = Boolean(value);
    console.info("SOUND_ENABLED set to", window.SOUND_ENABLED);
  };

  window.setMinHandSizeThreshold = function setMinHandSizeThreshold(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
      console.warn("setMinHandSizeThreshold expects a value between 0 and 1 (for example 0.1 for 10%).");
      return;
    }
    window.minHandSizeThreshold = parsed;
    console.info("minHandSizeThreshold set to", parsed);
  };
}
const DEFAULT_RIBBON_CONFIG = {
  effectType: "ribbon",
  holdSeconds: 2,
  matchWindowSeconds: 1,
  protectionSeconds: 1.5
};
const DEFAULT_DIGIT_CONFIG = {
  holdSeconds: 0.10
};
const textureLoader = new THREE.TextureLoader();
const digitTextures = new Map();
const customDigitChecks = new Map();
const trainerSlotElements = new Map();
let currentDigit = null;
let pendingDigit = null;
let pendingFrames = 0;
let pendingSince = 0;
let lastLandmarkTime = 0;
let activeStream = null;
let isProcessingFrame = false;
let animationFrameId = 0;
let cameraState = "idle";
let latestGestureVector = null;
let isTrainerPanelCollapsed = false;
let lastDigitRecognizedAt = performance.now();
let sceneClearedForNoDigit = false;
let customGestureLibrary = loadStoredGestureLibrary();
let ribbonGestureLibrary = loadStoredRibbonGestureLibrary();
let ribbonConfig = loadStoredRibbonConfig();
let digitConfig = loadStoredDigitConfig();
let ribbonPendingMatchSince = 0;
let ribbonPendingLastMatchedAt = 0;
let ribbonTriggeredCurrentHold = false;
let ribbonLastTriggerTime = 0;
let ribbonEffectProtectionUntil = 0;
let ribbonStatusResetTimer = 0;
let isDraggingFloatingCamera = false;
let isFloatingCameraVisible = true;
let floatingCameraOffset = { x: 0, y: 0 };
let floatingCameraPosition = { x: 24, y: 24 };
const gestureChangeSound = new Audio(GESTURE_CHANGE_SOUND_URL);
const fireworksSound = new Audio(FIREWORKS_SOUND_URL);
const ribbonCutSound = new Audio(RIBBON_CUT_SOUND_URL);

gestureChangeSound.preload = "auto";
fireworksSound.preload = "auto";
ribbonCutSound.preload = "auto";

gestureChangeSound.volume = 0.72;
fireworksSound.volume = 0.85;
ribbonCutSound.volume = 0.85;

// Prefer Web Audio for short repeated digit sounds (more reliable than cloning DOM Audio nodes)
let audioCtx = null;
let gestureChangeBuffer = null;

async function initGestureAudioBuffer() {
  if (gestureChangeBuffer || !window.fetch) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const resp = await fetch(GESTURE_CHANGE_SOUND_URL, { cache: 'force-cache' });
    const arrayBuffer = await resp.arrayBuffer();
    gestureChangeBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (e) {
    // leave gestureChangeBuffer null to use fallback
    gestureChangeBuffer = null;
  }
}

function primeGestureChangeSound() {
  // warm up both DOM audio and WebAudio buffer
  gestureChangeSound.load();
  fireworksSound.load();
  ribbonCutSound.load();
  initGestureAudioBuffer().catch(() => {});
}

function playGestureChangeSound(digit) {
  if (typeof window !== "undefined" && !window.SOUND_ENABLED) {
    return;
  }

  if (digit == 0) {
    playSpecialEffectSound(ribbonConfig.effectType);
    return;
  }

  // Use Web AudioBuffer if available
  if (gestureChangeBuffer && audioCtx) {
    try {
      const src = audioCtx.createBufferSource();
      src.buffer = gestureChangeBuffer;
      const gain = audioCtx.createGain();
      gain.gain.value = Math.max(0, Math.min(1, 0.6 + digit * 0.018));
      src.connect(gain).connect(audioCtx.destination);
      src.start();
      src.onended = () => {
        try { src.disconnect(); gain.disconnect(); } catch (e) {}
      };
      return;
    } catch (e) {
      // fall through to DOM audio fallback
    }
  }

  // Fallback: reuse the preloaded Audio element instead of cloning.
  try {
    gestureChangeSound.currentTime = 0;
    gestureChangeSound.volume = Math.max(0, Math.min(1, 0.6 + digit * 0.018));
    gestureChangeSound.play().catch(() => {});
  } catch (e) {
    // Ignore playback failure
  }
}

function playSpecialEffectSound(effectType) {
  if (typeof window !== "undefined" && !window.SOUND_ENABLED) {
    return;
  }

  const source = effectType === "fireworks" ? fireworksSound : ribbonCutSound;
  try {
    source.currentTime = 0;
    source.volume = 0.9;
    source.play().catch(() => {});
  } catch (e) {
    // Ignore playback failure
  }
}

function updateRibbonStatus(text, isActive = false) {
  ribbonStatusEl.textContent = text;
  ribbonStatusEl.classList.toggle("is-active", isActive);
}

function setTrackingState(text) {
  trackingStateEl.textContent = text;
  if (fullscreenTrackingStateEl) {
    fullscreenTrackingStateEl.textContent = text;
  }
}

function updateHandRecognitionState(labels = []) {
  if (!handRecognitionStateEl) {
    return;
  }

  if ((window.maxNumHands || 1) <= 1) {
    handRecognitionStateEl.hidden = true;
    handRecognitionStateEl.textContent = "";
    return;
  }

  const states = [];
  for (let index = 0; index < window.maxNumHands; index += 1) {
    states.push(`Hand${index + 1}: ${labels[index] ?? "--"}`);
  }

  handRecognitionStateEl.hidden = false;
  handRecognitionStateEl.textContent = states.join("  ");
}

function getMinHandSizeThreshold() {
  if (typeof window === "undefined") {
    return 0.10;
  }

  const threshold = Number(window.minHandSizeThreshold);
  return Number.isFinite(threshold) && threshold > 0 ? threshold : 0.10;
}

function queueRibbonStatusReset(delayMs = 1400) {
  if (ribbonStatusResetTimer) {
    window.clearTimeout(ribbonStatusResetTimer);
  }

  ribbonStatusResetTimer = window.setTimeout(() => {
    ribbonStatusResetTimer = 0;
    updateRibbonStatus(getSpecialEffectReadyStateText(), false);
  }, delayMs);
}

function getSelectedSpecialEffectLabel() {
  return ribbonConfig.effectType === "fireworks" ? "Fireworks" : "Ribbon Cutting";
}

function getSpecialEffectReadyStateText() {
  return ribbonGestureLibrary.length ? "Ready" : "Not ready";
}

function updateCaptureButton() {
  if (cameraState === "requesting") {
    toggleCaptureButton.textContent = "Starting...";
    toggleCaptureButton.disabled = true;
    return;
  }

  toggleCaptureButton.disabled = false;
  toggleCaptureButton.textContent = cameraState === "live" ? "Stop capture" : "Start capture";
}

function stopCamera(options = {}) {
  const { preserveHint = false } = options;

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
  }

  if (activeStream) {
    for (const track of activeStream.getTracks()) {
      track.stop();
    }
    activeStream = null;
  }

  isProcessingFrame = false;
  latestGestureVector = null;
  ribbonPendingMatchSince = 0;
  ribbonPendingLastMatchedAt = 0;
  ribbonTriggeredCurrentHold = false;
  pendingDigit = null;
  pendingFrames = 0;
  pendingSince = 0;
  ribbonEffectProtectionUntil = 0;
  lastLandmarkTime = 0;
  videoElement.pause();
  videoElement.srcObject = null;
  handCanvasCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
  updateHandRecognitionState([]);
  cameraState = "stopped";
  handSizePercentEl.textContent = "Hand size: --";
  updateRibbonStatus("Idle", false);
  setTrackingState("Capture stopped");
  if (!preserveHint) {
    gestureHintEl.textContent = "Capture stopped. Start the camera to continue gesture tracking.";
  }
  updateCaptureButton();
}

async function toggleCapture() {
  primeGestureChangeSound();
  if (cameraState === "requesting") {
    return;
  }

  if (cameraState === "live") {
    stopCamera();
    return;
  }

  await startCamera();
}

function createEmptyGestureLibrary() {
  return Object.fromEntries(Array.from({ length: 10 }, (_, digit) => [String(digit), []]));
}

function normalizeGestureLibrary(candidate) {
  const normalized = createEmptyGestureLibrary();

  for (let digit = 0; digit <= 9; digit += 1) {
    const key = String(digit);
    const samples = Array.isArray(candidate?.[key]) ? candidate[key] : [];
    normalized[key] = samples.filter((sample) => Array.isArray(sample) && sample.length === 63);
  }

  return normalized;
}

function loadStoredGestureLibrary() {
  try {
    const stored = window.localStorage.getItem(CUSTOM_GESTURES_STORAGE_KEY);
    if (!stored) {
      return createEmptyGestureLibrary();
    }

    return normalizeGestureLibrary(JSON.parse(stored));
  } catch {
    return createEmptyGestureLibrary();
  }
}

function createEmptyRibbonGestureLibrary() {
  return [];
}

function normalizeRibbonGestureLibrary(candidate) {
  if (Array.isArray(candidate)) {
    return candidate.filter((sample) => Array.isArray(sample) && sample.length === 63);
  }

  if (Array.isArray(candidate?.samples)) {
    return candidate.samples.filter((sample) => Array.isArray(sample) && sample.length === 63);
  }

  if (Array.isArray(candidate?.A)) {
    return candidate.A.filter((sample) => Array.isArray(sample) && sample.length === 63);
  }

  return [];
}

function loadStoredRibbonGestureLibrary() {
  try {
    const raw = window.localStorage.getItem(RIBBON_GESTURES_STORAGE_KEY);
    if (!raw) {
      return createEmptyRibbonGestureLibrary();
    }
    return normalizeRibbonGestureLibrary(JSON.parse(raw));
  } catch {
    return createEmptyRibbonGestureLibrary();
  }
}

function persistRibbonGestureLibrary() {
  window.localStorage.setItem(RIBBON_GESTURES_STORAGE_KEY, JSON.stringify(ribbonGestureLibrary));
}

function normalizeRibbonConfig(candidate) {
  const effectType = candidate?.effectType === "fireworks" ? "fireworks" : DEFAULT_RIBBON_CONFIG.effectType;
  const holdSeconds = THREE.MathUtils.clamp(Number(candidate?.holdSeconds) || DEFAULT_RIBBON_CONFIG.holdSeconds, 0.05, 5);
  const matchWindowSeconds = THREE.MathUtils.clamp(Number(candidate?.matchWindowSeconds) || DEFAULT_RIBBON_CONFIG.matchWindowSeconds, 0.1, 5);
  const protectionSeconds = THREE.MathUtils.clamp(Number(candidate?.protectionSeconds) || DEFAULT_RIBBON_CONFIG.protectionSeconds, 0.2, 5);
  return { effectType, holdSeconds, matchWindowSeconds, protectionSeconds };
}

function loadStoredRibbonConfig() {
  try {
    const raw = window.localStorage.getItem(RIBBON_CONFIG_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_RIBBON_CONFIG };
    }
    return normalizeRibbonConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_RIBBON_CONFIG };
  }
}

function normalizeDigitConfig(candidate) {
  const holdSeconds = THREE.MathUtils.clamp(Number(candidate?.holdSeconds) || DEFAULT_DIGIT_CONFIG.holdSeconds, 0.05, 2);
  return { holdSeconds };
}

function loadStoredDigitConfig() {
  try {
    const raw = window.localStorage.getItem(DIGIT_CONFIG_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_DIGIT_CONFIG };
    }
    return normalizeDigitConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_DIGIT_CONFIG };
  }
}

function persistDigitConfig() {
  window.localStorage.setItem(DIGIT_CONFIG_STORAGE_KEY, JSON.stringify(digitConfig));
}

function persistRibbonConfig() {
  window.localStorage.setItem(RIBBON_CONFIG_STORAGE_KEY, JSON.stringify(ribbonConfig));
}

async function populateCameraList() {
  if (!navigator.mediaDevices || !cameraSelectEl) return;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((d) => d.kind === "videoinput");

    // Clear and repopulate
    cameraSelectEl.innerHTML = "";
    cameras.forEach((cam, i) => {
      const option = document.createElement("option");
      option.value = cam.deviceId;
      option.textContent = cam.label || `Camera ${i + 1}`;
      cameraSelectEl.append(option);
    });

    const saved = window.localStorage.getItem(CAMERA_DEVICE_ID_KEY);
    if (saved && Array.from(cameraSelectEl.options).some((o) => o.value === saved)) {
      cameraSelectEl.value = saved;
    } else if (cameraSelectEl.options.length) {
      cameraSelectEl.selectedIndex = 0;
    }

    cameraSelectEl.style.display = "inline-block";
  } catch {
    // ignore
  }
}

function getSelectedCameraDeviceId() {
  return (cameraSelectEl && cameraSelectEl.value) || window.localStorage.getItem(CAMERA_DEVICE_ID_KEY) || null;
}

function updateRibbonTrainerUi() {
  ribbonGestureCountEl.textContent = ribbonGestureLibrary.length === 1 ? "1 sample" : `${ribbonGestureLibrary.length} samples`;

  specialEffectTypeEl.value = ribbonConfig.effectType;
  specialEffectHoldSecondsEl.value = ribbonConfig.holdSeconds.toFixed(2);
  specialEffectMatchWindowSecondsEl.value = ribbonConfig.matchWindowSeconds.toFixed(1);
  ribbonProtectionSecondsEl.value = ribbonConfig.protectionSeconds.toFixed(1);
  digitHoldSecondsEl.value = digitConfig.holdSeconds.toFixed(2);

  const sampleReady = ribbonGestureLibrary.length > 0;

  if (!sampleReady) {
    ribbonHintEl.textContent = "Save one effect gesture to enable direct special-effect triggering.";
    updateRibbonStatus("Not ready", false);
    return;
  }

  ribbonHintEl.textContent = `Saved effect gesture will trigger ${getSelectedSpecialEffectLabel()}.`;
  updateRibbonStatus(getSpecialEffectReadyStateText(), false);
}

function updateDigitConfigFromInputs() {
  digitConfig = normalizeDigitConfig({ holdSeconds: digitHoldSecondsEl.value });
  persistDigitConfig();
  digitHoldSecondsEl.value = digitConfig.holdSeconds.toFixed(2);
}

function saveRibbonGesture() {
  if (!latestGestureVector || performance.now() - lastLandmarkTime > 600) {
    ribbonHintEl.textContent = "Show a clearly tracked hand before saving the special-effect gesture.";
    return;
  }

  ribbonGestureLibrary.push([...latestGestureVector]);
  persistRibbonGestureLibrary();
  updateRibbonTrainerUi();
  ribbonHintEl.textContent = `Saved current pose as the ${getSelectedSpecialEffectLabel()} trigger gesture.`;
}

function clearRibbonGestures() {
  ribbonGestureLibrary = [];
  persistRibbonGestureLibrary();
  updateRibbonTrainerUi();
}

function updateRibbonConfigFromInputs() {
  ribbonConfig = normalizeRibbonConfig({
    effectType: specialEffectTypeEl.value,
    holdSeconds: specialEffectHoldSecondsEl.value,
    matchWindowSeconds: specialEffectMatchWindowSecondsEl.value,
    protectionSeconds: ribbonProtectionSecondsEl.value
  });

  persistRibbonConfig();
  ribbonPendingMatchSince = 0;
  ribbonPendingLastMatchedAt = 0;
  ribbonTriggeredCurrentHold = false;
  updateRibbonTrainerUi();
}

function getRibbonGestureMatchScore(gestureVector, samples) {
  let best = Number.POSITIVE_INFINITY;
  for (const sample of samples) {
    best = Math.min(best, getGestureDistance(gestureVector, sample));
  }
  return best;
}

function getRibbonGestureMatchCount(gestureVectors) {
  if (!Array.isArray(gestureVectors) || !gestureVectors.length || !ribbonGestureLibrary.length) {
    return 0;
  }

  return gestureVectors.reduce((count, vector) => {
    if (!vector || !Array.isArray(vector) || vector.length !== 63) {
      return count;
    }
    return count + (getRibbonGestureMatchScore(vector, ribbonGestureLibrary) <= SPECIAL_EFFECT_MATCH_THRESHOLD ? 1 : 0);
  }, 0);
}

function isRibbonGestureMatched(gestureVectorOrVectors) {
  if (Array.isArray(gestureVectorOrVectors) && Array.isArray(gestureVectorOrVectors[0])) {
    const validVectors = gestureVectorOrVectors.filter((vector) => Array.isArray(vector) && vector.length === 63);
    if (!validVectors.length) {
      return false;
    }

    const matchCount = getRibbonGestureMatchCount(validVectors);
    return matchCount > Math.floor(validVectors.length / 2);
  }

  if (!gestureVectorOrVectors || !ribbonGestureLibrary.length) {
    return false;
  }

  return getRibbonGestureMatchScore(gestureVectorOrVectors, ribbonGestureLibrary) <= SPECIAL_EFFECT_MATCH_THRESHOLD;
}

function triggerConfiguredSpecialEffect(eventTime) {
  if (eventTime - ribbonLastTriggerTime < 800) {
    return;
  }

  ribbonLastTriggerTime = eventTime;
  ribbonEffectProtectionUntil = eventTime + ribbonConfig.protectionSeconds * 1000;
  ribbonPendingMatchSince = 0;
  ribbonPendingLastMatchedAt = 0;
  ribbonTriggeredCurrentHold = true;
  pendingDigit = null;
  pendingFrames = 0;
  pendingSince = 0;
  currentDigit = null;
  gestureValueEl.textContent = "--";
  gestureHintEl.textContent = "Special effect active.";
  sceneController.activateSpecialEffectOnly(ribbonConfig.protectionSeconds);

  const effectType = ribbonConfig.effectType;
  if (effectType === "fireworks") {
    ribbonHintEl.textContent = "Special-effect gesture matched. Triggered fireworks.";
    updateRibbonStatus("Fireworks", true);
    sceneController.triggerFireworkCelebration();
  } else {
    ribbonHintEl.textContent = "Special-effect gesture matched. Triggered ribbon cutting.";
    updateRibbonStatus("Ribbon Cutting", true);
    sceneController.triggerRibbonCutEffect();
  }

  playSpecialEffectSound(effectType);
  queueRibbonStatusReset();
}

function triggerSpecialEffectShortcut(effectType) {
  ribbonPendingMatchSince = 0;
  ribbonPendingLastMatchedAt = 0;
  ribbonTriggeredCurrentHold = false;
  ribbonEffectProtectionUntil = 0;
  pendingDigit = null;
  pendingFrames = 0;
  pendingSince = 0;
  currentDigit = null;
  gestureValueEl.textContent = "--";
  gestureHintEl.textContent = "Special effect triggered.";
  sceneController.activateSpecialEffectOnly(0);

  if (effectType === "fireworks") {
    ribbonHintEl.textContent = "Shortcut triggered fireworks.";
    updateRibbonStatus("Fireworks", true);
    sceneController.triggerFireworkCelebration();
  } else {
    ribbonHintEl.textContent = "Shortcut triggered ribbon cutting.";
    updateRibbonStatus("Ribbon Cutting", true);
    sceneController.triggerRibbonCutEffect();
  }

  playSpecialEffectSound(effectType);
  queueRibbonStatusReset();
}

function triggerDigitShortcut(digit) {
  if (typeof digit !== "number" || digit < 0 || digit > 9) {
    return;
  }

  ribbonPendingMatchSince = 0;
  ribbonPendingLastMatchedAt = 0;
  ribbonTriggeredCurrentHold = false;
  ribbonEffectProtectionUntil = 0;
  pendingDigit = null;
  pendingFrames = 0;
  pendingSince = 0;
  currentDigit = digit;
  playGestureChangeSound(digit);
  gestureValueEl.textContent = String(digit);
  gestureHintEl.textContent = `Digit ${digit} shortcut triggered.`;
  setTrackingState(`Digit shortcut: ${digit}`);
  const textureEntry = ensureDigitTexture(digit);
  sceneController.setDigitTexture(digit, textureEntry.texture, textureEntry.imageUrl);
}

function hasStoredGestureLibrary() {
  return Boolean(window.localStorage.getItem(CUSTOM_GESTURES_STORAGE_KEY));
}

function persistGestureLibrary() {
  window.localStorage.setItem(CUSTOM_GESTURES_STORAGE_KEY, JSON.stringify(customGestureLibrary));
}

function applyGestureLibrary(candidate, successMessage) {
  customGestureLibrary = normalizeGestureLibrary(candidate);
  persistGestureLibrary();
  renderGestureTrainer();
  if (successMessage) {
    trainerHintEl.textContent = successMessage;
  }
}

async function preloadGestureLibraryFromAssets() {
  if (hasStoredGestureLibrary()) {
    return;
  }

  try {
    const response = await fetch(PRELOADED_GESTURES_URL, { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const parsed = JSON.parse(await response.text());
    const gestures = parsed?.gestures ?? parsed;
    const normalized = normalizeGestureLibrary(gestures);
    const totalSamples = Object.values(normalized).reduce((sum, samples) => sum + samples.length, 0);
    if (!totalSamples) {
      return;
    }

    applyGestureLibrary(normalized, `Loaded ${totalSamples} shared gesture samples from assets/gesture-samples.json.`);
  } catch {
  }
}

function createGestureLibraryFilePayload(includeMetadata = true) {
  const gestures = normalizeGestureLibrary(customGestureLibrary);

  if (!includeMetadata) {
    return {
      version: 1,
      gestures
    };
  }

  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    gestures
  };
}

function downloadJsonFile(fileName, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = downloadUrl;
  downloadLink.download = fileName;
  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(downloadUrl);
}

function exportGestureLibrary() {
  downloadJsonFile("gesture-samples.json", createGestureLibraryFilePayload());
  trainerHintEl.textContent = "Exported gesture samples to gesture-samples.json.";
}

function importGestureLibraryFromText(fileText) {
  const parsed = JSON.parse(fileText);
  const gestures = parsed?.gestures ?? parsed;
  applyGestureLibrary(gestures, "Imported gesture samples from JSON file.");
}

async function handleGestureImport(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  try {
    importGestureLibraryFromText(await file.text());
  } catch {
    trainerHintEl.textContent = "Gesture import failed. Choose a valid gesture-samples.json file.";
  } finally {
    importCustomGesturesInput.value = "";
  }
}

function triggerGestureImport() {
  importCustomGesturesInput.click();
}

function distance2D(pointA, pointB) {
  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
}

function loadImageFromUrl(imageUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load image: ${imageUrl}`));
    image.src = imageUrl;
  });
}

function createWordArtTexture(label, colors) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");

  const background = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, "rgba(6, 14, 26, 0)");
  background.addColorStop(0.5, "rgba(6, 14, 26, 0.2)");
  background.addColorStop(1, "rgba(6, 14, 26, 0)");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 154px Sora, sans-serif";

  const fill = ctx.createLinearGradient(120, 40, 860, 260);
  fill.addColorStop(0, colors[0]);
  fill.addColorStop(0.5, "#ffffff");
  fill.addColorStop(1, colors[1]);

  ctx.lineJoin = "round";
  ctx.lineWidth = 24;
  ctx.strokeStyle = "rgba(8, 17, 31, 0.95)";
  ctx.shadowColor = colors[1];
  ctx.shadowBlur = 46;
  ctx.strokeText(label, canvas.width / 2, canvas.height / 2 + 8);

  ctx.fillStyle = fill;
  ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 8);

  ctx.shadowBlur = 0;
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.strokeText(label, canvas.width / 2, canvas.height / 2 + 8);

  for (let index = 0; index < 14; index += 1) {
    const x = 110 + index * 58;
    const y = 42 + (index % 2) * 14;
    ctx.fillStyle = `rgba(255,255,255,${0.05 + index * 0.008})`;
    ctx.fillRect(x, y, 32, 4);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function getDigitPngName(digit) {
  return `${digit}.png`;
}

function getTextureSourceLabel(digit, label) {
  return label || `generated/${getDigitPngName(digit)}`;
}

function buildGestureVector(landmarks) {
  const wrist = landmarks[0];
  const middleBase = landmarks[9];
  const palmWidthVector = {
    x: landmarks[5].x - landmarks[17].x,
    y: landmarks[5].y - landmarks[17].y
  };
  const palmWidth = Math.hypot(palmWidthVector.x, palmWidthVector.y) || 1;
  const axisX = {
    x: palmWidthVector.x / palmWidth,
    y: palmWidthVector.y / palmWidth
  };
  let axisY = {
    x: -axisX.y,
    y: axisX.x
  };

  const wristToMiddle = {
    x: middleBase.x - wrist.x,
    y: middleBase.y - wrist.y
  };

  if (axisY.x * wristToMiddle.x + axisY.y * wristToMiddle.y < 0) {
    axisY = { x: -axisY.x, y: -axisY.y };
  }

  const scale = Math.max(distance2D(wrist, middleBase), 0.05);
  const vector = [];

  for (const landmark of landmarks) {
    const relativeX = landmark.x - wrist.x;
    const relativeY = landmark.y - wrist.y;
    vector.push((relativeX * axisX.x + relativeY * axisX.y) / scale);
    vector.push((relativeX * axisY.x + relativeY * axisY.y) / scale);
    vector.push((landmark.z - wrist.z) / scale);
  }

  return vector;
}

function getGestureDistance(vectorA, vectorB) {
  let total = 0;
  for (let index = 0; index < vectorA.length; index += 1) {
    total += Math.abs(vectorA[index] - vectorB[index]);
  }
  return total / vectorA.length;
}

function getSavedGestureCounts() {
  return Array.from({ length: 10 }, (_, digit) => customGestureLibrary[String(digit)].length);
}

function classifyCustomDigit(gestureVector) {
  const trainedDigits = [];

  for (let digit = 0; digit <= 9; digit += 1) {
    if (customGestureLibrary[String(digit)].length) {
      trainedDigits.push(digit);
    }
  }

  if (!trainedDigits.length) {
    return null;
  }

  let bestDigit = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let secondScore = Number.POSITIVE_INFINITY;

  for (const digit of trainedDigits) {
    let digitBestScore = Number.POSITIVE_INFINITY;

    for (const sample of customGestureLibrary[String(digit)]) {
      digitBestScore = Math.min(digitBestScore, getGestureDistance(gestureVector, sample));
    }

    if (digitBestScore < bestScore) {
      secondScore = bestScore;
      bestScore = digitBestScore;
      bestDigit = digit;
    } else if (digitBestScore < secondScore) {
      secondScore = digitBestScore;
    }
  }

  if (trainedDigits.length === 1) {
    return bestScore < 0.2 ? bestDigit : null;
  }

  if (bestScore < 0.16) {
    return bestDigit;
  }

  if (secondScore - bestScore > 0.02 || bestScore / Math.max(secondScore, 0.001) < 0.9) {
    return bestDigit;
  }

  return null;
}

function countRecognizedDigits(gestureVectors) {
  const counts = new Map();
  for (const vector of gestureVectors) {
    if (!vector || !Array.isArray(vector) || vector.length !== 63) {
      continue;
    }
    const digit = classifyCustomDigit(vector);
    if (digit !== null) {
      counts.set(digit, (counts.get(digit) || 0) + 1);
    }
  }
  return counts;
}

function classifyRecognizedDigit(landmarks, gestureVector) {
  if (Array.isArray(landmarks) && landmarks.length && Array.isArray(landmarks[0]) && landmarks[0].length === 63 && gestureVector === undefined) {
    const totalHands = landmarks.length;
    const counts = countRecognizedDigits(landmarks);
    const majorityThreshold = Math.floor(totalHands / 2) + 1;
    let bestDigit = null;
    let bestCount = 0;

    for (const [digit, count] of counts.entries()) {
      if (count > bestCount) {
        bestCount = count;
        bestDigit = digit;
      }
    }

    return bestCount >= majorityThreshold ? bestDigit : null;
  }

  const customDigit = classifyCustomDigit(gestureVector);
  if (customDigit !== null) {
    return customDigit;
  }

  return null;
}

function updateTrainerPanelVisibility() {
  trainerPanelBodyEl.classList.toggle("is-collapsed", isTrainerPanelCollapsed);
  toggleTrainerPanelButton.setAttribute("aria-expanded", String(!isTrainerPanelCollapsed));
  toggleTrainerPanelButton.textContent = isTrainerPanelCollapsed ? "+" : "-";
  toggleTrainerPanelButton.setAttribute("aria-label", isTrainerPanelCollapsed ? "Expand trainer panel" : "Collapse trainer panel");
}

function toggleTrainerPanel() {
  isTrainerPanelCollapsed = !isTrainerPanelCollapsed;
  updateTrainerPanelVisibility();
}

function renderGestureTrainer() {
  for (let digit = 0; digit <= 9; digit += 1) {
    const slot = trainerSlotElements.get(digit);
    if (!slot) {
      continue;
    }

    const count = customGestureLibrary[String(digit)].length;
    slot.count.textContent = count === 1 ? "1 sample" : `${count} samples`;
    slot.state.textContent = count ? "Custom gesture ready" : "No saved gesture";
  }

  const counts = getSavedGestureCounts();
  const totalSamples = counts.reduce((sum, count) => sum + count, 0);
  if (!totalSamples) {
    trainerHintEl.textContent = "Hold a pose in frame, then save it to a digit. Saved gestures stay in this browser.";
    return;
  }

  trainerHintEl.textContent = `Saved ${totalSamples} gesture samples across ${counts.filter(Boolean).length} digits. Add more variations for better recognition.`;
}

function saveGestureTemplate(digit) {
  if (!latestGestureVector || performance.now() - lastLandmarkTime > 600) {
    trainerHintEl.textContent = "Show a clearly tracked hand before saving a custom gesture.";
    return;
  }

  customGestureLibrary[String(digit)].push([...latestGestureVector]);
  persistGestureLibrary();
  renderGestureTrainer();
  trainerHintEl.textContent = `Saved the current hand pose for digit ${digit}. Capture several variants for better matching.`;
}

function clearGestureTemplates(digit) {
  customGestureLibrary[String(digit)] = [];
  persistGestureLibrary();
  renderGestureTrainer();
  trainerHintEl.textContent = `Cleared saved custom gestures for digit ${digit}.`;

  if (digit === 0 && currentDigit === 0) {
    sceneController.setSpecialEffect(0);
  }
}

function resetAllGestureTemplates() {
  customGestureLibrary = createEmptyGestureLibrary();
  persistGestureLibrary();
  renderGestureTrainer();
  trainerHintEl.textContent = "Cleared all saved custom gestures.";

  if (currentDigit === 0) {
    sceneController.setSpecialEffect(0);
  }
}

function initializeGestureTrainer() {
  const fragment = document.createDocumentFragment();

  for (let digit = 0; digit <= 9; digit += 1) {
    const slot = document.createElement("article");
    slot.className = "gesture-slot";

    const header = document.createElement("div");
    header.className = "gesture-slot-header";

    const title = document.createElement("strong");
    title.textContent = `Digit ${digit}`;

    const count = document.createElement("span");
    count.className = "gesture-sample-count";
    header.append(title, count);

    const actions = document.createElement("div");
    actions.className = "gesture-slot-actions";

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "ghost-button";
    saveButton.textContent = "Save pose";
    saveButton.addEventListener("click", () => saveGestureTemplate(digit));

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "ghost-button danger-button";
    clearButton.textContent = "Clear";
    clearButton.addEventListener("click", () => clearGestureTemplates(digit));

    actions.append(saveButton, clearButton);

    const state = document.createElement("div");
    state.className = "gesture-slot-state";

    slot.append(header, actions, state);
    fragment.append(slot);
    trainerSlotElements.set(digit, { count, state });
  }

  gestureTrainerGridEl.append(fragment);
  toggleTrainerPanelButton.addEventListener("click", toggleTrainerPanel);
  exportCustomGesturesButton.addEventListener("click", exportGestureLibrary);
  importCustomGesturesButton.addEventListener("click", triggerGestureImport);
  importCustomGesturesInput.addEventListener("change", handleGestureImport);
  resetCustomGesturesButton.addEventListener("click", resetAllGestureTemplates);
  saveRibbonGestureButton.addEventListener("click", saveRibbonGesture);
  clearRibbonGestureButton.addEventListener("click", clearRibbonGestures);
  triggerRibbonEffectButton.addEventListener("click", () => triggerSpecialEffectShortcut("ribbon"));
  triggerFireworksEffectButton.addEventListener("click", () => triggerSpecialEffectShortcut("fireworks"));
  if (cameraSelectEl) {
    cameraSelectEl.addEventListener("change", () => {
      try {
        window.localStorage.setItem(CAMERA_DEVICE_ID_KEY, cameraSelectEl.value);
      } catch {
        // ignore
      }
      if (cameraState === "live") {
        startCamera();
      }
    });
  }
  specialEffectTypeEl.addEventListener("change", updateRibbonConfigFromInputs);
  specialEffectHoldSecondsEl.addEventListener("change", updateRibbonConfigFromInputs);
  specialEffectMatchWindowSecondsEl.addEventListener("change", updateRibbonConfigFromInputs);
  ribbonProtectionSecondsEl.addEventListener("change", updateRibbonConfigFromInputs);
  digitHoldSecondsEl.addEventListener("change", updateDigitConfigFromInputs);
  updateTrainerPanelVisibility();
  renderGestureTrainer();
  updateRibbonTrainerUi();
}


function buildDigitTargets(image, count) {
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = 220;
  sampleCanvas.height = 220;
  const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  sampleCtx.clearRect(0, 0, sampleCanvas.width, sampleCanvas.height);
  sampleCtx.drawImage(image, 0, 0, sampleCanvas.width, sampleCanvas.height);

  const imageData = sampleCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
  const candidatePixels = [];

  for (let y = 0; y < sampleCanvas.height; y += 2) {
    for (let x = 0; x < sampleCanvas.width; x += 2) {
      const pixelIndex = (y * sampleCanvas.width + x) * 4;
      const alpha = imageData[pixelIndex + 3];
      if (alpha < 38) {
        continue;
      }

      const brightness =
        (imageData[pixelIndex] + imageData[pixelIndex + 1] + imageData[pixelIndex + 2]) / (255 * 3);

      candidatePixels.push({ x, y, brightness });
    }
  }

  const targets = new Float32Array(count * 3);
  const tones = new Float32Array(count);

  if (!candidatePixels.length) {
    for (let index = 0; index < count; index += 1) {
      const i3 = index * 3;
      const theta = Math.random() * Math.PI * 2;
      const radius = THREE.MathUtils.randFloat(0.6, 2.4);
      targets[i3] = Math.cos(theta) * radius;
      targets[i3 + 1] = Math.sin(theta) * radius;
      targets[i3 + 2] = THREE.MathUtils.randFloatSpread(1.2);
      tones[index] = Math.random();
    }
    return { targets, tones };
  }

  for (let index = 0; index < count; index += 1) {
    const sample = candidatePixels[Math.floor(Math.random() * candidatePixels.length)];
    const i3 = index * 3;
    const normalizedX = sample.x / sampleCanvas.width - 0.5;
    const normalizedY = 0.5 - sample.y / sampleCanvas.height;
    targets[i3] = normalizedX * 7.8;
    targets[i3 + 1] = normalizedY * 7.8;
    targets[i3 + 2] = THREE.MathUtils.randFloatSpread(0.8);
    tones[index] = sample.brightness;
  }

  return { targets, tones };
}

function buildDigitTargetsFromDigit(digit, count, scale = 9.2) {
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = 360;
  maskCanvas.height = 360;
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });

  maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  maskCtx.fillStyle = "#ffffff";
  maskCtx.textAlign = "center";
  maskCtx.textBaseline = "middle";
  maskCtx.font = "700 300px Sora, serif";
  maskCtx.fillText(String(digit), maskCanvas.width / 2, maskCanvas.height / 2 + 20);

  const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
  const candidatePixels = [];

  for (let y = 0; y < maskCanvas.height; y += 2) {
    for (let x = 0; x < maskCanvas.width; x += 2) {
      const pixelIndex = (y * maskCanvas.width + x) * 4;
      if (imageData[pixelIndex + 3] < 32) {
        continue;
      }

      candidatePixels.push({ x, y });
    }
  }

  const targets = new Float32Array(count * 3);
  const tones = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const sample = candidatePixels[Math.floor(Math.random() * candidatePixels.length)];
    const i3 = index * 3;
    const normalizedX = sample.x / maskCanvas.width - 0.5;
    const normalizedY = 0.5 - sample.y / maskCanvas.height;
    targets[i3] = normalizedX * scale;
    targets[i3 + 1] = normalizedY * scale;
    targets[i3 + 2] = THREE.MathUtils.randFloatSpread(0.35);
    tones[index] = sample.y / maskCanvas.height;
  }

  return { targets, tones };
}

function isFingerExtended(landmarks, tipIndex, pipIndex, mcpIndex) {
  const tip = landmarks[tipIndex];
  const pip = landmarks[pipIndex];
  const mcp = landmarks[mcpIndex];
  return tip.y < pip.y && pip.y < mcp.y;
}

function createDigitPng(digit) {
  const palette = DIGIT_COLORS[digit];
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  const background = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, palette[0]);
  background.addColorStop(1, palette[1]);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(128, 112, 0, 128, 112, 280);
  glow.addColorStop(0, "rgba(255,255,255,0.52)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(10, 20, 34, 0.15)";
  for (let index = 0; index < 22; index += 1) {
    const radius = 10 + index * 5.2;
    ctx.beginPath();
    ctx.arc(420, 104, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(10, 20, 34, 0.22)";
  ctx.fillRect(54, 54, canvas.width - 108, canvas.height - 108);

  ctx.strokeStyle = "rgba(255,255,255,0.26)";
  ctx.lineWidth = 8;
  ctx.strokeRect(58, 58, canvas.width - 116, canvas.height - 116);

  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 238px Sora, sans-serif";
  ctx.fillText(String(digit), canvas.width / 2, canvas.height / 2 + 12);

  ctx.font = "500 32px Space Grotesk, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText("gesture", canvas.width / 2, 102);

  return canvas.toDataURL("image/png");
}

function checkCustomDigitUrl(digit) {
  if (customDigitChecks.has(digit)) {
    return customDigitChecks.get(digit);
  }

  const customUrl = `${CUSTOM_DIGIT_FOLDER}/${digit}.png`;
  const checkPromise = fetch(customUrl, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        return null;
      }
      return customUrl;
    })
    .catch(() => null);

  customDigitChecks.set(digit, checkPromise);
  return checkPromise;
}

function ensureDigitTexture(digit) {
  if (digitTextures.has(digit)) {
    return digitTextures.get(digit);
  }

  const imageUrl = createDigitPng(digit);
  const texture = textureLoader.load(imageUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  const entry = { imageUrl, texture, label: `generated/${getDigitPngName(digit)}` };
  digitTextures.set(digit, entry);

  checkCustomDigitUrl(digit).then((customUrl) => {
    if (!customUrl) {
      return;
    }

    textureLoader.load(
      customUrl,
      (customTexture) => {
        customTexture.colorSpace = THREE.SRGBColorSpace;
        entry.imageUrl = customUrl;
        entry.texture = customTexture;
        entry.label = customUrl.replace(/^\.\//, "");

        if (currentDigit === digit || (currentDigit === null && digit === 0)) {
          sceneController.setDigitTexture(digit, customTexture, customUrl);
        }
      },
      undefined,
      () => {}
    );
  });

  return entry;
}

function updateGesture(digit) {
  if (performance.now() < ribbonEffectProtectionUntil) {
    pendingDigit = null;
    pendingFrames = 0;
    pendingSince = 0;
    return;
  }

  if (digit === null) {
    return;
  }

  if (pendingDigit !== digit) {
    pendingDigit = digit;
    pendingFrames = 1;
    pendingSince = performance.now();
    return;
  }

  pendingFrames += 1;
  const holdMs = digitConfig.holdSeconds * 1000;
  if (performance.now() - pendingSince < holdMs || currentDigit === digit) {
    return;
  }

  currentDigit = digit;
  playGestureChangeSound(digit);
  gestureValueEl.textContent = String(digit);
  gestureHintEl.textContent = "Digit locked. Hold steady to keep the countdown shape stable.";
  setTrackingState("Hand tracked");
  const textureEntry = ensureDigitTexture(digit);
  sceneController.setDigitTexture(digit, textureEntry.texture, textureEntry.imageUrl);
}

function clearDigitRecognitionStateForInactivity(now = performance.now()) {
  if (now - lastDigitRecognizedAt < NO_DIGIT_CLEAR_DELAY_MS) {
    return;
  }

  if (!sceneClearedForNoDigit) {
    sceneClearedForNoDigit = true;
    sceneController.clearSceneForNoDigit();
  }

  if (currentDigit !== null) {
    currentDigit = null;
    pendingDigit = null;
    pendingFrames = 0;
    pendingSince = 0;
    gestureValueEl.textContent = "--";
    gestureHintEl.textContent = "No stable digit recognized.";
  }
}

function resetGestureStatus() {
  if (cameraState !== "live") {
    return;
  }

  if (performance.now() - lastLandmarkTime < 900) {
    return;
  }

  pendingDigit = null;
  pendingFrames = 0;
  pendingSince = 0;
  latestGestureVector = null;
  ribbonPendingMatchSince = 0;
  ribbonPendingLastMatchedAt = 0;
  ribbonTriggeredCurrentHold = false;
  ribbonEffectProtectionUntil = 0;
  updateRibbonStatus("Idle", false);
  setTrackingState("Searching for hand");
  if (currentDigit === null) {
    gestureHintEl.textContent = "Show one hand inside the camera frame with a number gesture from 0 to 9.";
  }
}

function clampFloatingCameraPosition() {
  const bounds = sceneCardEl.getBoundingClientRect();
  const cameraBounds = cameraCardEl.getBoundingClientRect();
  const maxX = Math.max(16, bounds.width - cameraBounds.width - 16);
  const maxY = Math.max(16, bounds.height - cameraBounds.height - 16);
  floatingCameraPosition.x = THREE.MathUtils.clamp(floatingCameraPosition.x, 16, maxX);
  floatingCameraPosition.y = THREE.MathUtils.clamp(floatingCameraPosition.y, 16, maxY);
}

function applyFloatingCameraPosition() {
  cameraCardEl.style.left = `${floatingCameraPosition.x}px`;
  cameraCardEl.style.top = `${floatingCameraPosition.y}px`;
}

function updateFloatingCameraVisibility() {
  const isFullscreen = document.fullscreenElement === sceneCardEl;
  cameraCardEl.classList.toggle("is-hidden", isFullscreen && !isFloatingCameraVisible);
}

function moveCameraIntoFullscreenOverlay() {
  if (cameraCardEl.parentElement === sceneCardEl) {
    clampFloatingCameraPosition();
    applyFloatingCameraPosition();
    updateFloatingCameraVisibility();
    return;
  }

  sceneCardEl.append(cameraCardEl);
  cameraCardEl.classList.add("is-floating");
  clampFloatingCameraPosition();
  applyFloatingCameraPosition();
  updateFloatingCameraVisibility();
}

function restoreCameraToStagePanel() {
  if (cameraCardEl.parentElement === stagePanelEl) {
    return;
  }

  stagePanelEl.insertBefore(cameraCardEl, sceneCardEl);
  cameraCardEl.classList.remove("is-floating");
  cameraCardEl.classList.remove("is-hidden");
  cameraCardEl.style.left = "";
  cameraCardEl.style.top = "";
}

function handleFloatingCameraPointerDown(event) {
  if (document.fullscreenElement !== sceneCardEl) {
    return;
  }

  if (event.target instanceof HTMLElement && event.target.closest("button")) {
    return;
  }

  isDraggingFloatingCamera = true;
  const bounds = cameraCardEl.getBoundingClientRect();
  floatingCameraOffset.x = event.clientX - bounds.left;
  floatingCameraOffset.y = event.clientY - bounds.top;
  cameraCardEl.classList.add("is-dragging");
  cameraHeaderEl.setPointerCapture(event.pointerId);
}

function handleFloatingCameraPointerMove(event) {
  if (!isDraggingFloatingCamera || document.fullscreenElement !== sceneCardEl) {
    return;
  }

  const sceneBounds = sceneCardEl.getBoundingClientRect();
  floatingCameraPosition.x = event.clientX - sceneBounds.left - floatingCameraOffset.x;
  floatingCameraPosition.y = event.clientY - sceneBounds.top - floatingCameraOffset.y;
  clampFloatingCameraPosition();
  applyFloatingCameraPosition();
}

function stopFloatingCameraDrag(event) {
  if (!isDraggingFloatingCamera) {
    return;
  }

  isDraggingFloatingCamera = false;
  cameraCardEl.classList.remove("is-dragging");
  if (event?.pointerId !== undefined && cameraHeaderEl.hasPointerCapture(event.pointerId)) {
    cameraHeaderEl.releasePointerCapture(event.pointerId);
  }
}

function toggleFloatingCameraVisibility() {
  if (document.fullscreenElement !== sceneCardEl) {
    return;
  }

  isFloatingCameraVisible = !isFloatingCameraVisible;
  stopFloatingCameraDrag();
  updateFloatingCameraVisibility();
}

function isKeyboardInputTarget(target) {
  return target instanceof HTMLElement && (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

function handlePresentationHotkeys(event) {
  if (!isKeyboardInputTarget(event.target) && event.ctrlKey && event.altKey && !event.metaKey && !event.shiftKey) {
    const key = event.key.toLowerCase();

    if (key === "j") {
      event.preventDefault();
      triggerSpecialEffectShortcut("ribbon");
      return;
    }

    if (key === "y") {
      event.preventDefault();
      triggerSpecialEffectShortcut("fireworks");
      return;
    }

    if (key >= "0" && key <= "9") {
      event.preventDefault();
      triggerDigitShortcut(Number(key));
      return;
    }
  }

  if (document.fullscreenElement !== sceneCardEl) {
    return;
  }

  if (!(event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && event.key.toLowerCase() === "d")) {
    return;
  }

  event.preventDefault();
  toggleFloatingCameraVisibility();
}

function updateSceneFullscreenUi() {
  const isFullscreen = document.fullscreenElement === sceneCardEl;
  sceneCardEl.classList.toggle("is-fullscreen", isFullscreen);
  toggleSceneFullscreenButton.textContent = isFullscreen ? "Exit fullscreen" : "Fullscreen";
  toggleSceneFullscreenButton.setAttribute("aria-pressed", String(isFullscreen));

  if (isFullscreen) {
    moveCameraIntoFullscreenOverlay();
    return;
  }

  isFloatingCameraVisible = true;
  stopFloatingCameraDrag();
  restoreCameraToStagePanel();
}

async function toggleSceneFullscreen() {
  try {
    if (document.fullscreenElement === sceneCardEl) {
      await document.exitFullscreen();
    } else {
      await sceneCardEl.requestFullscreen();
    }
  } catch {
  }
}

class ParticleSceneController {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 0, 14);

    this.particleCount = typeof window !== "undefined" && typeof window.getParticleCount === "function" ? window.getParticleCount() : 2200;
    this.particleLevel = typeof window !== "undefined" ? window.particleLevel : "medium";
    this.particlePositions = new Float32Array(this.particleCount * 3);
    this.particleVelocities = new Float32Array(this.particleCount * 3);
    this.particleTargets = new Float32Array(this.particleCount * 3);
    this.particleColors = new Float32Array(this.particleCount * 3);
    this.paletteA = new THREE.Color(DIGIT_COLORS[0][0]);
    this.paletteB = new THREE.Color(DIGIT_COLORS[0][1]);
    this.morphToken = 0;
    this.activeEffectDigit = null;
    this.activeEffect = null;
    this.wordArtTexture = null;
    this.lastFireworkSpawn = 0;
    this.fireworkCelebrationUntil = 0;
    this.fireworkBurstCount = 0;
    this.fireworksEnabled = false;
    this.ribbonEffectProgress = 0;
    this.ribbonEffectActive = false;

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    const rimLight = new THREE.PointLight(0x7cf5c0, 14, 40, 2);
    rimLight.position.set(-4.4, 3, 10);
    this.scene.add(rimLight);

    const warmLight = new THREE.PointLight(0xffb57d, 16, 40, 2);
    warmLight.position.set(4.2, -2.1, 10);
    this.scene.add(warmLight);

    this.digitGeometry = new THREE.BufferGeometry();
    for (let index = 0; index < this.particleCount; index += 1) {
      const i3 = index * 3;
      this.particlePositions[i3] = THREE.MathUtils.randFloatSpread(12);
      this.particlePositions[i3 + 1] = THREE.MathUtils.randFloatSpread(12);
      this.particlePositions[i3 + 2] = THREE.MathUtils.randFloatSpread(3);
      this.particleTargets[i3] = this.particlePositions[i3];
      this.particleTargets[i3 + 1] = this.particlePositions[i3 + 1];
      this.particleTargets[i3 + 2] = this.particlePositions[i3 + 2];
      this.particleColors[i3] = 1;
      this.particleColors[i3 + 1] = 1;
      this.particleColors[i3 + 2] = 1;
    }

    this.digitGeometry.setAttribute("position", new THREE.BufferAttribute(this.particlePositions, 3));
    this.digitGeometry.setAttribute("color", new THREE.BufferAttribute(this.particleColors, 3));
    this.digitMaterial = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });
    this.digitPoints = new THREE.Points(this.digitGeometry, this.digitMaterial);
    this.scene.add(this.digitPoints);

    this.effectSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    this.effectSprite.position.set(0, 4.4, 0.8);
    this.effectSprite.scale.set(0, 0, 1);
    this.scene.add(this.effectSprite);

    this.ribbonLeft = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 0.38),
      new THREE.MeshBasicMaterial({ color: 0xff4f6f, transparent: true, opacity: 0, depthWrite: false })
    );
    this.ribbonRight = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 0.38),
      new THREE.MeshBasicMaterial({ color: 0x45d9a6, transparent: true, opacity: 0, depthWrite: false })
    );
    this.ribbonLeft.position.set(-7, 0.2, 0.4);
    this.ribbonRight.position.set(7, -0.2, 0.4);
    this.scene.add(this.ribbonLeft);
    this.scene.add(this.ribbonRight);

    this.scissorPivot = new THREE.Group();
    this.scissorPivot.position.set(0, 0, 1.2);
    this.scene.add(this.scissorPivot);

    const bladeMaterial = new THREE.MeshBasicMaterial({ color: 0xd9e2f1, transparent: true, opacity: 0, depthWrite: false });
    const bladeGeometry = new THREE.PlaneGeometry(2.4, 0.16);
    this.scissorBladeTop = new THREE.Mesh(bladeGeometry, bladeMaterial.clone());
    this.scissorBladeBottom = new THREE.Mesh(bladeGeometry, bladeMaterial.clone());
    this.scissorBladeTop.position.set(1.05, 0, 0);
    this.scissorBladeBottom.position.set(1.05, 0, 0);
    this.scissorPivot.add(this.scissorBladeTop);
    this.scissorPivot.add(this.scissorBladeBottom);

    this.scissorHandleTop = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.35, 28),
      new THREE.MeshBasicMaterial({ color: 0xffcb70, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
    );
    this.scissorHandleBottom = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.35, 28),
      new THREE.MeshBasicMaterial({ color: 0xffcb70, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
    );
    this.scissorHandleTop.position.set(-0.35, 0.16, 0);
    this.scissorHandleBottom.position.set(-0.35, -0.16, 0);
    this.scissorPivot.add(this.scissorHandleTop);
    this.scissorPivot.add(this.scissorHandleBottom);
    this.scissorPivot.visible = false;

    this.bgParticleCount = 560;
    this.bgPositions = new Float32Array(this.bgParticleCount * 3);
    this.bgColors = new Float32Array(this.bgParticleCount * 3);
    this.bgSeeds = [];
    this.bgGeometry = new THREE.BufferGeometry();

    for (let index = 0; index < this.bgParticleCount; index += 1) {
      const i3 = index * 3;
      this.bgPositions[i3] = 0;
      this.bgPositions[i3 + 1] = 0;
      this.bgPositions[i3 + 2] = 0;
      const mix = Math.random();
      this.bgColors[i3] = 0.2 + mix * 0.3;
      this.bgColors[i3 + 1] = 0.45 + mix * 0.35;
      this.bgColors[i3 + 2] = 0.65 + mix * 0.25;
      this.bgSeeds.push({
        radius: THREE.MathUtils.randFloat(4.5, 9.5),
        speed: THREE.MathUtils.randFloat(0.15, 0.9),
        phase: THREE.MathUtils.randFloat(0, Math.PI * 2),
        lift: THREE.MathUtils.randFloat(-4.2, 4.2),
        wobble: THREE.MathUtils.randFloat(0.25, 1.2)
      });
    }

    this.bgGeometry.setAttribute("position", new THREE.BufferAttribute(this.bgPositions, 3));
    this.bgGeometry.setAttribute("color", new THREE.BufferAttribute(this.bgColors, 3));
    this.bgMaterial = new THREE.PointsMaterial({
      size: 0.07,
      vertexColors: true,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    this.bgPoints = new THREE.Points(this.bgGeometry, this.bgMaterial);
    this.scene.add(this.bgPoints);

    this.fireworkParticleCount = 960;
    this.fireworkPositions = new Float32Array(this.fireworkParticleCount * 3);
    this.fireworkColors = new Float32Array(this.fireworkParticleCount * 3);
    this.fireworkMeta = Array.from({ length: this.fireworkParticleCount }, () => ({
      active: false,
      originX: 0,
      originY: 0,
      originZ: 0,
      velocityX: 0,
      velocityY: 0,
      velocityZ: 0,
      age: 0,
      life: 1,
      alpha: 0
    }));
    this.fireworkGeometry = new THREE.BufferGeometry();

    for (let index = 0; index < this.fireworkParticleCount; index += 1) {
      const i3 = index * 3;
      this.fireworkPositions[i3] = 0;
      this.fireworkPositions[i3 + 1] = -30;
      this.fireworkPositions[i3 + 2] = 0;
      this.fireworkColors[i3] = 1;
      this.fireworkColors[i3 + 1] = 0.7;
      this.fireworkColors[i3 + 2] = 0.4;
    }

    this.fireworkGeometry.setAttribute("position", new THREE.BufferAttribute(this.fireworkPositions, 3));
    this.fireworkGeometry.setAttribute("color", new THREE.BufferAttribute(this.fireworkColors, 3));
    this.fireworkMaterial = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    this.fireworkPoints = new THREE.Points(this.fireworkGeometry, this.fireworkMaterial);
    this.fireworkPoints.visible = false;
    this.scene.add(this.fireworkPoints);

    this.clock = new THREE.Clock();
    this.handleResize();
    window.addEventListener("resize", () => this.handleResize());

    const initialEntry = ensureDigitTexture(0);
    this.setDigitTexture(0, initialEntry.texture, initialEntry.imageUrl);
    this.animate();
  }

  async setDigitTexture(digit, texture, imageUrl) {
    this.digitPoints.visible = true;
    this.bgPoints.visible = true;
    this.paletteA.set(DIGIT_COLORS[digit][0]);
    this.paletteB.set(DIGIT_COLORS[digit][1]);
    const currentToken = ++this.morphToken;
    const effectConfig = SPECIAL_DIGIT_EFFECTS[digit] || null;
    const digitScale = effectConfig?.scale ?? 9.2;
    const { targets, tones } = buildDigitTargetsFromDigit(digit, this.particleCount, digitScale);
    if (currentToken !== this.morphToken) {
      return;
    }

    this.particleTargets.set(targets);

    for (let index = 0; index < this.particleCount; index += 1) {
      const i3 = index * 3;
      const tone = tones[index];
      this.particleColors[i3] = this.paletteA.r + (this.paletteB.r - this.paletteA.r) * tone;
      this.particleColors[i3 + 1] = this.paletteA.g + (this.paletteB.g - this.paletteA.g) * tone;
      this.particleColors[i3 + 2] = this.paletteA.b + (this.paletteB.b - this.paletteA.b) * tone;
      this.particleVelocities[i3] += THREE.MathUtils.randFloatSpread(0.7);
      this.particleVelocities[i3 + 1] += THREE.MathUtils.randFloatSpread(0.7);
      this.particleVelocities[i3 + 2] += THREE.MathUtils.randFloatSpread(0.4);
    }

    this.digitGeometry.attributes.color.needsUpdate = true;
    this.setSpecialEffect(digit);
  }

  applyParticleLevel(level) {
    const normalized = ["low", "medium", "high"].includes(String(level).toLowerCase())
      ? String(level).toLowerCase()
      : "medium";
    const nextCount = typeof window !== "undefined" && window.PARTICLE_LEVEL_COUNTS
      ? window.PARTICLE_LEVEL_COUNTS[normalized] || 2200
      : 2200;

    if (nextCount === this.particleCount && this.particleLevel === normalized) {
      return;
    }

    this.particleCount = nextCount;
    this.particleLevel = normalized;
    this.particlePositions = new Float32Array(this.particleCount * 3);
    this.particleVelocities = new Float32Array(this.particleCount * 3);
    this.particleTargets = new Float32Array(this.particleCount * 3);
    this.particleColors = new Float32Array(this.particleCount * 3);

    for (let index = 0; index < this.particleCount; index += 1) {
      const i3 = index * 3;
      this.particlePositions[i3] = THREE.MathUtils.randFloatSpread(12);
      this.particlePositions[i3 + 1] = THREE.MathUtils.randFloatSpread(12);
      this.particlePositions[i3 + 2] = THREE.MathUtils.randFloatSpread(3);
      this.particleTargets[i3] = this.particlePositions[i3];
      this.particleTargets[i3 + 1] = this.particlePositions[i3 + 1];
      this.particleTargets[i3 + 2] = this.particlePositions[i3 + 2];
      this.particleColors[i3] = 1;
      this.particleColors[i3 + 1] = 1;
      this.particleColors[i3 + 2] = 1;
    }

    this.digitGeometry.setAttribute("position", new THREE.BufferAttribute(this.particlePositions, 3));
    this.digitGeometry.setAttribute("color", new THREE.BufferAttribute(this.particleColors, 3));
    this.digitGeometry.attributes.position.needsUpdate = true;
    this.digitGeometry.attributes.color.needsUpdate = true;

    const digitToRestore = Number.isInteger(currentDigit) ? currentDigit : 0;
    const textureEntry = ensureDigitTexture(digitToRestore);
    this.setDigitTexture(digitToRestore, textureEntry.texture, textureEntry.imageUrl);
  }

  clearSceneForNoDigit() {
    this.digitPoints.visible = false;
    this.bgPoints.visible = true;
    this.effectSprite.visible = false;
    this.effectSprite.material.opacity = 0;
    this.effectSprite.material.map = null;
    this.effectSprite.material.needsUpdate = true;
    this.activeEffect = null;
    this.activeEffectDigit = null;
    this.ribbonEffectActive = false;
    this.fireworksEnabled = false;
    this.fireworkCelebrationUntil = 0;
    this.fireworkPoints.visible = false;
    this.fireworkMaterial.opacity = 0;
    this.ribbonLeft.material.opacity = 0;
    this.ribbonRight.material.opacity = 0;
    this.scissorPivot.visible = false;
  }

  setSpecialEffect(digit) {
    const hasDigitZeroSample = customGestureLibrary[String(0)]?.length > 0;
    const zeroEffectAllowed = digit !== 0 || hasDigitZeroSample;
    const effectConfig = zeroEffectAllowed ? SPECIAL_DIGIT_EFFECTS[digit] || null : null;
    this.activeEffectDigit = digit;
    this.activeEffect = effectConfig;
    this.fireworksEnabled = effectConfig?.kind === "fireworks" || effectConfig?.fireworks === true;
    this.fireworkPoints.visible = this.fireworksEnabled;
    this.fireworkBurstCount = 0;

    if (this.wordArtTexture) {
      this.wordArtTexture.dispose();
      this.wordArtTexture = null;
    }

    if (effectConfig?.kind === "word") {
      this.wordArtTexture = createWordArtTexture(effectConfig.label, DIGIT_COLORS[digit]);
      this.effectSprite.material.map = this.wordArtTexture;
      this.effectSprite.material.needsUpdate = true;
      this.effectSprite.visible = true;
      this.effectSprite.scale.set(8.8, 2.6, 1);
      this.effectSprite.position.set(0, 4.35, 0.8);
    } else {
      this.effectSprite.visible = false;
      this.effectSprite.material.map = null;
      this.effectSprite.material.opacity = 0;
    }

    if (!this.fireworksEnabled) {
      for (const particle of this.fireworkMeta) {
        particle.active = false;
      }
      this.fireworkPoints.visible = false;
      this.fireworkMaterial.opacity = 0;
      return;
    }

    this.fireworkMaterial.opacity = 1;
    this.fireworkPoints.visible = true;
    this.lastFireworkSpawn = 0;

    for (let burstIndex = 0; burstIndex < 6; burstIndex += 1) {
      this.spawnFireworkBurst();
    }
  }

  spawnFireworkBurst() {
    let burstSize = 72;
    const originX = THREE.MathUtils.randFloatSpread(18);
    const originY = THREE.MathUtils.randFloat(-4.2, 5.6);
    const originZ = THREE.MathUtils.randFloatSpread(5.5);
    const colorA = new THREE.Color(DIGIT_COLORS[Math.floor(Math.random() * DIGIT_COLORS.length)][0]);
    const colorB = new THREE.Color(DIGIT_COLORS[Math.floor(Math.random() * DIGIT_COLORS.length)][1]);

    for (let index = 0; index < this.fireworkParticleCount && burstSize > 0; index += 1) {
      const particle = this.fireworkMeta[index];
      if (particle.active) {
        continue;
      }

      const i3 = index * 3;
      const angle = Math.random() * Math.PI * 2;
      const spread = THREE.MathUtils.randFloat(0.08, 0.24);
      const lift = THREE.MathUtils.randFloat(1.8, 5.6);
      const mix = Math.random();
      const color = colorA.clone().lerp(colorB, mix);

      particle.active = true;
      particle.originX = originX;
      particle.originY = originY;
      particle.originZ = originZ;
      particle.velocityX = Math.cos(angle) * lift;
      particle.velocityY = Math.sin(angle) * lift + THREE.MathUtils.randFloat(-0.2, 1.7);
      particle.velocityZ = THREE.MathUtils.randFloatSpread(2.1);
      particle.age = 0;
      particle.life = THREE.MathUtils.randFloat(1.15, 2.1);
      particle.alpha = 1;

      this.fireworkPositions[i3] = originX;
      this.fireworkPositions[i3 + 1] = originY;
      this.fireworkPositions[i3 + 2] = originZ;
      this.fireworkColors[i3] = Math.min(1, color.r + spread);
      this.fireworkColors[i3 + 1] = Math.min(1, color.g + spread * 0.6);
      this.fireworkColors[i3 + 2] = Math.min(1, color.b + spread * 0.3);

      burstSize -= 1;
    }

    this.fireworkGeometry.attributes.color.needsUpdate = true;
  }

  triggerRibbonCutEffect() {
    this.ribbonEffectActive = true;
    this.ribbonEffectProgress = 0;
    this.ribbonLeft.position.set(-7, 0.22, 0.4);
    this.ribbonRight.position.set(7, -0.22, 0.4);
    this.ribbonLeft.rotation.z = 0;
    this.ribbonRight.rotation.z = 0;
    this.ribbonLeft.material.opacity = 0.98;
    this.ribbonRight.material.opacity = 0.98;
    this.scissorPivot.visible = true;
    this.scissorPivot.position.set(4.8, 2.2, 1.2);
    this.scissorPivot.rotation.z = -0.28;
    this.scissorBladeTop.rotation.z = 0.34;
    this.scissorBladeBottom.rotation.z = -0.34;
    this.scissorBladeTop.material.opacity = 0.96;
    this.scissorBladeBottom.material.opacity = 0.96;
    this.scissorHandleTop.material.opacity = 0.9;
    this.scissorHandleBottom.material.opacity = 0.9;

    for (let index = 0; index < 7; index += 1) {
      this.spawnFireworkBurst();
    }
  }

  triggerFireworkCelebration() {
    this.fireworkMaterial.opacity = 1;
    this.fireworkPoints.visible = true;
    this.lastFireworkSpawn = this.clock.getElapsedTime();
    this.fireworkCelebrationUntil = this.lastFireworkSpawn + 1.6;

    for (let index = 0; index < 8; index += 1) {
      this.spawnFireworkBurst();
    }
  }

  activateSpecialEffectOnly(durationSeconds) {
    this.digitPoints.visible = false;
    this.effectSprite.visible = false;
    this.effectSprite.material.opacity = 0;
    this.activeEffect = null;
    this.fireworksEnabled = false;
  }

  handleResize() {
    const bounds = this.canvas.getBoundingClientRect();
    const width = Math.max(bounds.width, 320);
    const height = Math.max(bounds.height, 320);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  animate = () => {
    const elapsed = this.clock.getElapsedTime();

    for (let index = 0; index < this.particleCount; index += 1) {
      const i3 = index * 3;
      const x = this.particlePositions[i3];
      const y = this.particlePositions[i3 + 1];
      const z = this.particlePositions[i3 + 2];

      const tx = this.particleTargets[i3] + Math.sin(elapsed * 2.2 + index * 0.021) * 0.08;
      const ty = this.particleTargets[i3 + 1] + Math.cos(elapsed * 2 + index * 0.017) * 0.08;
      const tz = this.particleTargets[i3 + 2] + Math.sin(elapsed * 1.7 + index * 0.012) * 0.11;

      this.particleVelocities[i3] = (this.particleVelocities[i3] + (tx - x) * 0.07) * 0.86;
      this.particleVelocities[i3 + 1] = (this.particleVelocities[i3 + 1] + (ty - y) * 0.07) * 0.86;
      this.particleVelocities[i3 + 2] = (this.particleVelocities[i3 + 2] + (tz - z) * 0.04) * 0.83;

      this.particlePositions[i3] += this.particleVelocities[i3];
      this.particlePositions[i3 + 1] += this.particleVelocities[i3 + 1];
      this.particlePositions[i3 + 2] += this.particleVelocities[i3 + 2];
    }

    for (let index = 0; index < this.bgParticleCount; index += 1) {
      const seed = this.bgSeeds[index];
      const i3 = index * 3;
      const angle = elapsed * seed.speed + seed.phase;
      this.bgPositions[i3] = Math.cos(angle) * seed.radius;
      this.bgPositions[i3 + 1] = seed.lift + Math.sin(angle * 1.9) * seed.wobble;
      this.bgPositions[i3 + 2] = Math.sin(angle * 0.8) * 2.8;
    }

    this.digitPoints.rotation.y = Math.sin(elapsed * 0.23) * 0.2;
    this.digitPoints.rotation.x = Math.cos(elapsed * 0.2) * 0.08;
    this.bgPoints.rotation.y = elapsed * 0.05;
    this.bgPoints.rotation.x = Math.sin(elapsed * 0.16) * 0.12;

    if (this.activeEffect?.kind === "word") {
      const flicker = 0.7 + Math.sin(elapsed * 9.4) * 0.14 + Math.sin(elapsed * 31) * 0.06;
      this.effectSprite.visible = true;
      this.effectSprite.material.opacity = flicker;
      this.effectSprite.position.y = 4.35 + Math.sin(elapsed * 2.2) * 0.12;
      const scalePulse = 1 + Math.sin(elapsed * 3.2) * 0.035;
      this.effectSprite.scale.set(8.8 * scalePulse, 2.75 * scalePulse, 1);
      this.effectSprite.material.rotation = Math.sin(elapsed * 0.9) * 0.02;
    } else {
      this.effectSprite.material.opacity *= 0.92;
    }

    if (this.ribbonEffectActive) {
      this.ribbonEffectProgress += 1 / 60;
      const t = this.ribbonEffectProgress;

      if (t < 0.34) {
        const k = t / 0.34;
        this.ribbonLeft.position.x = THREE.MathUtils.lerp(-7, -0.6, k);
        this.ribbonRight.position.x = THREE.MathUtils.lerp(7, 0.6, k);
        this.ribbonLeft.position.y = 0.22;
        this.ribbonRight.position.y = -0.22;
        this.scissorPivot.visible = true;
        this.scissorPivot.position.x = THREE.MathUtils.lerp(4.8, 0.65, k);
        this.scissorPivot.position.y = THREE.MathUtils.lerp(2.2, 0.32, k);
        this.scissorPivot.rotation.z = THREE.MathUtils.lerp(-0.28, -0.06, k);
        this.scissorBladeTop.rotation.z = THREE.MathUtils.lerp(0.34, 0.22, k);
        this.scissorBladeBottom.rotation.z = THREE.MathUtils.lerp(-0.34, -0.22, k);
      } else if (t < 0.58) {
        const cut = (t - 0.34) / 0.24;
        this.scissorPivot.position.x = 0.65;
        this.scissorPivot.position.y = 0.32;
        this.scissorPivot.rotation.z = -0.06 + Math.sin(t * 42) * 0.015;
        this.scissorBladeTop.rotation.z = THREE.MathUtils.lerp(0.22, 0.02, cut);
        this.scissorBladeBottom.rotation.z = THREE.MathUtils.lerp(-0.22, -0.02, cut);
        this.ribbonLeft.position.x = -0.6;
        this.ribbonRight.position.x = 0.6;
        this.ribbonLeft.position.y = 0.22;
        this.ribbonRight.position.y = -0.22;
      } else {
        const split = THREE.MathUtils.clamp((t - 0.58) / 0.7, 0, 1);
        this.ribbonLeft.position.x = -0.6 - split * 4.8;
        this.ribbonRight.position.x = 0.6 + split * 4.8;
        this.ribbonLeft.position.y = 0.22 + split * 1.4;
        this.ribbonRight.position.y = -0.22 - split * 1.2;
        this.ribbonLeft.rotation.z = split * 0.48;
        this.ribbonRight.rotation.z = -split * 0.54;
        this.scissorBladeTop.rotation.z = 0.02;
        this.scissorBladeBottom.rotation.z = -0.02;
        this.scissorPivot.position.x = 0.65 + split * 1.25;
        this.scissorPivot.position.y = 0.32 + split * 0.95;
        this.scissorPivot.rotation.z = -0.06 - split * 0.24;
        const scissorFade = 1 - split;
        this.scissorBladeTop.material.opacity = scissorFade;
        this.scissorBladeBottom.material.opacity = scissorFade;
        this.scissorHandleTop.material.opacity = scissorFade;
        this.scissorHandleBottom.material.opacity = scissorFade;
        const fade = 1 - split;
        this.ribbonLeft.material.opacity = fade;
        this.ribbonRight.material.opacity = fade;
      }

      if (t > 1.3) {
        this.ribbonEffectActive = false;
        this.ribbonLeft.material.opacity = 0;
        this.ribbonRight.material.opacity = 0;
        this.scissorPivot.visible = false;
      }
    }

    const fireworksBurstActive = this.fireworkCelebrationUntil && elapsed < this.fireworkCelebrationUntil;
    const fireworksActive = this.fireworksEnabled || fireworksBurstActive;

    if (fireworksActive) {
      this.fireworkPoints.visible = true;
      this.camera.position.x = Math.sin(elapsed * 0.72) * 0.18;
      this.camera.position.y = Math.cos(elapsed * 0.64) * 0.14;
      if (elapsed - this.lastFireworkSpawn > 0.08) {
        this.lastFireworkSpawn = elapsed;
        this.spawnFireworkBurst();
      }
    }

    for (let index = 0; index < this.fireworkParticleCount; index += 1) {
      const particle = this.fireworkMeta[index];
      const i3 = index * 3;

      if (!particle.active) {
        if (!fireworksActive) {
          this.fireworkPositions[i3 + 1] = -30;
        }
        continue;
      }

      particle.age += 1 / 60;
      const lifeProgress = particle.age / particle.life;

      if (lifeProgress >= 1) {
        particle.active = false;
        this.fireworkPositions[i3 + 1] = -30;
        continue;
      }

      this.fireworkPositions[i3] = particle.originX + particle.velocityX * particle.age;
      this.fireworkPositions[i3 + 1] = particle.originY + particle.velocityY * particle.age - particle.age * particle.age * 1.9;
      this.fireworkPositions[i3 + 2] = particle.originZ + particle.velocityZ * particle.age;

      const fade = 1 - lifeProgress;
      this.fireworkColors[i3] *= 0.996;
      this.fireworkColors[i3 + 1] *= 0.996;
      this.fireworkColors[i3 + 2] *= 0.996;
      particle.alpha = fade;
    }

    this.fireworkMaterial.opacity = fireworksActive ? 0.95 : Math.max(this.fireworkMaterial.opacity * 0.95, 0);

    this.digitGeometry.attributes.position.needsUpdate = true;
    this.bgGeometry.attributes.position.needsUpdate = true;
    this.fireworkGeometry.attributes.position.needsUpdate = true;
    this.fireworkGeometry.attributes.color.needsUpdate = true;

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.animate);
  };
}

const sceneController = new ParticleSceneController(sceneCanvas);
if (typeof window !== "undefined") {
  window.applyParticleLevelSetting = function applyParticleLevelSetting() {
    if (sceneController && typeof sceneController.applyParticleLevel === "function") {
      sceneController.applyParticleLevel(window.particleLevel);
    }
  };
}
const initialDigitEntry = ensureDigitTexture(0);
initializeGestureTrainer();
preloadGestureLibraryFromAssets();
toggleSceneFullscreenButton.addEventListener("click", toggleSceneFullscreen);
sceneCanvas.addEventListener("dblclick", toggleSceneFullscreen);
cameraHeaderEl.addEventListener("pointerdown", handleFloatingCameraPointerDown);
cameraHeaderEl.addEventListener("pointermove", handleFloatingCameraPointerMove);
cameraHeaderEl.addEventListener("pointerup", stopFloatingCameraDrag);
cameraHeaderEl.addEventListener("pointercancel", stopFloatingCameraDrag);
document.addEventListener("keydown", handlePresentationHotkeys);
document.addEventListener("fullscreenchange", () => {
  updateSceneFullscreenUi();
  sceneController.handleResize();
});
window.addEventListener("resize", () => {
  if (document.fullscreenElement === sceneCardEl && cameraCardEl.classList.contains("is-floating")) {
    clampFloatingCameraPosition();
    applyFloatingCameraPosition();
  }
});
updateSceneFullscreenUi();

function drawHandResults(results) {
  const width = handCanvas.width;
  const height = handCanvas.height;
  handCanvasCtx.save();
  handCanvasCtx.clearRect(0, 0, width, height);
  handCanvasCtx.drawImage(results.image, 0, 0, width, height);

  if (results.multiHandLandmarks?.length) {
    const validGestureVectors = [];
    const handRecognitionLabels = [];
    let maxHandSizePercent = 0;
    let validHands = 0;
    let tooFarHands = 0;

    for (const landmarks of results.multiHandLandmarks) {
      drawConnectors(handCanvasCtx, landmarks, HAND_CONNECTIONS, {
        color: "rgba(124, 245, 192, 0.85)",
        lineWidth: 2
      });
      drawLandmarks(handCanvasCtx, landmarks, {
        color: "rgba(255, 188, 125, 0.95)",
        fillColor: "rgba(8, 17, 31, 0.92)",
        lineWidth: 1,
        radius: 3
      });

      const xs = landmarks.map((point) => point.x);
      const ys = landmarks.map((point) => point.y);
      const widthNorm = Math.max(...xs) - Math.min(...xs);
      const heightNorm = Math.max(...ys) - Math.min(...ys);
      const handSize = Math.max(widthNorm, heightNorm);
      const handSizePercent = Math.max(0, handSize * 100);
      maxHandSizePercent = Math.max(maxHandSizePercent, handSizePercent);

      if (handSize < getMinHandSizeThreshold()) {
        tooFarHands += 1;
        handRecognitionLabels.push("--");
        continue;
      }

      validHands += 1;
      const gestureVector = buildGestureVector(landmarks);
      validGestureVectors.push(gestureVector);
      const recognizedDigit = classifyCustomDigit(gestureVector);
      handRecognitionLabels.push(recognizedDigit === null ? "--" : String(recognizedDigit));
    }

    updateHandRecognitionState(handRecognitionLabels);

    if (!validHands) {
      handSizePercentEl.textContent = "Hand size: --";
      latestGestureVector = null;
      pendingDigit = null;
      pendingFrames = 0;
      pendingSince = 0;
      ribbonPendingMatchSince = 0;
      ribbonPendingLastMatchedAt = 0;
      ribbonTriggeredCurrentHold = false;
      setTrackingState(tooFarHands > 1 ? "Hands too far. Move your hands closer" : "Hand too far. Move your hand closer");
      resetGestureStatus();
    } else {
      handSizePercentEl.textContent = `Hand size: ${maxHandSizePercent.toFixed(1)}%`;
      lastLandmarkTime = performance.now();
      latestGestureVector = validGestureVectors[0];
      const now = performance.now();

      if (validHands > 1) {
        setTrackingState(`${validHands} hands tracked`);
      } else {
        setTrackingState("Hand tracked");
      }

      const digit = classifyRecognizedDigit(validGestureVectors);
      if (digit !== null) {
        lastDigitRecognizedAt = now;
        if (sceneClearedForNoDigit) {
          sceneClearedForNoDigit = false;
          const textureEntry = ensureDigitTexture(digit);
          sceneController.setDigitTexture(digit, textureEntry.texture, textureEntry.imageUrl);
        }
        const digitCounts = countRecognizedDigits(validGestureVectors);
        const recognizedCount = digitCounts.get(digit) || 0;
        setTrackingState(`Digit recognized: ${digit} (${recognizedCount}/${validHands} hands)`);
        updateGesture(digit);
      } else {
        clearDigitRecognitionStateForInactivity(now);
        if (now >= ribbonEffectProtectionUntil) {
          const ribbonMatchCount = getRibbonGestureMatchCount(validGestureVectors);
          const ribbonMajority = ribbonMatchCount > Math.floor(validHands / 2);
          if (ribbonMajority) {
            if (!ribbonPendingMatchSince) {
              setTrackingState(`Ribbon gesture detected on ${ribbonMatchCount}/${validHands} hands. Hold to trigger effect.`);
              ribbonPendingMatchSince = now;
              ribbonTriggeredCurrentHold = false;
            }

            ribbonPendingLastMatchedAt = now;
          }

          if (ribbonPendingMatchSince) {
            const matchWindowMs = ribbonConfig.matchWindowSeconds * 1000;
            const holdMs = ribbonConfig.holdSeconds * 1000;
            const isWithinWindow = now - ribbonPendingLastMatchedAt <= matchWindowMs;

            if (!isWithinWindow) {
              ribbonPendingMatchSince = 0;
              ribbonPendingLastMatchedAt = 0;
              ribbonTriggeredCurrentHold = false;
            } else if (!ribbonTriggeredCurrentHold && now - ribbonPendingMatchSince >= holdMs) {
              setTrackingState("Ribbon gesture held! Effect triggered.");
              triggerConfiguredSpecialEffect(now);
            }
          }
        }
      }
    }
  } else {
    handSizePercentEl.textContent = "Hand size: --";
    latestGestureVector = null;
    pendingDigit = null;
    pendingFrames = 0;
    pendingSince = 0;
    ribbonPendingMatchSince = 0;
    ribbonPendingLastMatchedAt = 0;
    ribbonTriggeredCurrentHold = false;
    clearDigitRecognitionStateForInactivity();
    updateHandRecognitionState([]);
    setTrackingState("No hand detected");
    resetGestureStatus();
  }

  handCanvasCtx.restore();
}

const hands = new Hands({
  locateFile(file) {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  }
});

hands.setOptions({
  maxNumHands: typeof window !== "undefined" && Number.isInteger(window.maxNumHands) ? window.maxNumHands : 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.75,
  minTrackingConfidence: 0.75,
  selfieMode: true
});

if (typeof window !== "undefined") {
  window.updateHandTrackingOptions = function updateHandTrackingOptions() {
    if (hands && typeof hands.setOptions === "function") {
      hands.setOptions({
        maxNumHands: Number.isInteger(window.maxNumHands) ? window.maxNumHands : 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.75,
        minTrackingConfidence: 0.75,
        selfieMode: true
      });
    }
    updateHandRecognitionState([]);
  };
}

hands.onResults((results) => {
  if (handCanvas.width !== results.image.width || handCanvas.height !== results.image.height) {
    handCanvas.width = results.image.width;
    handCanvas.height = results.image.height;
  }
  drawHandResults(results);
});

videoElement.setAttribute("autoplay", "");
videoElement.setAttribute("muted", "");
videoElement.setAttribute("playsinline", "");
videoElement.muted = true;
videoElement.playsInline = true;

async function startCamera() {
  stopCamera({ preserveHint: true });
  cameraState = "requesting";
  setTrackingState("Requesting camera");
  updateCaptureButton();
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("MediaDevices API unavailable in this browser context.");
    }

    const selectedDeviceId = getSelectedCameraDeviceId();
    const videoConstraints = selectedDeviceId
      ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      : { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } };

    activeStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });

    videoElement.srcObject = activeStream;
    await videoElement.play();

    const processFrame = async () => {
      animationFrameId = requestAnimationFrame(processFrame);

      if (isProcessingFrame || videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return;
      }

      isProcessingFrame = true;
      try {
        await hands.send({ image: videoElement });
      } catch {
        setTrackingState("Tracking paused");
      } finally {
        isProcessingFrame = false;
      }
    };

    processFrame();
    cameraState = "live";
    setTrackingState("Camera live");
    gestureHintEl.textContent = "Show one hand with a clear number gesture from 0 to 9.";
    updateCaptureButton();

    // Refresh available camera list (labels may appear after permission granted)
    populateCameraList();
    try {
      navigator.mediaDevices.addEventListener("devicechange", populateCameraList);
    } catch {
      // ignore if not supported
    }
  } catch (error) {
    stopCamera({ preserveHint: true });
    cameraState = "unavailable";
    setTrackingState("Camera unavailable");
    if (error?.name === "NotAllowedError") {
      gestureHintEl.textContent = "Camera permission was denied. Allow camera access in the browser and reload the page.";
    } else if (error?.name === "NotReadableError" || error?.name === "AbortError") {
      gestureHintEl.textContent = "Camera is busy in another app or browser tab. Close the other camera session, then reload the page.";
    } else if (error?.name === "NotFoundError") {
      gestureHintEl.textContent = "No camera was found. Connect a camera, then reload the page.";
    } else {
      gestureHintEl.textContent = "Camera start failed. Use localhost/HTTPS, grant permission, and verify no other app is locking the camera.";
    }
    updateCaptureButton();
    console.error(error);
  }
}

toggleCaptureButton.addEventListener("click", toggleCapture);
updateCaptureButton();
populateCameraList();
startCamera();

window.setInterval(resetGestureStatus, 250);