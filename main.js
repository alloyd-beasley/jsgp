import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// Game state
const gameState = {
  speed: 0,
  maxSpeed: 200,
  acceleration: 0.2,
  deceleration: 0.1,
  brakeForce: 0.8,
  handling: 0.03,
  gear: 1,
  isMoving: false,
  keysPressed: {},
  isBraking: false,
  prevSpeed: 0,
  prevGear: 1,
  rpmPerGear: [0, 0, 0, 0, 0, 0, 0], // Store RPM for each gear (0-indexed, but we'll use 1-6)
  gearChangeTime: 0,
  lastGearChangeSpeed: 0, // Track speed at last gear change
};

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue background

// Camera setup
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 5, 10);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById("game-container").appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Ground plane with racing track
const groundSize = 1000;
const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, 1, 1);

// Create racing track texture
const textureSize = 2048;
const canvas = document.createElement("canvas");
canvas.width = textureSize;
canvas.height = textureSize;
const context = canvas.getContext("2d");

// Fill with grass color
context.fillStyle = "#4CAF50"; // Green grass
context.fillRect(0, 0, textureSize, textureSize);

// Draw oval racing track
const centerX = textureSize / 2;
const centerY = textureSize / 2;
const trackWidth = textureSize * 0.1; // Width of the track
const outerRadiusX = textureSize * 0.4; // Horizontal radius of outer edge
const outerRadiusY = textureSize * 0.3; // Vertical radius of outer edge
const innerRadiusX = outerRadiusX - trackWidth;
const innerRadiusY = outerRadiusY - trackWidth;

// Draw asphalt (track surface)
context.fillStyle = "#333333"; // Dark gray for asphalt
context.beginPath();
// Outer edge of track
for (let angle = 0; angle < Math.PI * 2; angle += 0.01) {
  const x = centerX + Math.cos(angle) * outerRadiusX;
  const y = centerY + Math.sin(angle) * outerRadiusY;
  if (angle === 0) {
    context.moveTo(x, y);
  } else {
    context.lineTo(x, y);
  }
}
context.closePath();

// Inner edge of track (create hole)
context.arc(centerX, centerY, innerRadiusX, 0, Math.PI * 2, true);
context.fill("evenodd");

// Draw track markings (white lines)
context.strokeStyle = "#FFFFFF";
context.lineWidth = textureSize * 0.005;

// Outer edge line
context.beginPath();
for (let angle = 0; angle < Math.PI * 2; angle += 0.01) {
  const x = centerX + Math.cos(angle) * outerRadiusX;
  const y = centerY + Math.sin(angle) * outerRadiusY;
  if (angle === 0) {
    context.moveTo(x, y);
  } else {
    context.lineTo(x, y);
  }
}
context.closePath();
context.stroke();

// Inner edge line
context.beginPath();
for (let angle = 0; angle < Math.PI * 2; angle += 0.01) {
  const x = centerX + Math.cos(angle) * innerRadiusX;
  const y = centerY + Math.sin(angle) * innerRadiusY;
  if (angle === 0) {
    context.moveTo(x, y);
  } else {
    context.lineTo(x, y);
  }
}
context.closePath();
context.stroke();

// Draw center line
const centerRadiusX = (outerRadiusX + innerRadiusX) / 2;
const centerRadiusY = (outerRadiusY + innerRadiusY) / 2;
context.setLineDash([textureSize * 0.02, textureSize * 0.02]); // Dashed line
context.beginPath();
for (let angle = 0; angle < Math.PI * 2; angle += 0.01) {
  const x = centerX + Math.cos(angle) * centerRadiusX;
  const y = centerY + Math.sin(angle) * centerRadiusY;
  if (angle === 0) {
    context.moveTo(x, y);
  } else {
    context.lineTo(x, y);
  }
}
context.closePath();
context.stroke();

// Draw start/finish line
context.setLineDash([]); // Solid line
context.lineWidth = trackWidth * 0.5;
context.beginPath();
context.moveTo(centerX + innerRadiusX, centerY);
context.lineTo(centerX + outerRadiusX, centerY);
context.stroke();

