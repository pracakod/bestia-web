import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';

// === SCENE SETUP ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);

// Orthographic Camera for 2.5D view
const aspect = window.innerWidth / window.innerHeight;
const s = 5;
const camera = new THREE.OrthographicCamera(-s * aspect, s * aspect, s, -s, 0.1, 1000);
camera.position.set(0, 12, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Handle Resize
window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    const aspect = w / h;
    const s = 5;
    camera.left = -s * aspect;
    camera.right = s * aspect;
    camera.top = s;
    camera.bottom = -s;
    camera.updateProjectionMatrix();
});

// === AMBIENT LIGHT ===
const ambient = new THREE.AmbientLight(0x222233, 0.15);
scene.add(ambient);

// === DIRECTIONAL LIGHT (for shadows) ===
const dirLight = new THREE.DirectionalLight(0xaabbcc, 0.25);
dirLight.position.set(30, 50, 30);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 150;
dirLight.shadow.camera.left = -50;
dirLight.shadow.camera.right = 50;
dirLight.shadow.camera.top = 50;
dirLight.shadow.camera.bottom = -50;
scene.add(dirLight);

// === CONSTANTS ===
const TILE_SIZE = 0.7;
const MAP_SIZE = 100;

// === TEXTURES ===
const textureLoader = new THREE.TextureLoader();

// Textures helper for raw GitHub Pages structure
const basePath = './public/img/';

const floorTexture = textureLoader.load(basePath + 'floor.jpg');
floorTexture.magFilter = THREE.NearestFilter;
floorTexture.minFilter = THREE.NearestFilter;
floorTexture.wrapS = THREE.ClampToEdgeWrapping;
floorTexture.wrapT = THREE.ClampToEdgeWrapping;
floorTexture.repeat.set(1, 1);

// Main block texture for everything
const blockTexture = textureLoader.load(basePath + 'rock_texture.jpg');
blockTexture.magFilter = THREE.NearestFilter;
blockTexture.minFilter = THREE.NearestFilter;

// === WORLD GENERATION ===
const voxelGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);

// 1. FLOOR (Instanced)
const floorMat = new THREE.MeshStandardMaterial({
    map: floorTexture,
    roughness: 0.9,
    color: 0xffffff
});
const floorMesh = new THREE.InstancedMesh(voxelGeo, floorMat, MAP_SIZE * MAP_SIZE);
floorMesh.receiveShadow = true;
scene.add(floorMesh);

// 2. WALLS (Instanced)
const wallMat = new THREE.MeshStandardMaterial({
    map: blockTexture,
    roughness: 0.9
});
const caveWalls = new THREE.InstancedMesh(voxelGeo, wallMat, MAP_SIZE * MAP_SIZE);
caveWalls.castShadow = true;
caveWalls.receiveShadow = true;
scene.add(caveWalls);

// Collision Map
const objectsMap = new Map();
function getKey(worldX, worldZ) {
    const gx = Math.round(worldX / TILE_SIZE);
    const gz = Math.round(worldZ / TILE_SIZE);
    return `${gx},${gz}`;
}

// === ADVANCED MAP GENERATION ===
const tempObj = new THREE.Object3D();
let wallCount = 0;
let floorCount = 0;

// Create map array
const mapGrid = [];
for (let x = 0; x < MAP_SIZE; x++) {
    mapGrid[x] = [];
    for (let z = 0; z < MAP_SIZE; z++) {
        // Start with random noise (40% walls)
        mapGrid[x][z] = Math.random() < 0.4 ? 1 : 0;
    }
}

// Cellular Automata - smooth caves (5 iterations)
for (let iter = 0; iter < 5; iter++) {
    const newGrid = [];
    for (let x = 0; x < MAP_SIZE; x++) {
        newGrid[x] = [];
        for (let z = 0; z < MAP_SIZE; z++) {
            // Count neighbors
            let walls = 0;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const nx = x + dx;
                    const nz = z + dz;
                    if (nx < 0 || nx >= MAP_SIZE || nz < 0 || nz >= MAP_SIZE) {
                        walls++; // Out of bounds = wall
                    } else if (mapGrid[nx][nz] === 1) {
                        walls++;
                    }
                }
            }
            // Become wall if 5+ neighbors are walls
            newGrid[x][z] = walls >= 5 ? 1 : 0;
        }
    }
    for (let x = 0; x < MAP_SIZE; x++) {
        for (let z = 0; z < MAP_SIZE; z++) {
            mapGrid[x][z] = newGrid[x][z];
        }
    }
}

