// Horror Game 3D - Triple-A Environment
// Three.js mit Ambient Occlusion, Screen Space Reflections, Wetter-Effekten
// Phase 5: Multiplayer mit WebRTC Data Channels

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SSAOEffect } from 'three/addons/effects/SSAOEffect.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { initNetwork, sendPlayerState, validateLocalState, getInterpolatedPlayerState, getAllRemotePlayerStates, createRoom, joinRoom, leaveRoom, networkState } from './network.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ===== GLOBALE VARIABLEN =====
let scene, camera, renderer, composer, controls;
let currentScene = 'house';
let player = { speed: 5, sprintSpeed: 10, health: 100, sanity: 100, mesh: null, mixer: null };
let ghosts = [];
let interactables = [];
let weather = { rain: true, fog: true, intensity: 0.8 };
let clock = new THREE.Clock();

// Multiplayer State
let lastPlayerState = null;
let stateUpdateTimer = 0;
const STATE_UPDATE_INTERVAL = 50; // ms
let remotePlayerMeshes = new Map(); // playerId -> mesh

// Asset Loader
const gltfLoader = new GLTFLoader();

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

// ===== PBR TEXTURE GENERATOR (Procedural 4K Quality) =====
function createPBRTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    // Base fill
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 1024, 1024);
    
    if (type === 'wood') {
        // Wood planks procedural
        for (let y = 0; y < 1024; y += 128) {
            const shade = 0.3 + Math.random() * 0.2;
            ctx.fillStyle = `rgb(${shade*60}, ${shade*40}, ${shade*30})`;
            ctx.fillRect(0, y, 1024, 120);
            // Wood grain
            for (let i = 0; i < 200; i++) {
                ctx.strokeStyle = `rgba(0,0,0,${0.1 + Math.random()*0.2})`;
                ctx.lineWidth = 1 + Math.random() * 2;
                ctx.beginPath();
                ctx.moveTo(0, y + Math.random() * 120);
                for (let x = 0; x < 1024; x += 50) {
                    ctx.lineTo(x, y + Math.random() * 120);
                }
                ctx.stroke();
            }
        }
    } else if (type === 'brick') {
        // Brick wall
        ctx.fillStyle = '#4a2a2a';
        ctx.fillRect(0, 0, 1024, 1024);
        for (let y = 0; y < 1024; y += 64) {
            const offset = (y / 64) % 2 === 0 ? 0 : 50;
            for (let x = -offset; x < 1024; x += 100) {
                ctx.fillStyle = `rgb(${60 + Math.random()*40}, ${20 + Math.random()*20}, ${20 + Math.random()*20})`;
                ctx.fillRect(x + offset + 2, y + 2, 96, 60);
            }
        }
    } else if (type === 'concrete') {
        // Concrete with imperfections
        for (let i = 0; i < 5000; i++) {
            const gray = 0.4 + Math.random() * 0.3;
            ctx.fillStyle = `rgba(${gray*255}, ${gray*255}, ${gray*255}, 0.5)`;
            ctx.beginPath();
            ctx.arc(Math.random() * 1024, Math.random() * 1024, Math.random() * 3, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (type === 'grass') {
        // Grass ground
        ctx.fillStyle = '#1a3d1a';
        ctx.fillRect(0, 0, 1024, 1024);
        for (let i = 0; i < 10000; i++) {
            const green = 0.1 + Math.random() * 0.3;
            ctx.fillStyle = `rgba(${green*50}, ${green*100}, ${green*30}, 0.8)`;
            ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 4);
        }
    } else if (type === 'dirt') {
        // Dirt with leaves
        ctx.fillStyle = '#2a1a0a';
        ctx.fillRect(0, 0, 1024, 1024);
        for (let i = 0; i < 3000; i++) {
            ctx.fillStyle = `rgba(${0.3 + Math.random()*0.2}*255, ${0.2 + Math.random()*0.1}*255, ${0.1 + Math.random()*0.1}*255, 0.6)`;
            ctx.beginPath();
            ctx.arc(Math.random() * 1024, Math.random() * 1024, 3 + Math.random() * 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    return new THREE.CanvasTexture(canvas);
}

// ===== UMGEBUNG =====
function createEnvironment() {
    const config = scenes[currentScene];
    
    // Boden mit hochauflösender Geometrie
    const groundGeo = new THREE.PlaneGeometry(100, 100, 256, 256);
    
    // Heightmap für Terrain (verbessert)
    const vertices = groundGeo.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];
        // Multi-octave noise für natürliches Terrain
        let height = 0;
        height += Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.5;
        height += Math.sin(x * 0.3 + y * 0.2) * 0.2;
        height += Math.sin(x * 0.8) * Math.cos(y * 0.6) * 0.1;
        vertices[i + 2] = height;
    }
    groundGeo.computeVertexNormals();
    
    // PBR Material mit proceduraler Textur
    const textureType = config.groundTexture === 'wood' ? 'wood' :
                        config.groundTexture === 'grass' ? 'grass' : 'dirt';
    const groundTexture = createPBRTexture(textureType);
    groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(10, 10);
    
    const groundMat = new THREE.MeshStandardMaterial({ 
        map: groundTexture,
        roughness: 0.9,
        metalness: 0.0,
        normalScale: new THREE.Vector2(0.5, 0.5)
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
    
    // Funken-Partikel bei Lichtquellen (Triple-A Effekt)
    const sparkCount = 500;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkVelocities = new Float32Array(sparkCount * 3);
    const sparkLife = new Float32Array(sparkCount);
    
    // Funken um Lichtquellen positionieren
    const lightPositions = [[3, 2.5, 3], [-3, 2.5, -3], [0, 3, -5]];
    for (let i = 0; i < sparkCount * 3; i += 3) {
        const lightIdx = Math.floor(i / 3) % lightPositions.length;
        const [lx, ly, lz] = lightPositions[lightIdx];
        sparkPositions[i] = lx + (Math.random() - 0.5) * 2;
        sparkPositions[i + 1] = ly + (Math.random() - 0.5) * 2;
        sparkPositions[i + 2] = lz + (Math.random() - 0.5) * 2;
        sparkVelocities[i] = (Math.random() - 0.5) * 0.1;
        sparkVelocities[i + 1] = Math.random() * 0.15;
        sparkVelocities[i + 2] = (Math.random() - 0.5) * 0.1;
        sparkLife[Math.floor(i / 3)] = Math.random();
    }
    
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    sparkGeo.setAttribute('velocity', new THREE.BufferAttribute(sparkVelocities, 3));
    sparkGeo.setAttribute('life', new THREE.BufferAttribute(sparkLife, 1));
    
    const sparkMat = new THREE.PointsMaterial({
        color: 0xffaa00,
        size: 0.08,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    sparks.userData = { isSparks: true };
    scene.add(sparks);
    
    // Nebel (bereits durch scene.fog gesetzt, aber hier verstärken)
    if (weather.fog) {
        scene.fog.density = scenes[currentScene].fogDensity * weather.intensity;
    }
}

// ===== GEISTER =====
function createGhostModel() {
    const ghostGroup = new THREE.Group();
    
    // Körper - fließende Form (mehrere Sphären für organische Form)
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.6,
        emissive: 0xaaaaaa,
        emissiveIntensity: 0.4,
        roughness: 0.3,
        metalness: 0.1
    });
    
    // Hauptkörper (größere Sphäre)
    const mainBody = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 24), bodyMat);
    mainBody.position.y = 1.2;
    mainBody.castShadow = true;
    ghostGroup.add(mainBody);
    
    // Unterteil (schweifartig)
    for (let i = 0; i < 5; i++) {
        const tailSphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.15 + Math.random() * 0.1, 16, 16),
            bodyMat.clone()
        );
        tailSphere.position.set(
            (Math.random() - 0.5) * 0.3,
            0.5 + Math.random() * 0.5,
            (Math.random() - 0.5) * 0.2
        );
        tailSphere.scale.y = 1.5;
        tailSphere.castShadow = true;
        ghostGroup.add(tailSphere);
    }
    
    // Augen (leuchtend)
    const eyeMat = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 2
    });
    
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), eyeMat);
    leftEye.position.set(-0.12, 1.3, 0.25);
    ghostGroup.add(leftEye);
    
    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), eyeMat);
    rightEye.position.set(0.12, 1.3, 0.25);
    ghostGroup.add(rightEye);
    
    // Mund (offen, gruselig)
    const mouthGeo = new THREE.TorusGeometry(0.08, 0.02, 8, 16, Math.PI);
    const mouthMat = new THREE.MeshStandardMaterial({ 
        color: 0x000000,
        emissive: 0x110000,
        emissiveIntensity: 0.5
    });
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, 1.1, 0.28);
    mouth.rotation.x = Math.PI;
    ghostGroup.add(mouth);
    
    // Point Light für unheimliches Leuchten
    const ghostLight = new THREE.PointLight(0xaaffff, 0.8, 4);
    ghostLight.position.set(0, 1.2, 0);
    ghostGroup.add(ghostLight);
    
    // Animation State
    ghostGroup.userData = {
        mainBody,
        tailSpheres: ghostGroup.children.filter(c => c.geometry && c.geometry.type === 'SphereGeometry' && c !== mainBody && c !== leftEye && c !== rightEye && c !== mouth),
        floatPhase: Math.random() * Math.PI * 2,
        rotationSpeed: 0.3 + Math.random() * 0.4
    };
    
    return ghostGroup;
}

