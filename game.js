// GT3 Nurburgring fan simulator. Procedural assets only; no official logos.

import * as THREE from 'three';

const canvas = document.getElementById('canvas');
const focusHint = document.getElementById('focus-hint');
const webglError = document.getElementById('webgl-error');
const hud = {
    speed: document.getElementById('speed'),
    lap: document.getElementById('lap'),
    sector: document.getElementById('sector'),
    best: document.getElementById('best')
};

const CONFIG = {
    trackWidth: 13.5,
    roadSegmentsPerCurve: 18,
    maxDelta: 1 / 30,
    lapsToRun: 3,
    maxSpeed: 86,
    reverseMaxSpeed: 16,
    acceleration: 31,
    braking: 52,
    rollingDrag: 2.8,
    grassDrag: 10.5,
    barrierRestitution: 0.18,
    steeringStrength: 1.9,
    stabilityAssist: 4.4,
    cameraStiffness: 5.8,
    pixelRatioLimit: 1.8
};

const sectorNames = [
    'GP Start',
    'Hatzenbach',
    'Flugplatz',
    'Schwedenkreuz',
    'Adenauer Forst',
    'Bergwerk',
    'Karussell',
    'Hohe Acht',
    'Pflanzgarten',
    'Dottinger Hohe'
];

const input = {
    throttle: false,
    brake: false,
    left: false,
    right: false,
    handbrake: false
};

const sim = {
    focused: false,
    lap: 1,
    lapTime: 0,
    bestLap: null,
    totalTime: 0,
    speed: 0,
    yaw: 0,
    steer: 0,
    progress: 0,
    lastProgress: 0,
    sector: 0,
    onTrack: true,
    cameraMode: 0,
    lastEvent: 'Green flag at the Nurburgring.',
    finished: false
};

let scene;
let camera;
let renderer;
let animationFrameId = 0;
let lastFrameTime = performance.now();
let track;
let car;
let carBody;
let cameraTarget = new THREE.Vector3();
let contextLost = false;

const scratch = {
    v2: new THREE.Vector2(),
    v3: new THREE.Vector3(),
    forward: new THREE.Vector3(),
    cameraPos: new THREE.Vector3()
};

bootstrap();

function bootstrap() {
    if (!canvas || !hasWebGL()) {
        showWebGLError();
        return;
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fc7ee);
    scene.fog = new THREE.Fog(0x9fc7ee, 90, 310);

    camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 700);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.pixelRatioLimit));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        contextLost = true;
        cancelAnimationFrame(animationFrameId);
        showWebGLError('WebGL context was lost. Reload the page to restart the simulator.');
    });

    setupWorld();
    track = createTrack();
    car = createGt3Car();
    resetCar();
    bindEvents();
    exposeTestHooks();
    updateHud();
    animationFrameId = requestAnimationFrame(animate);
}

function hasWebGL() {
    const test = document.createElement('canvas');
    return Boolean(test.getContext('webgl2') || test.getContext('webgl') || test.getContext('experimental-webgl'));
}

function showWebGLError(message) {
    if (focusHint) focusHint.classList.add('hidden');
    if (webglError) {
        webglError.textContent = message || webglError.textContent;
        webglError.style.display = 'flex';
    }
}