// Carve out rooms (random rectangles)
const rooms = [];
for (let i = 0; i < 8; i++) {
    const roomW = 5 + Math.floor(Math.random() * 10);
    const roomH = 5 + Math.floor(Math.random() * 10);
    const roomX = 10 + Math.floor(Math.random() * (MAP_SIZE - 20 - roomW));
    const roomZ = 10 + Math.floor(Math.random() * (MAP_SIZE - 20 - roomH));

    rooms.push({ x: roomX + roomW / 2, z: roomZ + roomH / 2 });

    for (let x = roomX; x < roomX + roomW; x++) {
        for (let z = roomZ; z < roomZ + roomH; z++) {
            mapGrid[x][z] = 0; // Clear room
        }
    }
}

// Connect rooms with corridors
for (let i = 0; i < rooms.length - 1; i++) {
    const r1 = rooms[i];
    const r2 = rooms[i + 1];

    // Horizontal then vertical
    const startX = Math.floor(r1.x);
    const endX = Math.floor(r2.x);
    const startZ = Math.floor(r1.z);
    const endZ = Math.floor(r2.z);

    // Carve horizontal corridor
    for (let x = Math.min(startX, endX); x <= Math.max(startX, endX); x++) {
        for (let w = -1; w <= 1; w++) {
            if (startZ + w >= 0 && startZ + w < MAP_SIZE) {
                mapGrid[x][startZ + w] = 0;
            }
        }
    }
    // Carve vertical corridor
    for (let z = Math.min(startZ, endZ); z <= Math.max(startZ, endZ); z++) {
        for (let w = -1; w <= 1; w++) {
            if (endX + w >= 0 && endX + w < MAP_SIZE) {
                mapGrid[endX + w][z] = 0;
            }
        }
    }
}

// Safe zone in center (clear area for crystal)
const centerX = Math.floor(MAP_SIZE / 2);
const centerZ = Math.floor(MAP_SIZE / 2);
for (let x = centerX - 8; x <= centerX + 8; x++) {
    for (let z = centerZ - 8; z <= centerZ + 8; z++) {
        const dist = Math.sqrt((x - centerX) ** 2 + (z - centerZ) ** 2);
        if (dist < 8) {
            mapGrid[x][z] = 0;
        }
    }
}

// Border walls
for (let x = 0; x < MAP_SIZE; x++) {
    for (let z = 0; z < MAP_SIZE; z++) {
        if (x < 2 || x > MAP_SIZE - 3 || z < 2 || z > MAP_SIZE - 3) {
            mapGrid[x][z] = 1;
        }
    }
}

// Function to check wall from grid
function isWall(x, z) {
    if (x < 0 || x >= MAP_SIZE || z < 0 || z >= MAP_SIZE) return true;
    return mapGrid[x][z] === 1;
}

for (let x = 0; x < MAP_SIZE; x++) {
    for (let z = 0; z < MAP_SIZE; z++) {
        const dx = x - MAP_SIZE / 2;
        const dz = z - MAP_SIZE / 2;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const isSafeZone = dist < 6;

        const isWallBlock = isWall(x, z) && !isSafeZone;

        // ALWAYS place floor first
        tempObj.position.set(x * TILE_SIZE, -0.35, z * TILE_SIZE);
        tempObj.updateMatrix();
        floorMesh.setMatrixAt(floorCount, tempObj.matrix);
        floorMesh.setColorAt(floorCount, new THREE.Color(1, 1, 1));

        const floorKey = getKey(x * TILE_SIZE, z * TILE_SIZE);

        if (isWallBlock) {
            tempObj.position.set(x * TILE_SIZE, 0.35, z * TILE_SIZE);
            tempObj.updateMatrix();
            caveWalls.setMatrixAt(wallCount, tempObj.matrix);
            objectsMap.set(floorKey, { type: 'wall', instanceId: wallCount, floorId: floorCount });
            wallCount++;
        } else {
            objectsMap.set(floorKey, { type: 'floor', instanceId: floorCount, hp: 3 });
        }

        floorCount++;
    }
}

caveWalls.count = wallCount;
caveWalls.instanceMatrix.needsUpdate = true;
floorMesh.count = floorCount;
floorMesh.instanceMatrix.needsUpdate = true;
floorMesh.instanceColor.needsUpdate = true;

// === PLAYER ===
let player;
let playerShadow;
let playerLight;
let isSpriteSheet = false;