// Create checkered pattern near start/finish line
const checkerWidth = trackWidth * 0.5;
const checkerCount = 8;
context.fillStyle = "#FFFFFF";
for (let i = 0; i < checkerCount; i++) {
  if (i % 2 === 0) {
    const startX = centerX + innerRadiusX + (i * trackWidth) / checkerCount;
    context.fillRect(
      startX,
      centerY - checkerWidth / 2,
      trackWidth / checkerCount,
      checkerWidth
    );
  }
}

const texture = new THREE.CanvasTexture(canvas);
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
texture.repeat.set(1, 1); // Don't repeat the texture

const groundMaterial = new THREE.MeshStandardMaterial({
  map: texture,
  roughness: 0.8,
  metalness: 0.2,
});

const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Create a simple F1-style car
function createCar() {
  const car = new THREE.Group();

  // Main body (chassis) - rotated 90 degrees
  const bodyGeometry = new THREE.BoxGeometry(2, 0.5, 4); // Swapped width and depth
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // Red car
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.5;
  body.castShadow = true;
  car.add(body);

  // Cockpit - rotated 90 degrees
  const cockpitGeometry = new THREE.BoxGeometry(1, 0.5, 1.5); // Swapped width and depth
  const cockpitMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
  cockpit.position.set(0, 0.75, 0);
  cockpit.castShadow = true;
  car.add(cockpit);

  // Front wing - rotated 90 degrees
  const frontWingGeometry = new THREE.BoxGeometry(2.2, 0.1, 1); // Swapped width and depth
  const frontWingMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const frontWing = new THREE.Mesh(frontWingGeometry, frontWingMaterial);
  frontWing.position.set(0, 0.3, 2); // Changed position to front (positive Z)
  frontWing.castShadow = true;
  car.add(frontWing);

  // Rear wing - rotated 90 degrees
  const rearWingGeometry = new THREE.BoxGeometry(2.2, 0.8, 0.8); // Swapped width and depth
  const rearWingMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const rearWing = new THREE.Mesh(rearWingGeometry, rearWingMaterial);
  rearWing.position.set(0, 0.8, -2); // Changed position to rear (negative Z)
  rearWing.castShadow = true;
  car.add(rearWing);

  // Wheels - repositioned for 90 degree rotation
  const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 32);
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });

  const frontLeftWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  frontLeftWheel.rotation.z = Math.PI / 2;
  frontLeftWheel.position.set(1, 0.4, 1.5); // Repositioned
  frontLeftWheel.castShadow = true;
  car.add(frontLeftWheel);

  const frontRightWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  frontRightWheel.rotation.z = Math.PI / 2;
  frontRightWheel.position.set(-1, 0.4, 1.5); // Repositioned
  frontRightWheel.castShadow = true;
  car.add(frontRightWheel);

  const rearLeftWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  rearLeftWheel.rotation.z = Math.PI / 2;
  rearLeftWheel.position.set(1, 0.4, -1.5); // Repositioned
  rearLeftWheel.castShadow = true;
  car.add(rearLeftWheel);

  const rearRightWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  rearRightWheel.rotation.z = Math.PI / 2;
  rearRightWheel.position.set(-1, 0.4, -1.5); // Repositioned
  rearRightWheel.castShadow = true;
  car.add(rearRightWheel);

  return car;
}

const car = createCar();
scene.add(car);

// Camera follow setup
const cameraOffset = new THREE.Vector3(0, 3, 10); // Positive Z value
const cameraTarget = new THREE.Vector3(0, 0, 0);

// Controls for debugging (will be disabled during gameplay)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enabled = false; // Disable for gameplay