function setupWorld() {
    const sun = new THREE.DirectionalLight(0xfff6d9, 3.1);
    sun.position.set(-70, 120, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -140;
    sun.shadow.camera.right = 140;
    sun.shadow.camera.top = 140;
    sun.shadow.camera.bottom = -140;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xcce9ff, 0x355d32, 1.2));

    const grass = new THREE.Mesh(
        new THREE.PlaneGeometry(620, 620, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x315d32, roughness: 0.92 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    scene.add(grass);

    const sky = new THREE.Mesh(
        new THREE.SphereGeometry(360, 32, 16),
        new THREE.MeshBasicMaterial({ color: 0x9fc7ee, side: THREE.BackSide })
    );
    scene.add(sky);
}

function createTrack() {
    const anchors = [
        [0, 0], [20, -23], [6, -52], [-31, -67], [-63, -47],
        [-71, -11], [-47, 20], [-60, 55], [-26, 88], [18, 82],
        [51, 53], [70, 15], [59, -25], [31, -48]
    ].map(([x, z]) => new THREE.Vector2(x, z));

    const curve = new THREE.CatmullRomCurve3(
        anchors.map((p) => new THREE.Vector3(p.x, 0, p.y)),
        true,
        'catmullrom',
        0.45
    );

    const samples = [];
    const totalSamples = anchors.length * CONFIG.roadSegmentsPerCurve;
    for (let i = 0; i < totalSamples; i++) {
        const t = i / totalSamples;
        const point = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t).normalize();
        samples.push({
            t,
            p: new THREE.Vector2(point.x, point.z),
            tangent: new THREE.Vector2(tangent.x, tangent.z).normalize()
        });
    }

    const road = buildRoadMesh(samples);
    const line = buildCenterLine(samples);
    const curbs = buildCurbs(samples);
    const barriers = buildBarriers(samples);
    const scenery = buildScenery(samples);
    const startLine = buildStartLine(samples[0], samples[1]);

    scene.add(road, line, curbs, barriers, scenery, startLine);
    return { anchors, samples, curve, length: estimateTrackLength(samples) };
}

function buildRoadMesh(samples) {
    const vertices = [];
    const uvs = [];
    const indices = [];
    const half = CONFIG.trackWidth / 2;

    samples.forEach((sample, index) => {
        const normal = new THREE.Vector2(-sample.tangent.y, sample.tangent.x);
        const crown = Math.sin(index * 0.23) * 0.035;
        const left = sample.p.clone().addScaledVector(normal, half);
        const right = sample.p.clone().addScaledVector(normal, -half);
        vertices.push(left.x, crown, left.y, right.x, crown, right.y);
        uvs.push(0, index / 5, 1, index / 5);
    });

    for (let i = 0; i < samples.length; i++) {
        const next = (i + 1) % samples.length;
        const a = i * 2;
        const b = next * 2;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({ color: 0x2b2f31, roughness: 0.78, metalness: 0.02 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
}

function buildCenterLine(samples) {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xf4f0d6 });
    for (let i = 0; i < samples.length; i += 10) {
        const sample = samples[i];
        const dash = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.018, 2.4), mat);
        dash.position.set(sample.p.x, 0.035, sample.p.y);
        dash.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.y);
        group.add(dash);
    }
    return group;
}

function buildCurbs(samples) {
    const group = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: 0xc21c18, roughness: 0.6 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.6 });
    const half = CONFIG.trackWidth / 2 + 0.42;

    for (let i = 0; i < samples.length; i += 4) {
        const sample = samples[i];
        const normal = new THREE.Vector2(-sample.tangent.y, sample.tangent.x);
        [-1, 1].forEach((side) => {
            const curb = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.08, 1.35), (i / 4 + side > 0) % 2 ? red : white);
            const pos = sample.p.clone().addScaledVector(normal, half * side);
            curb.position.set(pos.x, 0.06, pos.y);
            curb.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.y);
            curb.castShadow = true;
            curb.receiveShadow = true;
            group.add(curb);
        });
    }
    return group;
}

function buildBarriers(samples) {
    const group = new THREE.Group();
    const railMat = new THREE.MeshStandardMaterial({ color: 0xc4c7c8, roughness: 0.38, metalness: 0.75 });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x3c4346, roughness: 0.62, metalness: 0.4 });
    const half = CONFIG.trackWidth / 2 + 2.4;

    for (let i = 0; i < samples.length; i += 8) {
        const sample = samples[i];
        const normal = new THREE.Vector2(-sample.tangent.y, sample.tangent.x);
        [-1, 1].forEach((side) => {
            const pos = sample.p.clone().addScaledVector(normal, half * side);
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.48, 3.2), railMat);
            rail.position.set(pos.x, 0.55, pos.y);
            rail.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.y);
            rail.castShadow = true;
            group.add(rail);

            const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.78, 0.16), postMat);
            post.position.set(pos.x, 0.38, pos.y);
            post.castShadow = true;
            group.add(post);
        });
    }
    return group;
}

