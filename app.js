import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

const videoElement = document.querySelector(".input-video");
const handCanvas = document.querySelector(".output-canvas");
const handCanvasCtx = handCanvas.getContext("2d");
const sceneCanvas = document.querySelector("#sceneCanvas");
const gestureValueEl = document.querySelector("#gestureValue");
const gestureHintEl = document.querySelector("#gestureHint");
const digitPreviewEl = document.querySelector("#digitPreview");
const trackingStateEl = document.querySelector("#trackingState");

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

const CUSTOM_DIGIT_FOLDER = "./assets/custom-png";
const textureLoader = new THREE.TextureLoader();
const digitTextures = new Map();
const customDigitChecks = new Map();
let currentDigit = null;
let pendingDigit = null;
let pendingFrames = 0;
let lastLandmarkTime = 0;

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
  const entry = { imageUrl, texture };
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

        if (currentDigit === digit || (currentDigit === null && digit === 0)) {
          digitPreviewEl.src = customUrl;
          sceneController.setDigitTexture(digit, customTexture, customUrl);
        }
      },
      undefined,
      () => {}
    );
  });

  return entry;
}

function classifyDigit(landmarks) {
  const palmSize = Math.max(distance2D(landmarks[0], landmarks[9]), 0.08);
  const fingerExtended = {
    index: isFingerExtended(landmarks, 8, 6, 5),
    middle: isFingerExtended(landmarks, 12, 10, 9),
    ring: isFingerExtended(landmarks, 16, 14, 13),
    pinky: isFingerExtended(landmarks, 20, 18, 17)
  };

  const thumbSpread = distance2D(landmarks[4], landmarks[5]) / palmSize;
  const thumbOpen = thumbSpread > 0.62;
  const touchThreshold = palmSize * 0.58;
  const thumbTouches = {
    index: distance2D(landmarks[4], landmarks[8]) < touchThreshold,
    middle: distance2D(landmarks[4], landmarks[12]) < touchThreshold,
    ring: distance2D(landmarks[4], landmarks[16]) < touchThreshold,
    pinky: distance2D(landmarks[4], landmarks[20]) < touchThreshold
  };

  const extendedCount = Object.values(fingerExtended).filter(Boolean).length;
  const fingertipCluster =
    (distance2D(landmarks[4], landmarks[8]) +
      distance2D(landmarks[4], landmarks[12]) +
      distance2D(landmarks[4], landmarks[16]) +
      distance2D(landmarks[4], landmarks[20])) /
    (4 * palmSize);

  if (fingertipCluster < 0.64) {
    return 0;
  }

  if (thumbTouches.index && fingerExtended.middle && fingerExtended.ring && fingerExtended.pinky) {
    return 9;
  }

  if (thumbTouches.middle && fingerExtended.index && fingerExtended.ring && fingerExtended.pinky) {
    return 8;
  }

  if (thumbTouches.ring && fingerExtended.index && fingerExtended.middle && fingerExtended.pinky) {
    return 7;
  }

  if (thumbTouches.pinky && fingerExtended.index && fingerExtended.middle && fingerExtended.ring) {
    return 6;
  }

  if (extendedCount === 4 && thumbOpen) {
    return 5;
  }

  if (extendedCount === 4 && !thumbOpen) {
    return 4;
  }

  if (fingerExtended.index && fingerExtended.middle && !fingerExtended.ring && !fingerExtended.pinky && thumbOpen) {
    return 3;
  }

  if (fingerExtended.index && fingerExtended.middle && !fingerExtended.ring && !fingerExtended.pinky && !thumbOpen) {
    return 2;
  }

  if (fingerExtended.index && !fingerExtended.middle && !fingerExtended.ring && !fingerExtended.pinky) {
    return 1;
  }

  return null;
}

function updateGesture(digit) {
  if (digit === null) {
    return;
  }

  if (pendingDigit !== digit) {
    pendingDigit = digit;
    pendingFrames = 1;
    return;
  }

  pendingFrames += 1;
  if (pendingFrames < 4 || currentDigit === digit) {
    return;
  }

  currentDigit = digit;
  gestureValueEl.textContent = String(digit);
  gestureHintEl.textContent = "Digit locked. Hold steady to keep the countdown shape stable.";
  trackingStateEl.textContent = "Hand tracked";
  const { imageUrl, texture } = ensureDigitTexture(digit);
  digitPreviewEl.src = imageUrl;
  digitPreviewEl.dataset.loaded = "true";
  sceneController.setDigitTexture(digit, texture, imageUrl);
}