function updateGhostAnimation(ghost, delta, time) {
    const userData = ghost.userData;
    
    // Schwebende Bewegung (vertikal)
    ghost.position.y += Math.sin(time * 2 + userData.floatPhase) * 0.008;
    
    // Zufällige Bewegung
    ghost.position.add(userData.velocity.clone().multiplyScalar(delta * 2));
    
    // Rotation für unheimlichen Effekt
    ghost.rotation.y += delta * userData.rotationSpeed;
    
    // Körper wackeln (organische Bewegung)
    userData.mainBody.scale.setScalar(1 + Math.sin(time * 3 + userData.floatPhase) * 0.05);
    
    // Schweif-AnIMATION (jede Sphäre leicht versetzt)
    userData.tailSpheres.forEach((sphere, i) => {
        sphere.position.y += Math.sin(time * 4 + userData.floatPhase + i * 0.5) * 0.003;
        sphere.scale.setScalar(1 + Math.sin(time * 5 + i) * 0.1);
    });
    
    // Grenzen
    if (ghost.position.distanceTo(new THREE.Vector3(0, 1, -10)) > 30) {
        userData.velocity.negate();
    }
}

function createGhosts() {
    const ghostCount = 5;
    
    for (let i = 0; i < ghostCount; i++) {
        const ghost = createGhostModel();
        ghost.position.set(
            (Math.random() - 0.5) * 20,
            1 + Math.random() * 2,
            (Math.random() - 0.5) * 20 - 10
        );
        ghost.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.02,
            (Math.random() - 0.5) * 0.01,
            (Math.random() - 0.5) * 0.02
        );
        
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

function createPlayerModel() {
    // Player Character als Group aus einfachen Geometrien
    const playerGroup = new THREE.Group();
    
    // Körper (Torso)
    const torsoGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.5, 8);
    const torsoMat = new THREE.MeshStandardMaterial({ 
        color: 0x3366cc, 
        roughness: 0.7,
        metalness: 0.1
    });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 1.25;
    torso.castShadow = true;
    playerGroup.add(torso);
    
    // Kopf
    const headGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ 
        color: 0xffdbac, 
        roughness: 0.6 
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.6;
    head.castShadow = true;
    playerGroup.add(head);
    
    // Arme
    const armGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x3366cc });
    
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.3, 1.2, 0);
    leftArm.rotation.z = 0.3;
    leftArm.castShadow = true;
    playerGroup.add(leftArm);
    
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.3, 1.2, 0);
    rightArm.rotation.z = -0.3;
    rightArm.castShadow = true;
    playerGroup.add(rightArm);
    
    // Beine
    const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.1, 0.5, 0);
    leftLeg.castShadow = true;
    playerGroup.add(leftLeg);
    
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.1, 0.5, 0);
    rightLeg.castShadow = true;
    playerGroup.add(rightLeg);
    
    // Taschenlampe (Flashlight)
    const flashGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.15, 8);
    const flashMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8 });
    const flashlight = new THREE.Mesh(flashGeo, flashMat);
    flashlight.position.set(0.25, 1.1, 0.15);
    flashlight.rotation.x = -Math.PI / 4;
    playerGroup.add(flashlight);
    
    // Flashlight Light
    const flashLight = new THREE.SpotLight(0xffffff, 2, 10, Math.PI / 6, 0.5);
    flashLight.position.set(0.25, 1.1, 0.15);
    flashLight.target.position.set(0.25, 0.5, 5);
    playerGroup.add(flashLight);
    playerGroup.add(flashLight.target);
    
    // Animation State
    playerGroup.userData = {
        leftArm, rightArm, leftLeg, rightLeg,
        walkCycle: 0,
        isWalking: false
    };
    
    return playerGroup;
}