function buildScenery(samples) {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3522, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x1f6b36, roughness: 0.86 });
    const marshalMat = new THREE.MeshStandardMaterial({ color: 0xf08a24, roughness: 0.55 });

    for (let i = 0; i < samples.length; i += 5) {
        const sample = samples[i];
        const normal = new THREE.Vector2(-sample.tangent.y, sample.tangent.x);
        [-1, 1].forEach((side) => {
            const offset = 18 + ((i * 7) % 19);
            const pos = sample.p.clone().addScaledVector(normal, offset * side);
            if (Math.abs(pos.x) < 7 && Math.abs(pos.y) < 8) return;
            const tree = new THREE.Group();
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 2.4, 7), trunkMat);
            trunk.position.y = 1.2;
            const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.35 + (i % 3) * 0.2, 3.1, 8), leafMat);
            leaves.position.y = 3.55;
            trunk.castShadow = true;
            leaves.castShadow = true;
            tree.add(trunk, leaves);
            tree.position.set(pos.x, 0, pos.y);
            tree.rotation.y = (i * 0.618) % Math.PI;
            group.add(tree);
        });
    }

    for (let i = 18; i < samples.length; i += 44) {
        const sample = samples[i];
        const normal = new THREE.Vector2(-sample.tangent.y, sample.tangent.x);
        const pos = sample.p.clone().addScaledVector(normal, CONFIG.trackWidth / 2 + 6.5);
        const hut = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.5, 2.0), marshalMat);
        base.position.y = 0.75;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0x202629, roughness: 0.55 }));
        roof.position.y = 1.9;
        roof.rotation.y = Math.PI / 4;
        hut.add(base, roof);
        hut.position.set(pos.x, 0, pos.y);
        hut.lookAt(sample.p.x, 0, sample.p.y);
        group.add(hut);
    }

    return group;
}

function buildStartLine(sample, nextSample) {
    const group = new THREE.Group();
    const line = new THREE.Mesh(new THREE.BoxGeometry(CONFIG.trackWidth, 0.035, 0.42), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    line.position.set(sample.p.x, 0.08, sample.p.y);
    line.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.y) + Math.PI / 2;
    group.add(line);

    return group;
}

function createGt3Car() {
    const group = new THREE.Group();
    const black = new THREE.MeshStandardMaterial({ color: 0x080b0c, roughness: 0.34, metalness: 0.42 });
    const teal = new THREE.MeshStandardMaterial({ color: 0x00a676, roughness: 0.28, metalness: 0.32 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.34, metalness: 0.18 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x122232, roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.72 });
    const tire = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.88 });
    const rim = new THREE.MeshStandardMaterial({ color: 0xbfc5c7, roughness: 0.32, metalness: 0.86 });

    carBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.42, 4.25), teal);
    carBody.position.y = 0.52;
    carBody.castShadow = true;
    group.add(carBody);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.25, 1.45), black);
    nose.position.set(0, 0.49, -1.55);
    nose.castShadow = true;
    group.add(nose);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.58, 1.16), glass);
    cabin.position.set(0, 0.93, -0.32);
    cabin.castShadow = true;
    group.add(cabin);

    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.08, 0.42), black);
    splitter.position.set(0, 0.28, -2.34);
    group.add(splitter);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.1, 0.46), black);
    wing.position.set(0, 1.12, 2.12);
    wing.castShadow = true;
    group.add(wing);
    [-0.85, 0.85].forEach((x) => {
        const mount = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.62, 0.08), black);
        mount.position.set(x, 0.82, 2.0);
        group.add(mount);
    });

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 4.34), orange);
    stripe.position.set(0, 0.75, 0);
    group.add(stripe);

    const number = createTextSprite('MV33', 0xffffff, 256, 128, '#111');
    number.position.set(0, 1.28, -0.18);
    number.scale.set(1.45, 0.62, 1);
    group.add(number);

    const wheelGeo = new THREE.CylinderGeometry(0.39, 0.39, 0.34, 20);
    const rimGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.36, 18);
    [[-1.12, -1.35], [1.12, -1.35], [-1.12, 1.34], [1.12, 1.34]].forEach(([x, z]) => {
        const wheel = new THREE.Mesh(wheelGeo, tire);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.38, z);
        wheel.castShadow = true;
        const wheelRim = new THREE.Mesh(rimGeo, rim);
        wheelRim.rotation.z = Math.PI / 2;
        wheel.add(wheelRim);
        group.add(wheel);
    });

    group.userData = {
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        heading: new THREE.Vector3(0, 0, -1)
    };
    scene.add(group);
    return group;
}

