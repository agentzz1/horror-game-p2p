// Horror Game 3D - Triple-A Environment
// Three.js mit Ambient Occlusion, Screen Space Reflections, Wetter-Effekten
// Phase 5: Multiplayer mit WebRTC Data Channels

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { SSAOEffect } from 'three/addons/effects/SSAOEffect.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { initNetwork, sendPlayerState, validateLocalState, getInterpolatedPlayerState, getAllRemotePlayerStates, createRoom, joinRoom, leaveRoom, networkState } from './network.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ===== GLOBALE VARIABLEN =====
let scene, camera, renderer, composer, controls;
let currentScene = 'house';
let player = { speed: 5, sprintSpeed: 10, health: 100, sanity: 100 };
let ghosts = [];
let interactables = [];
let weather = { rain: true, fog: true, intensity: 0.8 };
let clock = new THREE.Clock();

// Multiplayer State
let lastPlayerState = null;
let stateUpdateTimer = 0;
const STATE_UPDATE_INTERVAL = 50; // ms
let remotePlayerMeshes = new Map(); // playerId -> mesh

// ===== SZENEN KONFIGURATION =====
const scenes = {
    house: {
        name: 'Verlassenes Haus',
        ambientColor: 0x1a0a0a,
        fogColor: 0x0a0a0a,
        fogDensity: 0.05,
        groundTexture: 'wood',
        lighting: 'dim'
    },
    graveyard: {
        name: 'Alter Friedhof',
        ambientColor: 0x0a1a2a,
        fogColor: 0x1a1a2a,
        fogDensity: 0.08,
        groundTexture: 'grass',
        lighting: 'dark'
    },
    forest: {
        name: 'Dunkler Wald',
        ambientColor: 0x0a2a0a,
        fogColor: 0x0a1a0a,
        fogDensity: 0.1,
        groundTexture: 'dirt',
        lighting: 'very_dark'
    }
};

// ===== INIT =====
init();
animate();

function init() {
    // Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.FogExp2(scenes[currentScene].fogColor, scenes[currentScene].fogDensity);
    
    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.7, 5);
    
    // Renderer mit SSAO und SSR
    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('canvas'),
        antialias: false,
        powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.5;
    
    // Controls (FPS Style)
    controls = new PointerLockControls(camera, document.body);
    document.addEventListener('click', () => controls.lock());
    
    // Multiplayer Network Initialisierung
    initNetwork();
    setupMultiplayerUI();
    
    // Post Processing - SSAO + Bloom + Color Grading + Vignette
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    // SSAO (Ambient Occlusion)
    const ssaoEffect = new SSAOEffect(scene, camera, {
        kernelRadius: 16,
        samples: 16,
        screenSpaceRadius: true,
        luminanceInfluence: 0.4
    });
    composer.addPass(new ShaderPass(ssaoEffect));
    
    // Bloom (Leuchtende Lichter)
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.5,  // strength
        0.4,  // radius
        0.85  // threshold
    );
    composer.addPass(bloomPass);
    
    // Color Grading (Horror LUT - düstere Farben)
    const colorGradingUniforms = {
        'tDiffuse': { value: null },
        'contrast': { value: 1.2 },
        'saturation': { value: 0.7 },
        'brightness': { value: 0.9 },
        'redShift': { value: 0.05 },
        'greenShift': { value: -0.02 },
        'blueShift': { value: -0.08 }
    };
    const colorGradingShader = {
        uniforms: colorGradingUniforms,
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform float contrast;
            uniform float saturation;
            uniform float brightness;
            uniform float redShift;
            uniform float greenShift;
            uniform float blueShift;
            varying vec2 vUv;
            
            void main() {
                vec4 color = texture2D(tDiffuse, vUv);
                
                // Contrast
                color.rgb = (color.rgb - 0.5) * contrast + 0.5;
                
                // Saturation
                float luminance = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
                color.rgb = mix(vec3(luminance), color.rgb, saturation);
                
                // Brightness
                color.rgb *= brightness;
                
                // Color Shift (Horror Look - mehr rot/blau, weniger grün)
                color.r += redShift;
                color.g += greenShift;
                color.b += blueShift;
                
                gl_FragColor = color;
            }
        `
    };
    composer.addPass(new ShaderPass(colorGradingShader));
    
    // Vignette (dunkle Ecken für Horror-Atmosphäre)
    const vignetteUniforms = {
        'tDiffuse': { value: null },
        'darkness': { value: 1.0 },
        'offset': { value: 1.0 }
    };
    const vignetteShader = {
        uniforms: vignetteUniforms,
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform float darkness;
            uniform float offset;
            varying vec2 vUv;
            
            void main() {
                vec4 color = texture2D(tDiffuse, vUv);
                vec2 uv = vUv * 2.0 - 1.0;
                float dist = length(uv);
                float vig = smoothstep(0.4, 0.8 * offset, dist) * darkness;
                color.rgb *= 1.0 - vig;
                gl_FragColor = color;
            }
        `
    };
    composer.addPass(new ShaderPass(vignetteShader));
    
    // Beleuchtung
    setupLighting();
    
    // Umgebung erstellen
    createEnvironment();
    
    // Spieler Controller
    setupPlayer();
    
    // Wetter-Effekte
    createWeatherEffects();
    
    // Geister erstellen
    createGhosts();
    
    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
}