function setupPlayer() {
    // 3D Player Model erstellen
    player.mesh = createPlayerModel();
    player.mesh.visible = false; // First-Person: Mesh nicht sichtbar
    scene.add(player.mesh);
    
    // Player Position an Camera binden
    player.mesh.position.copy(camera.position);
}

function updatePlayerAnimation(delta) {
    if (!player.mesh) return;
    
    // Player Mesh an Camera Position binden (für First-Person)
    player.mesh.position.copy(camera.position);
    player.mesh.rotation.y = camera.rotation.y;
    
    // Walking Animation wenn bewegt
    const isMoving = moveForward || moveBackward || moveLeft || moveRight;
    const userData = player.mesh.userData;
    
    if (isMoving) {
        userData.walkCycle += delta * (isSprinting ? 10 : 6);
        userData.isWalking = true;
        
        // Arm Swing
        userData.leftArm.rotation.x = Math.sin(userData.walkCycle) * 0.5;
        userData.rightArm.rotation.x = Math.sin(userData.walkCycle + Math.PI) * 0.5;
        
        // Leg Movement
        userData.leftLeg.rotation.x = Math.sin(userData.walkCycle + Math.PI) * 0.6;
        userData.rightLeg.rotation.x = Math.sin(userData.walkCycle) * 0.6;
    } else {
        userData.isWalking = false;
        // Return to idle pose
        userData.leftArm.rotation.x = THREE.MathUtils.lerp(userData.leftArm.rotation.x, 0, delta * 5);
        userData.rightArm.rotation.x = THREE.MathUtils.lerp(userData.rightArm.rotation.x, 0, delta * 5);
        userData.leftLeg.rotation.x = THREE.MathUtils.lerp(userData.leftLeg.rotation.x, 0, delta * 5);
        userData.rightLeg.rotation.x = THREE.MathUtils.lerp(userData.rightLeg.rotation.x, 0, delta * 5);
    }
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

// ===== MULTIPLAYER UI =====
function setupMultiplayerUI() {
    const ui = document.createElement('div');
    ui.id = 'multiplayer-ui';
    ui.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.8);
        border: 2px solid #4a4a4a;
        border-radius: 8px;
        padding: 15px;
        color: #fff;
        font-family: monospace;
        font-size: 14px;
        z-index: 1000;
        min-width: 250px;
    `;
    
    ui.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px; color: #ff6b6b;">🎮 MULTIPLAYER</div>
        <div id="mp-status" style="margin-bottom: 8px;">Status: <span style="color: #ffa500;">Disconnected</span></div>
        <div id="mp-room" style="margin-bottom: 8px;">Room: <span id="room-id">-</span></div>
        <div id="mp-players" style="margin-bottom: 10px;">Players: <span id="player-count">0</span></div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button id="btn-create-room" style="
                background: #2ecc71;
                border: none;
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-family: monospace;
            ">Create Room</button>
            <button id="btn-join-room" style="
                background: #3498db;
                border: none;
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-family: monospace;
            ">Join Room</button>
        </div>
        <div id="mp-debug" style="
            margin-top: 10px;
            font-size: 11px;
            color: #888;
            max-height: 100px;
            overflow-y: auto;
        "></div>
    `;
    
    document.body.appendChild(ui);
    
    // Event Listeners
    document.getElementById('btn-create-room').addEventListener('click', () => {
        createRoom((response) => {
            updateMultiplayerUI();
            logDebug(`Room created: ${networkState.roomId}`);
        });
    });
    
    document.getElementById('btn-join-room').addEventListener('click', () => {
        const roomId = prompt('Enter Room ID:');
        if (roomId) {
            joinRoom(roomId, (response) => {
                updateMultiplayerUI();
                if (response.success) {
                    logDebug(`Joined room: ${roomId}`);
                } else {
                    logDebug(`Failed to join: ${response.error}`);
                }
            });
        }
    });
    
    // Socket Events für UI Updates
    if (networkState.socket) {
        networkState.socket.on('connect', () => {
            document.getElementById('mp-status').innerHTML = 'Status: <span style="color: #2ecc71;">Connected</span>';
            logDebug('Connected to signaling server');
        });
        
        networkState.socket.on('disconnect', () => {
            document.getElementById('mp-status').innerHTML = 'Status: <span style="color: #e74c3c;">Disconnected</span>';
            logDebug('Disconnected from signaling server');
        });
        
        networkState.socket.on('player-joined', (data) => {
            updateMultiplayerUI();
            logDebug(`Player joined: ${data.playerId}`);
        });
        
        networkState.socket.on('player-left', (data) => {
            updateMultiplayerUI();
            logDebug(`Player left: ${data.playerId}`);
        });
        
        networkState.socket.on('host-migrated', (data) => {
            logDebug(`Host migrated to: ${data.newHostId}`);
            if (networkState.isHost) {
                logDebug('👑 You are now the host!');
            }
        });
    }
    
    function updateMultiplayerUI() {
        document.getElementById('room-id').textContent = networkState.roomId || '-';
        document.getElementById('player-count').textContent = networkState.peers.size + 1;
        
        const hostBadge = networkState.isHost ? ' <span style="color: #f39c12;">(HOST)</span>' : '';
        document.getElementById('mp-room').innerHTML = `Room: <span id="room-id">${networkState.roomId || '-'}</span>${hostBadge}`;
    }
    
    function logDebug(msg) {
        const debugEl = document.getElementById('mp-debug');
        const line = document.createElement('div');
        line.textContent = `> ${msg}`;
        debugEl.appendChild(line);
        debugEl.scrollTop = debugEl.scrollHeight;
        
        // Keep only last 10 lines
        while (debugEl.children.length > 10) {
            debugEl.removeChild(debugEl.firstChild);
        }
    }
    
    // Initial update
    updateMultiplayerUI();
}