// Animated Texture Loader
function loadAnimatedTexture(basePath, count, callback) {
    const images = [];
    let loaded = 0;

    for (let i = 0; i < count; i++) {
        const img = new Image();
        let numStr = i.toString();
        if (i < 10) numStr = '00' + i;
        else if (i < 100) numStr = '0' + i;

        img.onload = () => {
            loaded++;
            if (loaded === count) {
                // Stitch into one texture
                const canvas = document.createElement('canvas');
                const w = images[0].width;
                const h = images[0].height;
                canvas.width = w * count;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                images.forEach((im, idx) => ctx.drawImage(im, idx * w, 0));
                const texture = new THREE.CanvasTexture(canvas);
                texture.magFilter = THREE.NearestFilter;
                texture.minFilter = THREE.NearestFilter;
                texture.repeat.set(1 / count, 1);
                callback(texture);
            }
        };
        img.onerror = () => {
            loaded++;
            console.error("Failed to load:", basePath + '_' + numStr + '.png');
            if (loaded === count && images[0]) {
                const canvas = document.createElement('canvas');
                const w = images[0].width || 64;
                const h = images[0].height || 64;
                canvas.width = w * count;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                images.forEach((im, idx) => {
                    if (im.width) ctx.drawImage(im, idx * w, 0);
                });
                const texture = new THREE.CanvasTexture(canvas);
                texture.magFilter = THREE.NearestFilter;
                texture.minFilter = THREE.NearestFilter;
                texture.repeat.set(1 / count, 1);
                callback(texture);
            }
        };
        img.src = basePath + '_' + numStr + '.png';
        images.push(img);
    }
}

function startGame(avatarUrl) {
    document.getElementById('loading').style.display = 'none';

    if (avatarUrl === 'adventurer_run') {
        let runTex = null, idleTex = null, slashTex = null;

        const checkReady = () => {
            if (runTex && idleTex && slashTex) {
                setupPlayer(runTex, true, idleTex, slashTex);
            }
        };

        loadAnimatedTexture(basePath + 'adventurer/run/FR_Adventurer_Run', 10, (tex) => {
            runTex = tex;
            checkReady();
        });
        loadAnimatedTexture(basePath + 'adventurer/idle/FR_Adventurer_Idle', 12, (tex) => {
            idleTex = tex;
            checkReady();
        });

        loadAnimatedTexture(basePath + 'adventurer/slash/FR_Adventurer_Slash', 8, (tex) => {
            slashTex = tex;
            checkReady();
        });
    }
}

function setupPlayer(texture, isCustomStitched, idleTexture, slashTexture) {
    isSpriteSheet = true;

    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.5 });

    if (!player) {
        player = new THREE.Sprite(mat);
        player.scale.set(1.5 * 0.9, 1.5 * 0.9, 1);
        // Spawn slightly away from crystal in center
        player.position.set((MAP_SIZE / 2 + 2) * TILE_SIZE, 0.6, (MAP_SIZE / 2 + 2) * TILE_SIZE);
        scene.add(player);

        // Player Light
        playerLight = new THREE.PointLight(0xffaa55, 2.0, 15);
        playerLight.position.set(player.position.x, 1.5, player.position.z);
        playerLight.castShadow = false;
        scene.add(playerLight);

        // Player Shadow
        const shadowGeo = new THREE.PlaneGeometry(0.8, 0.4);
        const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
        playerShadow = new THREE.Mesh(shadowGeo, shadowMat);
        playerShadow.rotation.x = -Math.PI / 2;
        playerShadow.position.set(player.position.x, 0.02, player.position.z + 0.05);
        scene.add(playerShadow);
    } else {
        player.material = mat;
    }

    player.userData.isStitched = isCustomStitched;
    player.userData.runTex = texture;
    player.userData.idleTex = idleTexture;
    player.userData.slashTex = slashTexture;

    if (!isGameRunning) animate();
}

// === BUILDING SELECTION ===
const selectorGeo = new THREE.BoxGeometry(0.75, 0.75, 0.75);
const selectorEdges = new THREE.EdgesGeometry(selectorGeo);
const selectorMat = new THREE.LineBasicMaterial({ color: 0xffff00 });
const selector = new THREE.LineSegments(selectorEdges, selectorMat);
selector.position.y = 0.35;
scene.add(selector);

// === ATTACK SYSTEM ===
let isAttacking = false;
let attackStartTime = 0;

// === DROP SYSTEM ===
const drops = [];
const dropTexture = textureLoader.load(basePath + 'drop_stone.png');
dropTexture.magFilter = THREE.NearestFilter;

function spawnDrop(x, z) {
    const dropGeo = new THREE.PlaneGeometry(0.2, 0.2);
    const dropMat = new THREE.MeshBasicMaterial({
        map: dropTexture,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide
    });

    const drop = new THREE.Mesh(dropGeo, dropMat);
    drop.position.set(x + (Math.random() - 0.5) * 0.3, 0.2, z + (Math.random() - 0.5) * 0.3);
    drop.rotation.x = -Math.PI / 2;

    scene.add(drop);
    drops.push({ mesh: drop, spawnTime: Date.now(), type: 'stone' });
}