// ===== BELEUCHTUNG =====
function setupLighting() {
    const config = scenes[currentScene];
    
    // Ambient Light (sehr dunkel für Horror-Atmosphäre)
    const ambient = new THREE.AmbientLight(config.ambientColor, 0.3);
    scene.add(ambient);
    
    // Point Lights als spärliche Lichtquellen
    const lightPositions = [
        [3, 2.5, 3], [-3, 2.5, -3], [0, 3, -5]
    ];
    
    lightPositions.forEach(([x, y, z], i) => {
        const light = new THREE.PointLight(0xffaa00, 1, 15);
        light.position.set(x, y, z);
        light.castShadow = true;
        light.shadow.mapSize.width = 1024;
        light.shadow.mapSize.height = 1024;
        scene.add(light);
        
        // Flackern simulieren
        if (i === 0) {
            setInterval(() => {
                light.intensity = 0.5 + Math.random() * 1;
            }, 100 + Math.random() * 200);
        }
    });
    
    // Spotlight für dramatische Effekte
    const spotlight = new THREE.SpotLight(0xffffff, 2);
    spotlight.position.set(0, 10, 0);
    spotlight.angle = Math.PI / 6;
    spotlight.penumbra = 0.5;
    spotlight.castShadow = true;
    scene.add(spotlight);
}