function createTextSprite(text, color, width = 512, height = 128, background = 'rgba(0,0,0,0.55)') {
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = width;
    labelCanvas.height = height;
    const ctx = labelCanvas.getContext('2d');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.font = `bold ${Math.floor(height * 0.46)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);
    const texture = new THREE.CanvasTexture(labelCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
}

function resetCar() {
    const start = track.samples[0];
    const next = track.samples[2];
    sim.speed = 0;
    sim.steer = 0;
    sim.progress = 0;
    sim.lastProgress = 0;
    sim.sector = 0;
    sim.finished = false;
    sim.lastEvent = 'Reset on the start line.';

    car.position.set(start.p.x, 0.24, start.p.y);
    sim.yaw = Math.atan2(next.p.x - start.p.x, next.p.y - start.p.y);
    car.rotation.set(0, sim.yaw, 0);
    cameraTarget.copy(car.position);
    updateCamera(1);
}

function bindEvents() {
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('click', focusGame);
    window.addEventListener('touchstart', focusGame, { passive: true });
}

function focusGame() {
    sim.focused = true;
    if (focusHint) focusHint.classList.add('hidden');
}

function onKeyDown(event) {
    focusGame();
    switch (event.code) {
        case 'KeyW':
        case 'ArrowUp': input.throttle = true; break;
        case 'KeyS':
        case 'ArrowDown': input.brake = true; break;
        case 'KeyA':
        case 'ArrowLeft': input.left = true; break;
        case 'KeyD':
        case 'ArrowRight': input.right = true; break;
        case 'Space': input.handbrake = true; event.preventDefault(); break;
        case 'KeyR': resetCar(); break;
        case 'KeyC': sim.cameraMode = (sim.cameraMode + 1) % 3; break;
        default: break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'KeyW':
        case 'ArrowUp': input.throttle = false; break;
        case 'KeyS':
        case 'ArrowDown': input.brake = false; break;
        case 'KeyA':
        case 'ArrowLeft': input.left = false; break;
        case 'KeyD':
        case 'ArrowRight': input.right = false; break;
        case 'Space': input.handbrake = false; event.preventDefault(); break;
        default: break;
    }
}

function animate(now) {
    animationFrameId = requestAnimationFrame(animate);
    if (contextLost) return;
    const delta = Math.min((now - lastFrameTime) / 1000 || 0, CONFIG.maxDelta);
    lastFrameTime = now;
    step(delta);
    render();
}

function step(delta) {
    if (!Number.isFinite(delta) || delta <= 0) return;
    delta = Math.min(delta, CONFIG.maxDelta);
    sim.totalTime += delta;
    if (!sim.finished) sim.lapTime += delta;
    updatePhysics(delta);
    updateTrackState();
    updateCamera(delta);
    updateHud();
}

function updatePhysics(delta) {
    const throttle = input.throttle ? 1 : 0;
    const brake = input.brake ? 1 : 0;
    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const offTrack = !sim.onTrack;
    const speedAbs = Math.abs(sim.speed);

    if (throttle) sim.speed += CONFIG.acceleration * delta;
    if (brake) sim.speed -= (sim.speed > 4 ? CONFIG.braking : CONFIG.acceleration * 0.58) * delta;
    if (!throttle && !brake) {
        const drag = CONFIG.rollingDrag + (offTrack ? CONFIG.grassDrag : 0);
        sim.speed = approach(sim.speed, 0, drag * delta);
    }
    if (input.handbrake) sim.speed = approach(sim.speed, 0, CONFIG.braking * 0.65 * delta);
    if (offTrack) sim.speed = approach(sim.speed, 0, CONFIG.grassDrag * delta);

    sim.speed = THREE.MathUtils.clamp(sim.speed, -CONFIG.reverseMaxSpeed, CONFIG.maxSpeed);
    sim.steer = THREE.MathUtils.lerp(sim.steer, steerTarget, delta * 7.5);

    const speedFactor = THREE.MathUtils.clamp(speedAbs / CONFIG.maxSpeed, 0.05, 1);
    const handbrakeDrift = input.handbrake ? 1.35 : 1;
    const turnRate = sim.steer * CONFIG.steeringStrength * speedFactor * handbrakeDrift;
    sim.yaw += turnRate * delta * Math.sign(sim.speed || 1);
    applyStabilityAssist(delta, speedFactor);

    scratch.forward.set(Math.sin(sim.yaw), 0, Math.cos(sim.yaw)).normalize();
    car.position.addScaledVector(scratch.forward, sim.speed * delta);
    keepCarNearTrack(delta);
    car.position.y = 0.24;
    car.rotation.y = sim.yaw;
    car.rotation.z = THREE.MathUtils.lerp(car.rotation.z, -sim.steer * speedFactor * 0.13, delta * 5);
    car.rotation.x = THREE.MathUtils.lerp(car.rotation.x, brake * 0.04 - throttle * 0.025, delta * 6);

    if (carBody) {
        carBody.position.y = 0.52 + Math.sin(sim.totalTime * (10 + speedFactor * 12)) * speedFactor * 0.025;
    }
}

function applyStabilityAssist(delta, speedFactor) {
    const nearest = findNearestTrackPoint(car.position.x, car.position.z);
    const desiredYaw = Math.atan2(nearest.sample.tangent.x, nearest.sample.tangent.y);
    const error = angleDelta(desiredYaw, sim.yaw);
    const centerError = THREE.MathUtils.clamp((nearest.distance - CONFIG.trackWidth * 0.25) / CONFIG.trackWidth, 0, 1);
    const assist = CONFIG.stabilityAssist * (0.25 + speedFactor * 0.55 + centerError * 1.4);
    sim.yaw += error * delta * assist;
}

function keepCarNearTrack(delta) {
    const nearest = findNearestTrackPoint(car.position.x, car.position.z);
    const sample = nearest.sample;
    if (!sample) return;
    const center = sample.p;
    const fromCenter = new THREE.Vector2(car.position.x - center.x, car.position.z - center.y);
    const distance = fromCenter.length();
    const softLimit = CONFIG.trackWidth * 0.34;
    if (distance <= softLimit) return;

    const normal = distance > 0.001
        ? fromCenter.multiplyScalar(1 / distance)
        : new THREE.Vector2(-sample.tangent.y, sample.tangent.x);
    const correction = (distance - softLimit) * Math.min(1, delta * 4.2);
    car.position.x -= normal.x * correction;
    car.position.z -= normal.y * correction;
    sim.speed = approach(sim.speed, 0, correction * 0.9 * delta);
}

function updateTrackState() {
    const nearest = findNearestTrackPoint(car.position.x, car.position.z);
    applyTrackBounds(nearest);
    sim.onTrack = nearest.distance <= CONFIG.trackWidth * 0.58;
    sim.lastProgress = sim.progress;
    sim.progress = nearest.index / track.samples.length;
    sim.sector = Math.min(sectorNames.length - 1, Math.floor(sim.progress * sectorNames.length));

    if (sim.lastProgress > 0.82 && sim.progress < 0.18 && sim.speed > 5) {
        if (sim.bestLap === null || sim.lapTime < sim.bestLap) sim.bestLap = sim.lapTime;
        sim.lap += 1;
        sim.lapTime = 0;
        sim.lastEvent = sim.lap > CONFIG.lapsToRun ? 'Race complete.' : 'Lap completed.';
        if (sim.lap > CONFIG.lapsToRun) {
            sim.finished = true;
            sim.lap = CONFIG.lapsToRun;
            sim.speed = Math.min(sim.speed, 18);
        }
    }
}

function findNearestTrackPoint(x, z) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < track.samples.length; i++) {
        const p = track.samples[i].p;
        const dx = p.x - x;
        const dz = p.y - z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < bestDistance) {
            bestDistance = d;
            bestIndex = i;
        }
    }
    return { index: bestIndex, distance: bestDistance, sample: track.samples[bestIndex] };
}

function applyTrackBounds(nearest) {
    const sample = nearest.sample;
    if (!sample) return;
    const center = sample.p;
    const fromCenter = new THREE.Vector2(car.position.x - center.x, car.position.z - center.y);
    const distance = fromCenter.length();
    const maxDistance = CONFIG.trackWidth * 0.5 + 2.45;
    if (distance <= maxDistance) return;

    const normal = distance > 0.001
        ? fromCenter.multiplyScalar(1 / distance)
        : new THREE.Vector2(-sample.tangent.y, sample.tangent.x);
    const clamped = center.clone().addScaledVector(normal, maxDistance);
    car.position.x = clamped.x;
    car.position.z = clamped.y;
    sim.speed *= -CONFIG.barrierRestitution;
    sim.steer *= 0.35;
    sim.lastEvent = 'Armco touch. Keep it between the curbs.';
    nearest.distance = maxDistance;
}

function updateCamera(delta) {
    const height = sim.cameraMode === 1 ? 2.3 : sim.cameraMode === 2 ? 12.5 : 4.6;
    const distance = sim.cameraMode === 1 ? 6.0 : sim.cameraMode === 2 ? 16.0 : 10.5;
    scratch.forward.set(Math.sin(sim.yaw), 0, Math.cos(sim.yaw)).normalize();
    scratch.cameraPos.copy(car.position).addScaledVector(scratch.forward, -distance);
    scratch.cameraPos.y += height;
    if (sim.cameraMode === 2) scratch.cameraPos.x += 2.5;
    const lerp = 1 - Math.exp(-CONFIG.cameraStiffness * delta);
    camera.position.lerp(scratch.cameraPos, lerp);
    cameraTarget.copy(car.position);
    cameraTarget.y += sim.cameraMode === 1 ? 1.1 : 0.8;
    camera.lookAt(cameraTarget);
}

function render() {
    renderer.render(scene, camera);
}

function updateHud() {
    if (hud.speed) hud.speed.textContent = Math.round(Math.abs(sim.speed) * 3.6).toString();
    if (hud.lap) hud.lap.textContent = `${sim.lap} / ${CONFIG.lapsToRun}`;
    if (hud.sector) hud.sector.textContent = sectorNames[sim.sector] || 'Nordschleife';
    if (hud.best) hud.best.textContent = sim.bestLap === null ? '--:--.---' : formatTime(sim.bestLap);
}

function onResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.pixelRatioLimit));
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function estimateTrackLength(samples) {
    let length = 0;
    for (let i = 0; i < samples.length; i++) {
        const a = samples[i].p;
        const b = samples[(i + 1) % samples.length].p;
        length += a.distanceTo(b);
    }
    return length;
}

function approach(value, target, stepSize) {
    if (value < target) return Math.min(value + stepSize, target);
    if (value > target) return Math.max(value - stepSize, target);
    return value;
}

function angleDelta(target, current) {
    let delta = target - current;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return delta;
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const whole = Math.floor(seconds % 60).toString().padStart(2, '0');
    const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
    return `${minutes}:${whole}.${ms}`;
}

function exposeTestHooks() {
    window.render_game_to_text = () => JSON.stringify({
        coordinateSystem: 'Three.js world coordinates: x left/right, y up, z around the Nurburgring-inspired loop.',
        mode: 'gt3_nurburgring_sim',
        driver: 'Max Verstappen fan sim',
        car: 'AMG GT3-inspired procedural car, no official logos',
        focused: sim.focused,
        lap: sim.lap,
        lapsToRun: CONFIG.lapsToRun,
        lapTime: round(sim.lapTime),
        bestLap: sim.bestLap === null ? null : round(sim.bestLap),
        speedKmh: Math.round(Math.abs(sim.speed) * 3.6),
        progress: round(sim.progress),
        sector: sectorNames[sim.sector] || 'Nordschleife',
        onTrack: sim.onTrack,
        finished: sim.finished,
        carPosition: {
            x: round(car.position.x),
            y: round(car.position.y),
            z: round(car.position.z),
            yaw: round(sim.yaw)
        },
        input: { ...input },
        lastEvent: sim.lastEvent
    });

    window.advanceTime = (ms = 16.67) => {
        const steps = Math.max(1, Math.ceil(ms / 16.67));
        for (let i = 0; i < steps; i++) step(1 / 60);
        render();
        return window.render_game_to_text();
    };
}

function round(value) {
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 1000) / 1000;
}