function triggerAttack() {
    if (isAttacking) return;
    isAttacking = true;
    attackStartTime = Date.now();
}

// === DESTROY BLOCK ===
function destroyBlock() {
    triggerAttack();
    const x = selector.position.x;
    const z = selector.position.z;
    const key = getKey(x, z);

    // Prevent destroying floor too close to player
    const distToPlayer = Math.sqrt((x - player.position.x) ** 2 + (z - player.position.z) ** 2);
    const objCheck = objectsMap.get(key);
    if (objCheck && objCheck.type === 'floor' && distToPlayer < 0.6) {
        console.log("Za blisko!");
        return;
    }

    if (objectsMap.has(key)) {
        const objData = objectsMap.get(key);

        if (objData.type === 'built' || objData.type === 'torch') {
            scene.remove(objData.mesh);

            // Create floor
            const floorBlock = new THREE.Mesh(
                new THREE.BoxGeometry(0.7, 0.7, 0.7),
                new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.9 })
            );
            floorBlock.position.set(x, -0.35, z);
            floorBlock.receiveShadow = true;
            scene.add(floorBlock);

            objectsMap.set(key, { type: 'floor', mesh: floorBlock, hp: 3, isRebuilt: true });

        } else if (objData.type === 'rock') {
            scene.remove(objData.mesh);

            const floorBlock = new THREE.Mesh(
                new THREE.BoxGeometry(0.7, 0.7, 0.7),
                new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.9 })
            );
            floorBlock.position.set(x, -0.35, z);
            floorBlock.receiveShadow = true;
            scene.add(floorBlock);

            objectsMap.set(key, { type: 'floor', mesh: floorBlock, hp: 3, isRebuilt: true });
            spawnDrop(x, z);

        } else if (objData.type === 'wall') {
            const id = objData.instanceId;
            const matrix = new THREE.Matrix4();
            caveWalls.getMatrixAt(id, matrix);

            const pos = new THREE.Vector3();
            const quat = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            matrix.decompose(pos, quat, scale);

            const zeroMatrix = new THREE.Matrix4();
            zeroMatrix.compose(pos, quat, new THREE.Vector3(0, 0, 0));

            caveWalls.setMatrixAt(id, zeroMatrix);
            caveWalls.instanceMatrix.needsUpdate = true;

            const floorId = objData.floorId;
            objectsMap.set(key, { type: 'floor', instanceId: floorId, hp: 3 });
            spawnDrop(pos.x, pos.z);

        } else if (objData.type === 'floor') {
            objData.hp--;

            if (objData.hp === 2) {
                if (objData.isRebuilt && objData.mesh) {
                    // Clone material to avoid affecting all blocks of this type
                    if (!objData.mesh.userData.uniqueMaterial) {
                        objData.mesh.material = objData.mesh.material.clone();
                        objData.mesh.userData.uniqueMaterial = true;
                    }
                    objData.mesh.material.color.setHex(0xffee99);
                } else if (objData.instanceId !== undefined) {
                    floorMesh.setColorAt(objData.instanceId, new THREE.Color(1, 0.9, 0.7));
                    floorMesh.instanceColor.needsUpdate = true;
                }
            } else if (objData.hp === 1) {
                if (objData.isRebuilt && objData.mesh) {
                    // Clone material if not already cloned
                    if (!objData.mesh.userData.uniqueMaterial) {
                        objData.mesh.material = objData.mesh.material.clone();
                        objData.mesh.userData.uniqueMaterial = true;
                    }
                    objData.mesh.material.color.setHex(0xff9966);
                } else if (objData.instanceId !== undefined) {
                    floorMesh.setColorAt(objData.instanceId, new THREE.Color(1, 0.6, 0.4));
                    floorMesh.instanceColor.needsUpdate = true;
                }
            } else if (objData.hp <= 0) {
                if (objData.isRebuilt && objData.mesh) {
                    scene.remove(objData.mesh);
                } else if (objData.instanceId !== undefined) {
                    const matrix = new THREE.Matrix4();
                    floorMesh.getMatrixAt(objData.instanceId, matrix);
                    const pos = new THREE.Vector3();
                    const quat = new THREE.Quaternion();
                    const scale = new THREE.Vector3();
                    matrix.decompose(pos, quat, scale);
                    const zeroMatrix = new THREE.Matrix4();
                    zeroMatrix.compose(pos, quat, new THREE.Vector3(0, 0, 0));
                    floorMesh.setMatrixAt(objData.instanceId, zeroMatrix);
                    floorMesh.instanceMatrix.needsUpdate = true;
                }
                objectsMap.delete(key);
                spawnDrop(x, z);
            }
        }
    }
}