// Input handling
window.addEventListener("keydown", (e) => {
  gameState.keysPressed[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup", (e) => {
  gameState.keysPressed[e.key.toLowerCase()] = false;
});

// Handle window resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Update HUD
function updateHUD() {
  document.getElementById("speed").textContent = `${Math.round(
    gameState.speed
  )} km/h`;
  document.getElementById("gear").textContent = `Gear: ${gameState.gear}`;
}

// Sound setup
const audioListener = new THREE.AudioListener();
camera.add(audioListener);

// Create audio context (needed for browser autoplay policies)
let audioContext;

// Engine sound
const engineSound = new THREE.Audio(audioListener);
scene.add(engineSound);

// Braking sound
const brakeSound = new THREE.Audio(audioListener);
scene.add(brakeSound);

// Tire squeal sound (for sharp turns)
const tireSquealSound = new THREE.Audio(audioListener);
scene.add(tireSquealSound);

// Sound generators
let engineSoundGen = null;
let brakeSoundGen = null;
let tireSoundGen = null;

// Initialize sounds on first user interaction
function initSounds() {
  if (!engineSoundGen) {
    engineSoundGen = createEngineSound();
    brakeSoundGen = createNoiseGenerator();
    tireSoundGen = createNoiseGenerator();

    // Set initial volumes
    engineSoundGen.setVolume(0);
    brakeSoundGen.setVolume(0);
    tireSoundGen.setVolume(0);

    console.log("Sounds initialized!");
  }
}

// Add event listeners to initialize audio on user interaction
window.addEventListener("click", initSounds);
window.addEventListener("keydown", initSounds);

// Create oscillator for engine sound (no need for external files)
function createEngineSound() {
  if (!audioContext) {
    audioContext = THREE.AudioContext.getContext();
  }

  // Create multiple oscillators for a richer engine sound
  const oscillators = [];
  const gainNodes = [];

  // Main oscillator (fundamental frequency)
  const mainOsc = audioContext.createOscillator();
  mainOsc.type = "sawtooth";
  mainOsc.frequency.setValueAtTime(80, audioContext.currentTime);

  // Main gain node
  const mainGain = audioContext.createGain();
  mainGain.gain.setValueAtTime(0.15, audioContext.currentTime);

  // Connect main oscillator
  mainOsc.connect(mainGain);
  oscillators.push(mainOsc);
  gainNodes.push(mainGain);

  // Create harmonics for richer sound
  const harmonics = [2, 3, 4, 5.5, 8];
  const harmonicGains = [0.5, 0.4, 0.3, 0.2, 0.1]; // Decreasing volume for higher harmonics

  for (let i = 0; i < harmonics.length; i++) {
    const osc = audioContext.createOscillator();
    osc.type = i % 2 === 0 ? "sawtooth" : "square"; // Alternate between sawtooth and square
    osc.frequency.setValueAtTime(80 * harmonics[i], audioContext.currentTime);

    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.15 * harmonicGains[i], audioContext.currentTime);

    osc.connect(gain);
    oscillators.push(osc);
    gainNodes.push(gain);
  }

  // Create noise component for engine roughness
  const noiseBuffer = audioContext.createBuffer(
    1,
    audioContext.sampleRate * 2,
    audioContext.sampleRate
  );
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseBuffer.length; i++) {
    noiseData[i] = Math.random() * 2 - 1;
  }

  const noise = audioContext.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;

  // Bandpass filter for noise to match engine frequency
  const noiseFilter = audioContext.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(80, audioContext.currentTime);
  noiseFilter.Q.value = 1;

  const noiseGain = audioContext.createGain();
  noiseGain.gain.setValueAtTime(0.05, audioContext.currentTime);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  oscillators.push(noise);
  gainNodes.push(noiseGain);

  // Create master gain node
  const masterGain = audioContext.createGain();
  masterGain.gain.setValueAtTime(0, audioContext.currentTime);

  // Connect all gain nodes to master
  for (const gain of gainNodes) {
    gain.connect(masterGain);
  }

  // Add subtle distortion for more aggressive sound
  const distortion = audioContext.createWaveShaper();
  function makeDistortionCurve(amount) {
    const k = typeof amount === "number" ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  distortion.curve = makeDistortionCurve(50);
  distortion.oversample = "4x";

  // Add compression for more punch
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-24, audioContext.currentTime);
  compressor.knee.setValueAtTime(30, audioContext.currentTime);
  compressor.ratio.setValueAtTime(12, audioContext.currentTime);
  compressor.attack.setValueAtTime(0.003, audioContext.currentTime);
  compressor.release.setValueAtTime(0.25, audioContext.currentTime);

  // Connect the processing chain
  masterGain.connect(distortion);
  distortion.connect(compressor);
  compressor.connect(audioContext.destination);

  // Start all oscillators
  for (const osc of oscillators) {
    osc.start();
  }

  return {
    oscillators,
    gainNodes,
    noiseFilter,
    masterGain,
    setFrequency(freq) {
      // Set frequency for all oscillators
      for (let i = 0; i < oscillators.length - 1; i++) {
        // Skip noise
        if (i === 0) {
          oscillators[i].frequency.setValueAtTime(
            freq,
            audioContext.currentTime
          );
        } else {
          // Harmonics follow the fundamental with slight detuning for richness
          const detune = Math.random() * 10 - 5; // Small random detune
          const harmonic = i < harmonics.length ? harmonics[i - 1] : 1;
          oscillators[i].frequency.setValueAtTime(
            freq * harmonic + detune,
            audioContext.currentTime
          );
        }
      }
      // Update noise filter to match engine frequency
      noiseFilter.frequency.setValueAtTime(freq * 3, audioContext.currentTime);
    },
    setVolume(volume) {
      masterGain.gain.setValueAtTime(volume, audioContext.currentTime);
    },
    setRPM(rpm) {
      // Simulate engine characteristics at different RPMs
      const normalizedRPM = rpm / 10000; // Normalize to 0-1 range

      // Adjust harmonic balance based on RPM
      for (let i = 1; i < gainNodes.length - 1; i++) {
        const harmonic = i < harmonicGains.length ? harmonicGains[i - 1] : 0.1;
        // Higher harmonics become more prominent at higher RPMs
        const rpmFactor = i <= 2 ? 1 - normalizedRPM * 0.5 : normalizedRPM;
        gainNodes[i].gain.setValueAtTime(
          volume * harmonic * rpmFactor,
          audioContext.currentTime
        );
      }

      // Noise becomes more prominent at higher RPMs
      const noiseVolume = 0.05 + normalizedRPM * 0.1;
      gainNodes[gainNodes.length - 1].gain.setValueAtTime(
        noiseVolume,
        audioContext.currentTime
      );
    },
    stop() {
      for (const osc of oscillators) {
        osc.stop();
      }
    },
  };
}