// ===== UMGEBUNG =====
function createEnvironment() {
    const config = scenes[currentScene];
    
    // Boden
    const groundGeo = new THREE.PlaneGeometry(100, 100, 128, 128);
    
    // Heightmap für Terrain
    const vertices = groundGeo.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];
        // Procedural terrain noise
        vertices[i + 2] = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.5 
                        + Math.sin(x * 0.3 + y * 0.2) * 0.2;
    }
    groundGeo.computeVertexNormals();
    
    const groundMat = new THREE.StandardMaterial({ 
        color: config.groundTexture === 'wood' ? 0x3d2817 :
               config.groundTexture === 'grass' ? 0x1a3d1a : 0x2a1a0a,
        roughness: 0.9,
        metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Szenen-spezifische Objekte
    if (currentScene === 'house') createHouse();
    else if (currentScene === 'graveyard') createGraveyard();
    else if (currentScene === 'forest') createForest();
}

function createHouse() {
    // Hauptgebäude
    const houseGeo = new THREE.BoxGeometry(8, 4, 6);
    const houseMat = new THREE.StandardMaterial({ 
        color: 0x2a1a1a, 
        roughness: 0.95,
        metalness: 0.05
    });
    const house = new THREE.Mesh(houseGeo, houseMat);
    house.position.set(0, 2, -8);
    house.castShadow = true;
    house.receiveShadow = true;
    scene.add(house);
    
    // Dach
    const roofGeo = new THREE.ConeGeometry(6, 3, 4);
    const roofMat = new THREE.StandardMaterial({ color: 0x1a0a0a, roughness: 0.9 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, 5, -8);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    scene.add(roof);
    
    // Türen (Interactable)
    const doorGeo = new THREE.BoxGeometry(1.5, 2.5, 0.1);
    const doorMat = new THREE.StandardMaterial({ color: 0x4a2a1a });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 1.25, -4.95);
    door.userData = { type: 'door', open: false };
    interactables.push(door);
    scene.add(door);
    
    // Fenster mit schwachem Licht
    const windowPositions = [[-2, 2.5, -4.9], [2, 2.5, -4.9]];
    windowPositions.forEach(([x, y, z]) => {
        const winGeo = new THREE.BoxGeometry(1, 1.2, 0.1);
        const winMat = new THREE.MeshStandardMaterial({ 
            color: 0xffaa00, 
            emissive: 0xffaa00,
            emissiveIntensity: 0.3
        });
        const win = new THREE.Mesh(winGeo, winMat);
        win.position.set(x, y, z);
        scene.add(win);
    });
    
    document.getElementById('loc-name').textContent = 'Haus Eingang';
}

function createGraveyard() {
    // Grabsteine
    for (let i = 0; i < 30; i++) {
        const height = 0.5 + Math.random() * 1.5;
        const tombGeo = new THREE.BoxGeometry(0.3, height, 0.1);
        const tombMat = new THREE.StandardMaterial({ color: 0x3a3a3a, roughness: 0.8 });
        const tomb = new THREE.Mesh(tombGeo, tombMat);
        
        const angle = (i / 30) * Math.PI * 2;
        const radius = 10 + Math.random() * 15;
        tomb.position.set(
            Math.cos(angle) * radius,
            height / 2,
            Math.sin(angle) * radius - 10
        );
        tomb.rotation.y = -angle;
        tomb.castShadow = true;
        scene.add(tomb);
    }
    
    // Altes Kreuz
    const crossV = new THREE.BoxGeometry(0.2, 3, 0.2);
    const crossH = new THREE.BoxGeometry(1.2, 0.2, 0.2);
    const crossMat = new THREE.StandardMaterial({ color: 0x2a2a2a });
    
    const crossVertical = new THREE.Mesh(crossV, crossMat);
    const crossHorizontal = new THREE.Mesh(crossH, crossMat);
    crossVertical.position.set(-5, 1.5, -15);
    crossHorizontal.position.set(-5, 2.2, -15);
    crossVertical.castShadow = true;
    crossHorizontal.castShadow = true;
    scene.add(crossVertical);
    scene.add(crossHorizontal);
    
    document.getElementById('loc-name').textContent = 'Friedhof';
}

function createForest() {
    // Bäume
    for (let i = 0; i < 50; i++) {
        const treeGroup = new THREE.Group();
        
        // Stamm
        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.4, 4, 6);
        const trunkMat = new THREE.StandardMaterial({ color: 0x1a0f0a, roughness: 0.95 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 2;
        trunk.castShadow = true;
        treeGroup.add(trunk);
        
        // Krone
        const leavesGeo = new THREE.ConeGeometry(1.5, 3, 6);
        const leavesMat = new THREE.StandardMaterial({ color: 0x0a1a0a, roughness: 0.9 });
        const leaves = new THREE.Mesh(leavesGeo, leavesMat);
        leaves.position.y = 5;
        leaves.castShadow = true;
        treeGroup.add(leaves);
        
        // Position
        const angle = Math.random() * Math.PI * 2;
        const radius = 10 + Math.random() * 30;
        treeGroup.position.set(
            Math.cos(angle) * radius,
            0,
            Math.sin(angle) * radius - 10
        );
        treeGroup.scale.setScalar(0.8 + Math.random() * 0.4);
        
        scene.add(treeGroup);
    }
    
    document.getElementById('loc-name').textContent = 'Wald';
}

// ===== WETTER EFFEKTE =====
function createWeatherEffects() {
    // Regen Partikel
    if (weather.rain) {
        const rainCount = 15000;
        const rainGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(rainCount * 3);
        
        for (let i = 0; i < rainCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 100;
            positions[i + 1] = Math.random() * 20;
            positions[i + 2] = (Math.random() - 0.5) * 100;
        }
        
        rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const rainMat = new THREE.PointsMaterial({
            color: 0xaaaaaa,
            size: 0.05,
            transparent: true,
            opacity: 0.6
        });
        
        const rain = new THREE.Points(rainGeo, rainMat);
        rain.userData = { isRain: true };
        scene.add(rain);
    }
    
    // Staub/Sporen Partikel (Horror Atmosphäre)
    const dustCount = 8000;
    const dustGeo = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    const dustVelocities = new Float32Array(dustCount * 3);
    
    for (let i = 0; i < dustCount * 3; i += 3) {
        dustPositions[i] = (Math.random() - 0.5) * 50;
        dustPositions[i + 1] = Math.random() * 10;
        dustPositions[i + 2] = (Math.random() - 0.5) * 50;
        
        dustVelocities[i] = (Math.random() - 0.5) * 0.01;
        dustVelocities[i + 1] = Math.random() * 0.02;
        dustVelocities[i + 2] = (Math.random() - 0.5) * 0.01;
    }
    
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    dustGeo.setAttribute('velocity', new THREE.BufferAttribute(dustVelocities, 3));
    
    const dustMat = new THREE.PointsMaterial({
        color: 0x888844,
        size: 0.03,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.userData = { isDust: true };
    scene.add(dust);
    
    // Nebel (bereits durch scene.fog gesetzt, aber hier verstärken)
    if (weather.fog) {
        scene.fog.density = scenes[currentScene].fogDensity * weather.intensity;
    }
}

// ===== GEISTER =====
function createGhosts() {
    const ghostCount = 5;
    
    for (let i = 0; i < ghostCount; i++) {
        const ghostGeo = new THREE.SphereGeometry(0.4, 16, 16);
        const ghostMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.7,
            emissive: 0xaaaaaa,
            emissiveIntensity: 0.3
        });
        
        const ghost = new THREE.Mesh(ghostGeo, ghostMat);
        ghost.position.set(
            (Math.random() - 0.5) * 20,
            1 + Math.random() * 2,
            (Math.random() - 0.5) * 20 - 10
        );
        ghost.userData = {
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.02,
                (Math.random() - 0.5) * 0.01,
                (Math.random() - 0.5) * 0.02
            ),
            phase: Math.random() * Math.PI * 2
        };
        
        // Point Light für unheimliches Leuchten
        const ghostLight = new THREE.PointLight(0xaaffff, 0.5, 3);
        ghost.add(ghostLight);
        
        ghosts.push(ghost);
        scene.add(ghost);
    }
}

// ===== PLAYER CONTROLLER =====
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let isSprinting = false;

function setupPlayer() {
    // Player wird durch PointerLockControls gesteuert
}

function onKeyDown(event) {
    switch (event.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyD': moveRight = true; break;
        case 'ShiftLeft': isSprinting = true; break;
        case 'KeyE': interact(); break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyD': moveRight = false; break;
        case 'ShiftLeft': isSprinting = false; break;
    }
}

function interact() {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    
    const intersects = raycaster.intersectObjects(interactables);
    
    if (intersects.length > 0 && intersects[0].distance < 3) {
        const obj = intersects[0].object;
        if (obj.userData.type === 'door') {
            obj.userData.open = !obj.userData.open;
            const targetRot = obj.userData.open ? Math.PI / 2 : 0;
            obj.rotation.y = targetRot;
        }
    }
}

// ===== SZENEN WECHSEL =====
window.switchScene = function(sceneName) {
    currentScene = sceneName;
    
    // Scene reset
    while(scene.children.length > 0){ 
        scene.remove(scene.children[0]); 
    }
    
    // Reset globals
    ghosts = [];
    interactables = [];
    
    // Rebuild
    scene.fog = new THREE.FogExp2(scenes[currentScene].fogColor, scenes[currentScene].fogDensity);
    setupLighting();
    createEnvironment();
    createWeatherEffects();
    createGhosts();
    
    // Player reset
    camera.position.set(0, 1.7, 5);
};

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

// ===== ANIMATION LOOP =====
function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();
    
    // Player Movement
    if (controls.isLocked) {
        const speed = isSprinting ? player.sprintSpeed : player.speed;
        const actualSpeed = speed * delta;
        
        if (moveForward) controls.moveForward(actualSpeed);
        if (moveBackward) controls.moveForward(-actualSpeed);
        if (moveRight) controls.moveRight(actualSpeed);
        if (moveLeft) controls.moveRight(-actualSpeed);
    }
    
    // Multiplayer: Player State senden (mit Anti-Cheat Validierung)
    stateUpdateTimer += delta * 1000;
    if (stateUpdateTimer >= STATE_UPDATE_INTERVAL) {
        const currentState = {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            rotation: {
                x: camera.rotation.x,
                y: camera.rotation.y
            },
            health: player.health,
            sanity: player.sanity,
            timestamp: Date.now()
        };
        
        // Anti-Cheat: Lokalen State validieren
        if (!lastPlayerState || validateLocalState(currentState, lastPlayerState)) {
            sendPlayerState(currentState);
            lastPlayerState = currentState;
        } else {
            console.warn('⚠️ Local state validation failed - not sending');
        }
        
        stateUpdateTimer = 0;
    }
    
    // Multiplayer: Remote Players rendern/update
    updateRemotePlayers();
    
    // Geister Animation
    ghosts.forEach((ghost, i) => {
        // Schwebende Bewegung
        ghost.position.y += Math.sin(time * 2 + ghost.userData.phase) * 0.005;
        
        // Zufällige Bewegung
        ghost.position.add(ghost.userData.velocity.clone().multiplyScalar(delta * 2));
        
        // Rotation für unheimlichen Effekt
        ghost.rotation.y += delta * 0.5;
        
        // Grenzen
        if (ghost.position.distanceTo(new THREE.Vector3(0, 1, -10)) > 30) {
            ghost.userData.velocity.negate();
        }
        
        // Jumpscare Check
        const distToPlayer = ghost.position.distanceTo(camera.position);
        if (distToPlayer < 1 && Math.random() < 0.01) {
            triggerJumpscare();
        }
    });
    
    // Regen Animation
    const rainObj = scene.children.find(c => c.userData.isRain);
    if (rainObj) {
        const positions = rainObj.geometry.attributes.position.array;
        for (let i = 1; i < positions.length; i += 3) {
            positions[i] -= 0.5; // Fallgeschwindigkeit
            if (positions[i] < 0) {
                positions[i] = 20; // Reset nach oben
            }
        }
        rainObj.geometry.attributes.position.needsUpdate = true;
    }
    
    // Staub/Sporen Animation
    const dustObj = scene.children.find(c => c.userData.isDust);
    if (dustObj) {
        const positions = dustObj.geometry.attributes.position.array;
        const velocities = dustObj.geometry.attributes.velocity.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += velocities[i];     // X
            positions[i + 1] += velocities[i + 1]; // Y
            positions[i + 2] += velocities[i + 2]; // Z
            
            // Grenzen - Partikel im Bereich halten
            if (Math.abs(positions[i]) > 25) velocities[i] *= -1;
            if (positions[i + 1] > 10 || positions[i + 1] < 0) velocities[i + 1] *= -1;
            if (Math.abs(positions[i + 2]) > 25) velocities[i + 2] *= -1;
        }
        
        dustObj.geometry.attributes.position.needsUpdate = true;
        dustObj.geometry.attributes.velocity.needsUpdate = true;
    }
    
    // Sanity Drain (Horror Mechanik)
    if (time % 10 < 0.016) { // Alle 10 Sekunden
        player.sanity = Math.max(0, player.sanity - 1);
        document.getElementById('sanity').textContent = Math.floor(player.sanity);
        
        if (player.sanity < 30) {
            // Halluzinationen bei niedriger Sanity
            scene.fog.density = scenes[currentScene].fogDensity * (1 + (30 - player.sanity) / 100);
        }
    }
    
    // Rendern mit Post-Processing
    composer.render();
}

function triggerJumpscare() {
    const jumpscare = document.getElementById('jumpscare');
    jumpscare.style.display = 'block';
    setTimeout(() => {
        jumpscare.style.display = 'none';
    }, 100);
    
    player.health -= 20;
    document.getElementById('health-fill').style.width = player.health + '%';
    
    if (player.health <= 0) {
        alert('💀 DU BIST GESTORBEN 💀\nSeite neu laden zum Neustart');
        location.reload();
    }
}