// === PLACE BLOCK ===
function placeBlock() {
    const x = selector.position.x;
    const z = selector.position.z;
    const key = getKey(x, z);

    const dist = Math.sqrt((x - player.position.x) ** 2 + (z - player.position.z) ** 2);
    const isHole = !objectsMap.has(key);

    // Allow floor rebuild at any distance (escape mechanism)
    if (!isHole && dist < 0.5) return;

    if (!objectsMap.has(key)) {
        // HOLE - Rebuild floor
        const floorBlock = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 0.7, 0.7),
            new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.9 })
        );
        floorBlock.position.set(x, -0.35, z);
        floorBlock.receiveShadow = true;
        scene.add(floorBlock);

        objectsMap.set(key, { type: 'floor', mesh: floorBlock, hp: 3, isRebuilt: true });
        console.log("Podłoga odbudowana!");

    } else {
        const objData = objectsMap.get(key);

        if (objData.type === 'floor') {
            if (objData.isRebuilt && objData.mesh) {
                scene.remove(objData.mesh);
            }

            const box = new THREE.Mesh(
                new THREE.BoxGeometry(0.7, 0.7, 0.7),
                new THREE.MeshStandardMaterial({ map: blockTexture })
            );
            box.position.set(x, 0.35, z);
            box.castShadow = true;
            box.receiveShadow = true;
            scene.add(box);

            objectsMap.set(key, { type: 'built', mesh: box, floorInstanceId: objData.instanceId });
            console.log("Blok zbudowany!");
        }
    }
}

// === PLACE TORCH ===
const torchGeo = new THREE.BoxGeometry(0.1, 0.4, 0.1);
const torchMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

function placeTorch() {
    const x = selector.position.x;
    const z = selector.position.z;
    const key = getKey(x, z);

    if (!objectsMap.has(key)) {
        console.log("Nie można na dziurze!");
        return;
    }

    const objData = objectsMap.get(key);
    if (objData.type !== 'floor') {
        console.log("Tylko na podłodze!");
        return;
    }

    const torch = new THREE.Mesh(torchGeo, torchMat);
    torch.position.set(x, 0.2, z);
    scene.add(torch);

    const light = new THREE.PointLight(0xffaa00, 8.0, 25);
    light.decay = 1.5;
    light.position.set(0, 0.8, 0);
    light.castShadow = false;
    torch.add(light);

    objectsMap.set(key, { type: 'torch', mesh: torch });
}

// === INPUT ===
const input = { x: 0, y: 0 };
const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.code === 'Space') placeBlock();
    if (e.code === 'KeyE') destroyBlock();
    if (e.code === 'KeyQ') placeTorch();
});

window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

// === MOBILE CONTROLS ===
const joystickZone = document.getElementById('joystick-zone');
const joystickBase = document.getElementById('joystick-base');
const joystickKnob = document.getElementById('joystick-knob');

let joystickActive = false;
let joystickOrigin = { x: 0, y: 0 };

joystickZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    joystickActive = true;
    joystickOrigin = { x: touch.clientX, y: touch.clientY };

    // Show joystick at touch position
    joystickBase.style.display = 'block';
    joystickBase.style.left = (touch.clientX - 60) + 'px';
    joystickBase.style.top = (touch.clientY - 60) + 'px';

    // Reset knob
    joystickKnob.style.left = '50%';
    joystickKnob.style.top = '50%';
});

joystickZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!joystickActive) return;

    const touch = e.touches[0];
    const dx = touch.clientX - joystickOrigin.x;
    const dy = touch.clientY - joystickOrigin.y;

    // Limit to radius
    const maxRadius = 50;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;

    // Move knob visually
    joystickKnob.style.left = `calc(50% + ${knobX}px)`;
    joystickKnob.style.top = `calc(50% + ${knobY}px)`;

    // Set input (normalized -1 to 1)
    input.x = knobX / maxRadius;
    input.y = knobY / maxRadius;
});

joystickZone.addEventListener('touchend', (e) => {
    e.preventDefault();
    joystickActive = false;
    joystickBase.style.display = 'none';
    input.x = 0;
    input.y = 0;
});

// Mobile action buttons
document.getElementById('btn-build')?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    placeBlock();
});

document.getElementById('btn-attack')?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    destroyBlock();
});

document.getElementById('btn-torch')?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    placeTorch();
});

// === WORLD OBJECTS ===
let worldSpawned = false;
let crystalLight;