// Create noise for brake and tire sounds
function createNoiseGenerator() {
  if (!audioContext) {
    audioContext = THREE.AudioContext.getContext();
  }

  // Create buffer for white noise
  const bufferSize = 2 * audioContext.sampleRate;
  const noiseBuffer = audioContext.createBuffer(
    1,
    bufferSize,
    audioContext.sampleRate
  );
  const output = noiseBuffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }

  // Create noise source
  const noise = audioContext.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;

  // Create bandpass filter for tire squeal
  const bandpass = audioContext.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 2000;
  bandpass.Q.value = 10;

  // Create gain node for volume control
  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);

  // Connect nodes
  noise.connect(bandpass);
  bandpass.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Start noise
  noise.start();

  return {
    noise,
    gainNode,
    setVolume(volume) {
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    },
    stop() {
      noise.stop();
    },
  };
}

// Function to update sounds based on car state
function updateSounds() {
  if (!engineSoundGen) return;

  // Engine sound
  if (Math.abs(gameState.speed) > 0.1) {
    // Calculate RPM based on speed and gear
    const maxRPM = 12000; // F1 engines can rev very high
    const minRPM = 1000;
    const gearRatios = [0, 0.9, 0.7, 0.5, 0.35, 0.25, 0.2]; // Gear ratios (0-indexed, but we'll use 1-6)
    const gearRatio = gearRatios[gameState.gear];
    const speedFactor = Math.abs(gameState.speed) / gameState.maxSpeed;

    // Calculate RPM with more realistic gear behavior
    // Each gear has its own RPM range
    const gearMaxSpeed = gameState.maxSpeed * gearRatio;
    const gearSpeedFactor = Math.min(
      1,
      Math.abs(gameState.speed) / gearMaxSpeed
    );

    // RPM calculation with more realistic gear influence
    let rpm = minRPM + gearSpeedFactor * (maxRPM - minRPM);

    // Store RPM for this gear
    gameState.rpmPerGear[gameState.gear] = rpm;

    // Check for gear change
    const now = performance.now();
    const gearChanged = gameState.gear !== gameState.prevGear;
    if (gearChanged) {
      gameState.gearChangeTime = now;
      gameState.lastGearChangeSpeed = gameState.speed;
    }

    // Simulate gear change sound (slight drop in RPM during shift)
    const timeSinceGearChange = now - gameState.gearChangeTime;
    if (timeSinceGearChange < 300) {
      // 300ms gear change effect
      // Drop RPM during gear change
      const dropFactor = 1 - Math.exp(-timeSinceGearChange / 100) * 0.3;
      rpm *= dropFactor;
    }

    // Base frequency based on RPM, but with less dramatic changes
    // Use a more moderate mapping from RPM to frequency
    const baseFreq = 30 + (rpm / maxRPM) * 120; // More subtle frequency range

    // Set the frequency
    engineSoundGen.setFrequency(baseFreq);

    // Adjust volume based on speed and acceleration
    const isAccelerating = gameState.speed > gameState.prevSpeed;
    const isDecelerating = gameState.speed < gameState.prevSpeed;
    let volumeBase = 0.05 + speedFactor * 0.2;

    // Increase volume slightly when accelerating, decrease when decelerating
    let volume = volumeBase;
    if (isAccelerating) {
      volume = volumeBase * 1.2;
    } else if (isDecelerating) {
      volume = volumeBase * 0.8;
    }

    engineSoundGen.setVolume(volume);
    engineSoundGen.setRPM(rpm);

    // Store previous gear for next frame
    gameState.prevGear = gameState.gear;
  } else {
    // Idle sound
    engineSoundGen.setFrequency(30);
    engineSoundGen.setVolume(0.05);
    engineSoundGen.setRPM(800);
  }

  // Brake sound
  if (gameState.isBraking && Math.abs(gameState.speed) > 10) {
    const brakeVolume = Math.min(
      0.3,
      (Math.abs(gameState.speed) / gameState.maxSpeed) * 0.3
    );
    brakeSoundGen.setVolume(brakeVolume);
  } else {
    brakeSoundGen.setVolume(0);
  }

  // Tire squeal for sharp turns
  if (
    gameState.isMoving &&
    (gameState.keysPressed["a"] ||
      gameState.keysPressed["arrowleft"] ||
      gameState.keysPressed["d"] ||
      gameState.keysPressed["arrowright"]) &&
    Math.abs(gameState.speed) > 50
  ) {
    // Adjust volume based on speed and turning sharpness
    const turnVolume = Math.min(
      0.2,
      (Math.abs(gameState.speed) / gameState.maxSpeed) * 0.2
    );
    tireSoundGen.setVolume(turnVolume);
  } else {
    tireSoundGen.setVolume(0);
  }
}