function resetGestureStatus() {
  if (performance.now() - lastLandmarkTime < 900) {
    return;
  }

  pendingDigit = null;
  pendingFrames = 0;
  trackingStateEl.textContent = "Searching for hand";
  if (currentDigit === null) {
    gestureHintEl.textContent = "Show one hand inside the camera frame with a number gesture from 0 to 9.";
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

    this.particleCount = 2200;
    this.particlePositions = new Float32Array(this.particleCount * 3);
    this.particleVelocities = new Float32Array(this.particleCount * 3);
    this.particleTargets = new Float32Array(this.particleCount * 3);
    this.particleColors = new Float32Array(this.particleCount * 3);
    this.paletteA = new THREE.Color(DIGIT_COLORS[0][0]);
    this.paletteB = new THREE.Color(DIGIT_COLORS[0][1]);
    this.morphToken = 0;

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
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });
    this.digitPoints = new THREE.Points(this.digitGeometry, this.digitMaterial);
    this.scene.add(this.digitPoints);

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

    this.clock = new THREE.Clock();
    this.handleResize();
    window.addEventListener("resize", () => this.handleResize());

    const initialEntry = ensureDigitTexture(0);
    this.setDigitTexture(0, initialEntry.texture, initialEntry.imageUrl);
    this.animate();
  }

  async setDigitTexture(digit, texture, imageUrl) {
    this.paletteA.set(DIGIT_COLORS[digit][0]);
    this.paletteB.set(DIGIT_COLORS[digit][1]);
    const currentToken = ++this.morphToken;

    let image = texture?.image;
    if (!image || !image.width) {
      try {
        image = await loadImageFromUrl(imageUrl);
      } catch {
        image = null;
      }
    }

    if (!image || currentToken !== this.morphToken) {
      return;
    }

    const { targets, tones } = buildDigitTargets(image, this.particleCount);
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

    this.digitGeometry.attributes.position.needsUpdate = true;
    this.bgGeometry.attributes.position.needsUpdate = true;

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.animate);
  };
}

const sceneController = new ParticleSceneController(sceneCanvas);
const initialDigit = ensureDigitTexture(0).imageUrl;
digitPreviewEl.src = initialDigit;

function drawHandResults(results) {
  const width = handCanvas.width;
  const height = handCanvas.height;
  handCanvasCtx.save();
  handCanvasCtx.clearRect(0, 0, width, height);
  handCanvasCtx.drawImage(results.image, 0, 0, width, height);

  if (results.multiHandLandmarks?.length) {
    for (const landmarks of results.multiHandLandmarks) {
      drawConnectors(handCanvasCtx, landmarks, HAND_CONNECTIONS, {
        color: "rgba(124, 245, 192, 0.85)",
        lineWidth: 4
      });
      drawLandmarks(handCanvasCtx, landmarks, {
        color: "rgba(255, 188, 125, 0.95)",
        fillColor: "rgba(8, 17, 31, 0.92)",
        lineWidth: 2,
        radius: 5
      });

      lastLandmarkTime = performance.now();
      const digit = classifyDigit(landmarks);
      updateGesture(digit);
    }
  } else {
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
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.65,
  selfieMode: true
});

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
  trackingStateEl.textContent = "Requesting camera";

  try {
    if (navigator.mediaDevices?.getUserMedia) {
      const warmupStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
        audio: false
      });
      for (const track of warmupStream.getTracks()) {
        track.stop();
      }
    }
  } catch {
    // MediaPipe camera may still recover if browser already granted permission previously.
  }

  const camera = new Camera(videoElement, {
    onFrame: async () => {
      try {
        await hands.send({ image: videoElement });
      } catch {
        trackingStateEl.textContent = "Tracking paused";
      }
    },
    width: 960,
    height: 720,
    facingMode: "user"
  });

  try {
    await camera.start();
    trackingStateEl.textContent = "Camera live";
    gestureHintEl.textContent = "Show one hand with a clear number gesture from 0 to 9.";
  } catch (error) {
    trackingStateEl.textContent = "Camera unavailable";
    gestureHintEl.textContent = "Camera start failed. Use localhost/HTTPS, grant permission, and verify no other app is locking the camera.";
    console.error(error);
  }
}

startCamera();

window.setInterval(resetGestureStatus, 250);