// ===== REMOTE PLAYERS RENDERING =====
function updateRemotePlayers() {
    const states = getAllRemotePlayerStates();
    
    // Remove meshes for players that are no longer connected
    remotePlayerMeshes.forEach((mesh, playerId) => {
        if (!states[playerId]) {
            scene.remove(mesh);
            remotePlayerMeshes.delete(playerId);
        }
    });
    
    // Update or create meshes for connected players
    Object.keys(states).forEach(playerId => {
        const state = states[playerId];
        if (!state) return;
        
        let mesh = remotePlayerMeshes.get(playerId);
        
        if (!mesh) {
            // Create new player mesh (simple capsule representation)
            const geometry = new THREE.CapsuleGeometry(0.3, 1.5, 4, 8);
            const material = new THREE.MeshStandardMaterial({ 
                color: 0x3498db,
                emissive: 0x1a5276,
                emissiveIntensity: 0.3,
                roughness: 0.7,
                metalness: 0.3
            });
            mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            
            // Add head (sphere)
            const headGeo = new THREE.SphereGeometry(0.25, 16, 16);
            const headMat = new THREE.MeshStandardMaterial({ 
                color: 0xffdbac,
                roughness: 0.5
            });
            const head = new THREE.Mesh(headGeo, headMat);
            head.position.y = 0.85;
            mesh.add(head);
            
            // Add player label
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, 256, 64);
            ctx.font = 'bold 20px monospace';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(`Player ${playerId.slice(-4)}`, 128, 40);
            
            const texture = new THREE.CanvasTexture(canvas);
            const labelMat = new THREE.SpriteMaterial({ map: texture });
            const label = new THREE.Sprite(labelMat);
            label.position.y = 1.5;
            label.scale.set(2, 0.5, 1);
            mesh.add(label);
            
            mesh.userData.labelCanvas = canvas;
            mesh.userData.labelTexture = texture;
            
            scene.add(mesh);
            remotePlayerMeshes.set(playerId, mesh);
        }
        
        // Smooth interpolation to target position
        const targetPos = new THREE.Vector3(state.x, state.y, state.z);
        const currentPos = mesh.position.clone();
        const lerpFactor = 0.15; // Smooth interpolation
        
        mesh.position.lerpVectors(currentPos, targetPos, lerpFactor);
        
        // Rotate to face direction (if we have rotation data)
        if (state.rotation) {
            mesh.rotation.y = state.rotation.y || 0;
            
            // Update label with player ID
            const ctx = mesh.userData.labelCanvas.getContext('2d');
            ctx.clearRect(0, 0, 256, 64);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, 256, 64);
            ctx.font = 'bold 20px monospace';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(`Player ${playerId.slice(-4)}`, 128, 40);
            mesh.userData.labelTexture.needsUpdate = true;
        }
        
        // Health indicator (color change)
        if (state.health !== undefined) {
            const healthRatio = state.health / 100;
            mesh.material.color.setHSL(0.6 * healthRatio, 0.8, 0.5);
        }
    });
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