// Handle car movement
function handleCarMovement() {
  // Store previous speed for sound effects
  gameState.prevSpeed = gameState.speed;

  // Forward/backward movement
  if (gameState.keysPressed["w"] || gameState.keysPressed["arrowup"]) {
    gameState.speed += gameState.acceleration;
    gameState.isMoving = true;
  } else if (gameState.keysPressed["s"] || gameState.keysPressed["arrowdown"]) {
    gameState.speed -= gameState.acceleration;
    gameState.isMoving = true;
  } else {
    // Natural deceleration
    if (gameState.speed > 0) {
      gameState.speed -= gameState.deceleration;
    } else if (gameState.speed < 0) {
      gameState.speed += gameState.deceleration;
    }

    // Stop completely if speed is very low
    if (Math.abs(gameState.speed) < 0.1) {
      gameState.speed = 0;
      gameState.isMoving = false;
    }
  }

  // Brake - track if braking for sound effects
  gameState.isBraking =
    gameState.keysPressed[" "] && Math.abs(gameState.speed) > 1;

  if (gameState.keysPressed[" "]) {
    if (gameState.speed > 0) {
      gameState.speed -= gameState.brakeForce;
    } else if (gameState.speed < 0) {
      gameState.speed += gameState.brakeForce;
    }
  }

  // Limit speed
  gameState.speed = Math.max(
    -gameState.maxSpeed / 2,
    Math.min(gameState.maxSpeed, gameState.speed)
  );

  // Update gear based on speed with more realistic gear shifting
  // Define speed thresholds for each gear (as percentage of max speed)
  const gearThresholds = [0, 0.15, 0.3, 0.45, 0.6, 0.75];
  const speedPercent = Math.abs(gameState.speed) / gameState.maxSpeed;

  // Find appropriate gear based on speed
  let newGear = 1;
  for (let i = 5; i >= 1; i--) {
    if (speedPercent >= gearThresholds[i]) {
      newGear = i + 1;
      break;
    }
  }

  // Only shift up when RPM is high enough
  if (newGear > gameState.gear) {
    const currentRPM = gameState.rpmPerGear[gameState.gear];
    const upshiftRPM = 10000; // RPM threshold for upshifting
    if (currentRPM < upshiftRPM) {
      newGear = gameState.gear;
    }

    // Prevent skipping gears when upshifting
    if (newGear > gameState.gear + 1) {
      newGear = gameState.gear + 1;
    }
  }

  // Don't shift down too quickly
  if (newGear < gameState.gear) {
    const downshiftDelay = 500; // ms
    const now = performance.now();
    if (now - gameState.gearChangeTime < downshiftDelay) {
      newGear = gameState.gear;
    }

    // Prevent skipping gears when downshifting
    if (newGear < gameState.gear - 1) {
      newGear = gameState.gear - 1;
    }

    // Only downshift if speed has decreased enough from last gear change
    const speedDrop = gameState.lastGearChangeSpeed - Math.abs(gameState.speed);
    if (speedDrop < 10) {
      // Require at least 10 km/h drop in speed to downshift
      newGear = gameState.gear;
    }
  }

  gameState.gear = Math.max(1, Math.min(6, newGear));

  // Turning
  if (gameState.isMoving) {
    if (gameState.keysPressed["a"] || gameState.keysPressed["arrowleft"]) {
      car.rotation.y += gameState.handling * (gameState.speed > 0 ? 1 : -1);
    }
    if (gameState.keysPressed["d"] || gameState.keysPressed["arrowright"]) {
      car.rotation.y -= gameState.handling * (gameState.speed > 0 ? 1 : -1);
    }
  }

  // Move car forward/backward
  const moveDistance = gameState.speed * 0.01;
  car.position.x += Math.sin(car.rotation.y) * moveDistance;
  car.position.z += Math.cos(car.rotation.y) * moveDistance;

  // Update camera position to follow car from behind
  // Calculate position directly behind the car based on its rotation
  const angle = car.rotation.y + Math.PI; // Add PI (180 degrees) to position camera behind
  const distance = cameraOffset.z;

  // Set camera position
  camera.position.x = car.position.x + Math.sin(angle) * distance;
  camera.position.y = car.position.y + cameraOffset.y;
  camera.position.z = car.position.z + Math.cos(angle) * distance;

  // Update camera target to look at the car
  cameraTarget.copy(car.position);
  cameraTarget.y += 1;
  camera.lookAt(cameraTarget);

  // Update HUD
  updateHUD();
}

// Hide loading screen when everything is ready
function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loading-screen");
  loadingScreen.style.opacity = "0";
  setTimeout(() => {
    loadingScreen.style.display = "none";
  }, 500);
}

// Simulate loading progress
let progress = 0;
const loadingInterval = setInterval(() => {
  progress += Math.random() * 10;
  if (progress >= 100) {
    progress = 100;
    clearInterval(loadingInterval);
    hideLoadingScreen();
  }
  ``;
  document.querySelector(".loading-progress").style.width = `${progress}%`;
}, 200);

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  handleCarMovement();
  updateSounds();

  renderer.render(scene, camera);
}

animate();
