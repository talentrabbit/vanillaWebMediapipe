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

const digitTextures = new Map();
let currentDigit = null;
let pendingDigit = null;
let pendingFrames = 0;
let lastLandmarkTime = 0;

function distance2D(pointA, pointB) {
  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
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

function ensureDigitTexture(digit) {
  if (digitTextures.has(digit)) {
    return digitTextures.get(digit);
  }

  const imageUrl = createDigitPng(digit);
  const texture = new THREE.TextureLoader().load(imageUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  digitTextures.set(digit, { imageUrl, texture });
  return digitTextures.get(digit);
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
  gestureHintEl.textContent = "Gesture locked. Keep moving to swap PNG sets in the particle field.";
  trackingStateEl.textContent = "Hand tracked";
  const { imageUrl, texture } = ensureDigitTexture(digit);
  digitPreviewEl.src = imageUrl;
  digitPreviewEl.dataset.loaded = "true";
  sceneController.setDigitTexture(texture);
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
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    this.camera.position.set(0, 0, 10.8);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    const rimLight = new THREE.PointLight(0x7cf5c0, 18, 40, 2);
    rimLight.position.set(-3, 2, 8);
    this.scene.add(rimLight);

    const warmLight = new THREE.PointLight(0xffb57d, 20, 40, 2);
    warmLight.position.set(3.6, -1.5, 7.5);
    this.scene.add(warmLight);

    this.mainSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.96,
        depthWrite: false
      })
    );
    this.mainSprite.scale.set(3.3, 3.3, 1);
    this.mainSprite.position.set(0, 0, 0);
    this.scene.add(this.mainSprite);

    this.particleGroup = new THREE.Group();
    this.particles = [];
    this.scene.add(this.particleGroup);

    for (let index = 0; index < 160; index += 1) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.75,
          depthWrite: false
        })
      );
      const orbitRadius = THREE.MathUtils.randFloat(2.4, 5.8);
      const orbitSpeed = THREE.MathUtils.randFloat(0.2, 0.8);
      const orbitPhase = THREE.MathUtils.randFloat(0, Math.PI * 2);
      const lift = THREE.MathUtils.randFloat(-2.8, 2.8);
      const wobble = THREE.MathUtils.randFloat(0.2, 1.1);
      const baseScale = THREE.MathUtils.randFloat(0.18, 0.68);

      sprite.scale.set(baseScale, baseScale, 1);
      this.particleGroup.add(sprite);
      this.particles.push({ sprite, orbitRadius, orbitSpeed, orbitPhase, lift, wobble, baseScale });
    }

    this.clock = new THREE.Clock();
    this.setDigitTexture(ensureDigitTexture(0).texture);
    this.handleResize();
    window.addEventListener("resize", () => this.handleResize());
    this.animate();
  }

  setDigitTexture(texture) {
    this.mainSprite.material.map = texture;
    this.mainSprite.material.needsUpdate = true;

    for (const particle of this.particles) {
      particle.sprite.material.map = texture;
      particle.sprite.material.needsUpdate = true;
    }
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
    this.mainSprite.material.rotation = elapsed * 0.14;
    this.mainSprite.position.y = Math.sin(elapsed * 1.1) * 0.18;

    for (const particle of this.particles) {
      const angle = elapsed * particle.orbitSpeed + particle.orbitPhase;
      particle.sprite.position.set(
        Math.cos(angle) * particle.orbitRadius,
        particle.lift + Math.sin(angle * 1.7) * particle.wobble,
        Math.sin(angle * 0.75) * 1.2
      );
      particle.sprite.material.opacity = 0.35 + (Math.sin(angle * 2.3) + 1) * 0.22;
      const pulse = 0.86 + (Math.sin(angle * 3.4) + 1) * 0.12;
      particle.sprite.scale.setScalar(particle.baseScale * pulse + particle.orbitRadius * 0.04);
    }

    this.particleGroup.rotation.y = elapsed * 0.08;
    this.particleGroup.rotation.x = Math.sin(elapsed * 0.3) * 0.12;

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

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 960,
  height: 720
});

camera
  .start()
  .then(() => {
    trackingStateEl.textContent = "Camera live";
  })
  .catch((error) => {
    trackingStateEl.textContent = "Camera unavailable";
    gestureHintEl.textContent = "Camera access failed. Serve this page from localhost or HTTPS and allow permission prompts.";
    console.error(error);
  });

window.setInterval(resetGestureStatus, 250);