// ===== REMOTE PLAYERS RENDER =====
function updateRemotePlayers() {
    const remoteStates = getAllRemotePlayerStates();
    
    // Für jeden Remote-Player
    Object.keys(remoteStates).forEach(playerId => {
        const state = remoteStates[playerId];
        if (!state) return;
        
        // Existierendes Mesh finden oder erstellen
        let mesh = remotePlayerMeshes.get(playerId);
        
        if (!mesh) {
            // Neues Player-Mesh erstellen (Kapselform für Spieler)
            const playerGroup = new THREE.Group();
            
            // Körper
            const bodyGeo = new THREE.CapsuleGeometry(0.3, 1.2, 8, 16);
            const bodyMat = new THREE.MeshStandardMaterial({ 
                color: 0x00ff00, 
                emissive: 0x004400,
                emissiveIntensity: 0.3
            });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 0.9;
            body.castShadow = true;
            playerGroup.add(body);
            
            // Kopf (für Blickrichtung)
            const headGeo = new THREE.SphereGeometry(0.25, 16, 16);
            const headMat = new THREE.MeshStandardMaterial({ 
                color: 0xffccaa,
                roughness: 0.5
            });
            const head = new THREE.Mesh(headGeo, headMat);
            head.position.y = 1.7;
            head.castShadow = true;
            playerGroup.add(head);
            
            // Player Label (ID-Anzeige)
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, 256, 64);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`Player ${playerId.slice(-4)}`, 128, 40);
            
            const labelTexture = new THREE.CanvasTexture(canvas);
            const labelMat = new THREE.SpriteMaterial({ map: labelTexture });
            const label = new THREE.Sprite(labelMat);
            label.position.y = 2.3;
            label.scale.set(2, 0.5, 1);
            playerGroup.add(label);
            
            // Point Light für Sichtbarkeit
            const playerLight = new THREE.PointLight(0x00ff00, 0.5, 5);
            playerLight.position.y = 1;
            playerGroup.add(playerLight);
            
            mesh = playerGroup;
            mesh.userData = { playerId, head };
            remotePlayerMeshes.set(playerId, mesh);
            scene.add(mesh);
            
            console.log('✅ Added remote player mesh:', playerId);
        }
        
        // Position updaten (interpoliert)
        mesh.position.set(state.x || 0, state.y || 0, state.z || 0);
        
        // Rotation updaten (Kopf zeigt in Blickrichtung)
        if (state.rotation) {
            mesh.rotation.y = state.rotation.y || 0;
            if (mesh.userData.head) {
                mesh.userData.head.rotation.x = state.rotation.x || 0;
            }
        }
    });
    
    // Gelöschte Player entfernen (wenn nicht mehr in remoteStates)
    remotePlayerMeshes.forEach((mesh, playerId) => {
        if (!remoteStates[playerId]) {
            scene.remove(mesh);
            remotePlayerMeshes.delete(playerId);
            console.log('🚪 Removed remote player mesh:', playerId);
        }
    });
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
    
    // Player Animation (Walking, etc.)
    updatePlayerAnimation(delta);
    
    // Geister Animation mit verbesserter Logik
    ghosts.forEach((ghost, i) => {
        updateGhostAnimation(ghost, delta, time);
        
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