function spawnWorldObjects() {
    if (worldSpawned) return;
    worldSpawned = true;

    const cx = MAP_SIZE / 2 * TILE_SIZE;
    const cz = MAP_SIZE / 2 * TILE_SIZE;

    // Crystal
    const crystalTex = textureLoader.load(basePath + 'crystal_rock.png');
    crystalTex.magFilter = THREE.NearestFilter;

    const crystalMat = new THREE.MeshStandardMaterial({
        map: crystalTex,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        roughness: 0.4,
        metalness: 0.3
    });

    const crystalGeo = new THREE.PlaneGeometry(1.5, 1.5);
    const crystalGroup = new THREE.Group();

    const plane1 = new THREE.Mesh(crystalGeo, crystalMat);
    plane1.position.y = 0.75;
    crystalGroup.add(plane1);

    const plane2 = new THREE.Mesh(crystalGeo, crystalMat);
    plane2.rotation.y = Math.PI / 2;
    plane2.position.y = 0.75;
    crystalGroup.add(plane2);

    crystalGroup.position.set(cx, 0, cz);
    scene.add(crystalGroup);

    crystalLight = new THREE.PointLight(0xaaddff, 3, 10);
    crystalLight.position.set(cx, 1.5, cz);
    scene.add(crystalLight);

    objectsMap.set(getKey(cx, cz), { type: 'solid', mesh: crystalGroup });

    // Rocks
    const rockGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    const rockMat = new THREE.MeshStandardMaterial({ map: blockTexture, roughness: 0.9 });

    const rockPositions = [
        { x: cx - 2 * TILE_SIZE, z: cz + 2 * TILE_SIZE },
        { x: cx + 2 * TILE_SIZE, z: cz + 3 * TILE_SIZE },
        { x: cx - 4 * TILE_SIZE, z: cz - 1 * TILE_SIZE },
        { x: cx + 1 * TILE_SIZE, z: cz + 4 * TILE_SIZE },
        { x: cx - 3 * TILE_SIZE, z: cz + 3 * TILE_SIZE }
    ];

    rockPositions.forEach(pos => {
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set(pos.x, 0.35, pos.z);
        rock.castShadow = true;
        rock.receiveShadow = true;
        scene.add(rock);
        objectsMap.set(getKey(pos.x, pos.z), { type: 'rock', mesh: rock, hp: 1, destructible: true });
    });

    // Grass floor area (5x5)
    const grassTexture = textureLoader.load(basePath + 'grass.png');
    grassTexture.magFilter = THREE.NearestFilter;
    grassTexture.minFilter = THREE.NearestFilter;

    const grassMat = new THREE.MeshStandardMaterial({
        map: grassTexture,
        roughness: 0.9
    });

    // Create 5x5 grass area
    const grassStartX = cx + 4 * TILE_SIZE;
    const grassStartZ = cz - 2 * TILE_SIZE;

    for (let gx = 0; gx < 5; gx++) {
        for (let gz = 0; gz < 5; gz++) {
            const grassFloor = new THREE.Mesh(
                new THREE.BoxGeometry(0.7, 0.7, 0.7),
                grassMat
            );

            const posX = grassStartX + gx * TILE_SIZE;
            const posZ = grassStartZ + gz * TILE_SIZE;

            grassFloor.position.set(posX, -0.35, posZ);
            grassFloor.receiveShadow = true;
            scene.add(grassFloor);

            objectsMap.set(getKey(posX, posZ), {
                type: 'floor',
                mesh: grassFloor,
                hp: 3,
                isRebuilt: true,
                isGrass: true
            });
        }
    }

    // Wood floor area 1 (5x5)
    const wood1Tex = textureLoader.load(basePath + 'wood1.jpg');
    wood1Tex.magFilter = THREE.NearestFilter;
    const wood1Mat = new THREE.MeshStandardMaterial({ map: wood1Tex, roughness: 0.8 });

    const wood1StartX = cx - 6 * TILE_SIZE;
    const wood1StartZ = cz + 4 * TILE_SIZE;

    for (let wx = 0; wx < 5; wx++) {
        for (let wz = 0; wz < 5; wz++) {
            const woodFloor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), wood1Mat);
            const posX = wood1StartX + wx * TILE_SIZE;
            const posZ = wood1StartZ + wz * TILE_SIZE;
            woodFloor.position.set(posX, -0.35, posZ);
            woodFloor.receiveShadow = true;
            scene.add(woodFloor);
            objectsMap.set(getKey(posX, posZ), { type: 'floor', mesh: woodFloor, hp: 3, isRebuilt: true });
        }
    }

    // Wood floor area 2 (5x5)
    const wood2Tex = textureLoader.load(basePath + 'wood2.jpg');
    wood2Tex.magFilter = THREE.NearestFilter;
    const wood2Mat = new THREE.MeshStandardMaterial({ map: wood2Tex, roughness: 0.8 });

    const wood2StartX = cx - 6 * TILE_SIZE;
    const wood2StartZ = cz - 6 * TILE_SIZE;

    for (let wx = 0; wx < 5; wx++) {
        for (let wz = 0; wz < 5; wz++) {
            const woodFloor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), wood2Mat);
            const posX = wood2StartX + wx * TILE_SIZE;
            const posZ = wood2StartZ + wz * TILE_SIZE;
            woodFloor.position.set(posX, -0.35, posZ);
            woodFloor.receiveShadow = true;
            scene.add(woodFloor);
            objectsMap.set(getKey(posX, posZ), { type: 'floor', mesh: woodFloor, hp: 3, isRebuilt: true });
        }
    }

    // Water area 1 (3x3) - deep water (blocks movement)
    const water1Tex = textureLoader.load(basePath + 'water1.jpg');
    water1Tex.magFilter = THREE.NearestFilter;
    const water1Mat = new THREE.MeshStandardMaterial({ map: water1Tex, roughness: 0.2, metalness: 0.3 });

    const water1StartX = cx + 10 * TILE_SIZE;
    const water1StartZ = cz - 5 * TILE_SIZE;

    for (let wx = 0; wx < 3; wx++) {
        for (let wz = 0; wz < 3; wz++) {
            const waterFloor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), water1Mat);
            const posX = water1StartX + wx * TILE_SIZE;
            const posZ = water1StartZ + wz * TILE_SIZE;
            waterFloor.position.set(posX, -0.30, posZ);
            waterFloor.receiveShadow = true;
            scene.add(waterFloor);
            objectsMap.set(getKey(posX, posZ), { type: 'water', mesh: waterFloor });
        }
    }

    // Water area 2 with coast (4x4)
    const water2Tex = textureLoader.load(basePath + 'water2.jpg');
    water2Tex.magFilter = THREE.NearestFilter;
    const water2Mat = new THREE.MeshStandardMaterial({ map: water2Tex, roughness: 0.2, metalness: 0.3 });

    const water2StartX = cx + 10 * TILE_SIZE;
    const water2StartZ = cz + 3 * TILE_SIZE;

    for (let wx = 0; wx < 4; wx++) {
        for (let wz = 0; wz < 4; wz++) {
            const waterFloor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), water2Mat);
            const posX = water2StartX + wx * TILE_SIZE;
            const posZ = water2StartZ + wz * TILE_SIZE;
            waterFloor.position.set(posX, -0.30, posZ);
            waterFloor.receiveShadow = true;
            scene.add(waterFloor);
            objectsMap.set(getKey(posX, posZ), { type: 'water', mesh: waterFloor });
        }
    }
}

