// Horror Game 3D - Three.js Engine
// Phase 1: Core Engine mit Scene, Camera, Renderer, Controls

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ===== GLOBALE VARIABLEN =====
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: PointerLockControls;
let clock = new THREE.Clock();

// Player State
const player = {
  speed: 5,
  sprintSpeed: 10,
  health: 100,
  sanity: 100,
  position: new THREE.Vector3(0, 1.7, 5),
  velocity: new THREE.Vector3(),
  direction: new THREE.Vector3()
};

// Input State
const input = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false
};

// ===== INIT =====
init();
animate();

function init() {
  console.log('🎮 Initializing Three.js Engine...');
  
  // Scene Setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050505);
  scene.fog = new THREE.FogExp2(0x0a0a0a, 0.05);
  
  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.copy(player.position);
  
  // Renderer
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.5;
  
  document.body.appendChild(renderer.domElement);
  
  // Controls
  controls = new PointerLockControls(camera, document.body);
  
  document.addEventListener('click', () => {
    if (!controls.isLocked) {
      controls.lock();
    }
  });
  
  controls.addEventListener('lock', () => {
    console.log('🔒 Controls locked');
    updateUI();
  });
  
  controls.addEventListener('unlock', () => {
    console.log('🔓 Controls unlocked');
    updateUI();
  });
  
  // Input Handlers
  setupInputHandlers();
  
  // Lighting
  setupLighting();
  
  // Environment
  createEnvironment();
  
  // Player Model (placeholder)
  createPlayerModel();
  
  // Resize Handler
  window.addEventListener('resize', onWindowResize);
  
  console.log('✅ Three.js Engine initialized');
  console.log('📊 Scene:', scene);
  console.log('📷 Camera:', camera);
  console.log('🎨 Renderer:', renderer);
}

function setupInputHandlers() {
  document.addEventListener('keydown', (event) => {
    switch (event.code) {
      case 'KeyW': input.forward = true; break;
      case 'KeyS': input.backward = true; break;
      case 'KeyA': input.left = true; break;
      case 'KeyD': input.right = true; break;
      case 'ShiftLeft': input.sprint = true; break;
    }
  });
  
  document.addEventListener('keyup', (event) => {
    switch (event.code) {
      case 'KeyW': input.forward = false; break;
      case 'KeyS': input.backward = false; break;
      case 'KeyA': input.left = false; break;
      case 'KeyD': input.right = false; break;
      case 'ShiftLeft': input.sprint = false; break;
    }
  });
}

function setupLighting() {
  // Ambient Light (dim for horror atmosphere)
  const ambientLight = new THREE.AmbientLight(0x1a0a0a, 0.5);
  scene.add(ambientLight);
  
  // Player Flashlight (Spotlight)
  const flashlight = new THREE.SpotLight(0xffffff, 2);
  flashlight.position.set(0, 0, 0);
  flashlight.angle = Math.PI / 6;
  flashlight.penumbra = 0.5;
  flashlight.decay = 2;
  flashlight.distance = 50;
  flashlight.castShadow = true;
  camera.add(flashlight);
  flashlight.target.position.set(0, 0, -1);
  camera.add(flashlight.target);
  scene.add(camera);
  
  // Point Lights (atmospheric)
  const pointLight1 = new THREE.PointLight(0xff6600, 1, 20);
  pointLight1.position.set(5, 3, 5);
  pointLight1.castShadow = true;
  scene.add(pointLight1);
  
  const pointLight2 = new THREE.PointLight(0x0066ff, 0.5, 15);
  pointLight2.position.set(-5, 2, -5);
  pointLight2.castShadow = true;
  scene.add(pointLight2);
}

function createEnvironment() {
  // Ground
  const groundGeometry = new THREE.PlaneGeometry(100, 100);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.8,
    metalness: 0.2
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  
  // Random Boxes/Walls (placeholder for now)
  for (let i = 0; i < 20; i++) {
    const width = Math.random() * 5 + 2;
    const height = Math.random() * 8 + 3;
    const depth = Math.random() * 5 + 2;
    
    const boxGeometry = new THREE.BoxGeometry(width, height, depth);
    const boxMaterial = new THREE.MeshStandardMaterial({
      color: Math.random() > 0.5 ? 0x3a1a1a : 0x1a2a3a,
      roughness: 0.9,
      metalness: 0.1
    });
    
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    box.position.set(
      (Math.random() - 0.5) * 80,
      height / 2,
      (Math.random() - 0.5) * 80
    );
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);
  }
}

function createPlayerModel() {
  // Placeholder player model (simple capsule)
  const geometry = new THREE.CapsuleGeometry(0.3, 1, 4, 8);
  const material = new THREE.MeshStandardMaterial({
    color: 0x00ff00,
    roughness: 0.5,
    metalness: 0.5
  });
  const playerMesh = new THREE.Mesh(geometry, material);
  playerMesh.position.copy(player.position);
  playerMesh.visible = false; // First-person view
  scene.add(playerMesh);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function updatePlayer(deltaTime: number) {
  if (!controls.isLocked) return;
  
  const speed = input.sprint ? player.sprintSpeed : player.speed;
  
  player.velocity.x -= player.velocity.x * 10.0 * deltaTime;
  player.velocity.z -= player.velocity.z * 10.0 * deltaTime;
  
  player.direction.z = Number(input.forward) - Number(input.backward);
  player.direction.x = Number(input.right) - Number(input.left);
  player.direction.normalize();
  
  if (input.forward || input.backward) {
    player.velocity.z -= player.direction.z * speed * 10.0 * deltaTime;
  }
  if (input.left || input.right) {
    player.velocity.x -= player.direction.x * speed * 10.0 * deltaTime;
  }
  
  controls.moveRight(-player.velocity.x * deltaTime);
  controls.moveForward(-player.velocity.z * deltaTime);
  
  // Update player position
  player.position.copy(camera.position);
}

function updateUI() {
  const ui = document.getElementById('ui');
  const crosshair = document.getElementById('crosshair');
  const locName = document.getElementById('loc-name');
  const healthBar = document.getElementById('health-bar');
  const sanityBar = document.getElementById('sanity-bar');
  const healthLabel = document.getElementById('health-label');
  const sanityLabel = document.getElementById('sanity-label');
  const sceneSelector = document.getElementById('scene-selector');
  
  if (controls.isLocked) {
    if (ui) ui.style.display = 'block';
    if (crosshair) crosshair.style.display = 'block';
    if (locName) locName.style.display = 'block';
    if (healthBar) healthBar.style.display = 'block';
    if (sanityBar) sanityBar.style.display = 'block';
    if (healthLabel) healthLabel.style.display = 'block';
    if (sanityLabel) sanityLabel.style.display = 'block';
    if (sceneSelector) sceneSelector.style.display = 'none';
  } else {
    if (ui) ui.style.display = 'none';
    if (crosshair) crosshair.style.display = 'none';
    if (locName) locName.style.display = 'none';
    if (healthBar) healthBar.style.display = 'none';
    if (sanityBar) sanityBar.style.display = 'none';
    if (healthLabel) healthLabel.style.display = 'none';
    if (sanityLabel) sanityLabel.style.display = 'none';
    if (sceneSelector) sceneSelector.style.display = 'block';
  }
}

function animate() {
  requestAnimationFrame(animate);
  
  const deltaTime = clock.getDelta();
  
  updatePlayer(deltaTime);
  
  renderer.render(scene, camera);
}

// Expose for debugging
(window as any).game = { scene, camera, renderer, controls, player };