// === GAME LOOP ===
const SPEED = 0.03;
let lastFacing = { x: 0, y: 1 };
let isGameRunning = false;

function animate() {
    isGameRunning = true;
    requestAnimationFrame(animate);

    spawnWorldObjects();

    if (!player) return;

    // INPUT
    let dx = input.x;
    let dy = input.y;
    if (keys['w'] || keys['arrowup']) dy = -1;
    if (keys['s'] || keys['arrowdown']) dy = 1;
    if (keys['a'] || keys['arrowleft']) dx = -1;
    if (keys['d'] || keys['arrowright']) dx = 1;

    let isMoving = (Math.abs(dx) > 0 || Math.abs(dy) > 0);

    if (isMoving) {
        if (Math.abs(dx) > Math.abs(dy)) {
            lastFacing.x = Math.sign(dx); lastFacing.y = 0;
        } else {
            lastFacing.x = 0; lastFacing.y = Math.sign(dy);
        }

        const nextX = player.position.x + dx * SPEED;
        const nextZ = player.position.z + dy * SPEED;

        // Collision
        let collision = false;
        const range = 0.2;
        const checks = [
            [nextX - range, nextZ - range], [nextX + range, nextZ - range],
            [nextX - range, nextZ + range], [nextX + range, nextZ + range]
        ];

        for (let p of checks) {
            const k = getKey(p[0], p[1]);
            if (!objectsMap.has(k)) {
                collision = true; break;
            }
            const objData = objectsMap.get(k);
            if (objData.type !== 'torch' && objData.type !== 'floor') {
                collision = true; break;
            }
        }

        // Light Flicker
        if (playerLight && player) {
            const time = Date.now() * 0.005;
            const flicker = (Math.random() - 0.5) * 0.2 + Math.sin(time * 10) * 0.1;
            playerLight.intensity = 2.0 + flicker;
            playerLight.position.x = player.position.x;
            playerLight.position.z = player.position.z;
        }

        if (!collision) {
            player.position.x = nextX;
            player.position.z = nextZ;

            if (playerShadow) {
                playerShadow.position.set(nextX, 0.02, nextZ + 0.05);
            }
            if (playerLight) {
                playerLight.position.set(nextX, 1.5, nextZ);
            }
        }
    }

    // DROP COLLECTION
    for (let i = drops.length - 1; i >= 0; i--) {
        const drop = drops[i];
        drop.mesh.rotation.z += 0.01;
        const bobTime = (Date.now() - drop.spawnTime) * 0.005;
        drop.mesh.position.y = 0.15 + Math.sin(bobTime) * 0.05;

        const ddx = player.position.x - drop.mesh.position.x;
        const ddz = player.position.z - drop.mesh.position.z;
        const dist = Math.sqrt(ddx * ddx + ddz * ddz);

        if (dist < 0.5) {
            scene.remove(drop.mesh);
            drops.splice(i, 1);
            console.log("Zebrano:", drop.type);
        }
    }

    // SELECTOR
    const sIx = Math.round((player.position.x + lastFacing.x * TILE_SIZE) / TILE_SIZE);
    const sIz = Math.round((player.position.z + lastFacing.y * TILE_SIZE) / TILE_SIZE);
    selector.position.x = sIx * TILE_SIZE;
    selector.position.z = sIz * TILE_SIZE;

    // ANIMATION
    if (isSpriteSheet && player.userData.isStitched) {
        if (isAttacking && player.userData.slashTex) {
            if (player.material.map !== player.userData.slashTex) {
                player.material.map = player.userData.slashTex;
            }
            const count = 8;
            const speed = 60;
            const frameIndex = Math.floor((Date.now() - attackStartTime) / speed);

            if (frameIndex >= count) {
                isAttacking = false;
            } else {
                // Fix: Adjust offset when flipped
                const facingRight = lastFacing.x >= 0;
                if (facingRight) {
                    player.material.map.offset.x = (frameIndex + 1) / count;
                    player.material.map.repeat.x = -1 / count;
                } else {
                    player.material.map.offset.x = frameIndex / count;
                    player.material.map.repeat.x = 1 / count;
                }
                player.material.map.offset.y = 0;
            }
        } else if (isMoving) {
            if (player.userData.runTex && player.material.map !== player.userData.runTex) {
                player.material.map = player.userData.runTex;
            }
            const count = 10;
            const speed = 80;
            const frameIndex = Math.floor(Date.now() / speed) % count;

            // Determine facing direction
            let facingRight = lastFacing.x >= 0;
            if (dx < -0.01) facingRight = false;
            else if (dx > 0.01) facingRight = true;

            // Fix: Adjust offset when flipped
            if (facingRight) {
                player.material.map.offset.x = (frameIndex + 1) / count;
                player.material.map.repeat.x = -1 / count;
            } else {
                player.material.map.offset.x = frameIndex / count;
                player.material.map.repeat.x = 1 / count;
            }
            player.material.map.offset.y = 0;
        } else {
            if (player.userData.idleTex && player.material.map !== player.userData.idleTex) {
                player.material.map = player.userData.idleTex;
            }
            const count = 12;

            const speed = 100;
            const frameIndex = Math.floor(Date.now() / speed) % count;

            // Fix: When flipped (facing right), offset needs adjustment
            const facingRight = lastFacing.x >= 0;
            if (facingRight) {
                // Flipped - need to offset by one frame width
                player.material.map.offset.x = (frameIndex + 1) / count;
                player.material.map.repeat.x = -1 / count;
            } else {
                // Normal - facing left
                player.material.map.offset.x = frameIndex / count;
                player.material.map.repeat.x = 1 / count;
            }
            player.material.map.offset.y = 0;
        }

        // Shadow sync
        if (playerShadow && playerShadow.material.map !== player.material.map) {
            playerShadow.material.map = player.material.map;
            playerShadow.material.needsUpdate = true;
        }
    }


    // Camera Follow
    const targetX = player.position.x;
    const targetZ = player.position.z + 5;
    camera.position.x += (targetX - camera.position.x) * 0.2;
    camera.position.z += (targetZ - camera.position.z) * 0.2;
    camera.position.y = 7;
    camera.lookAt(camera.position.x, 0, camera.position.z - 5);

    renderer.render(scene, camera);
}

// === AUTO START ===
document.getElementById('char-selection').style.display = 'none';
startGame('adventurer_run');
