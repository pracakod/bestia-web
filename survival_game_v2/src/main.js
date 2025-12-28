import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';
import { initMultiplayer } from './multiplayer.js';

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
function handleResize() {
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
}
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', () => setTimeout(handleResize, 100));
// Initial resize after page load
setTimeout(handleResize, 50);

// === AMBIENT LIGHT ===
const ambient = new THREE.AmbientLight(0x222233, 0.15);
scene.add(ambient);

// === DIRECTIONAL LIGHT (for shadows) ===
const dirLight = new THREE.DirectionalLight(0xaabbcc, 0.25);
dirLight.position.set(30, 50, 30);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024; // Optimized from 2048
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 150;
dirLight.shadow.camera.left = -50;
dirLight.shadow.camera.right = 50;
dirLight.shadow.camera.top = 50;
dirLight.shadow.camera.bottom = -50;
scene.add(dirLight);

// === CONSTANTS ===
const TILE_SIZE = 0.7;
const MAP_SIZE = 5000; // MASSIVE MAP
const VIEW_RADIUS = 22; // Reduced for performance
const CENTER = MAP_SIZE / 2;
const GAME_VERSION = "v1.3.0";
const LAST_UPDATE = "Fixed Remote Action Sync";

// Biome thresholds (distance from center)
const STONE_RADIUS = 800;  // Inner stone/cave biome
const GRASS_RADIUS = 2000;  // Middle grass/forest biome
// Beyond GRASS_RADIUS = sand/water biome

// === MULTIPLAYER STATE ===
let multiplayer = null;
const otherPlayers = new Map(); // id -> { mesh, shadow, label }
let playerLabel = null;

// === TEXTURES ===
const textureLoader = new THREE.TextureLoader();
const basePath = './public/img/';

// Load all biome textures
const stoneFloorTex = textureLoader.load(basePath + 'floor.jpg');
stoneFloorTex.magFilter = THREE.NearestFilter;

const stoneWallTex = textureLoader.load(basePath + 'rock_texture.jpg');
stoneWallTex.magFilter = THREE.NearestFilter;

const grassTex = textureLoader.load(basePath + 'grass.png');
grassTex.magFilter = THREE.NearestFilter;

const sandTex = textureLoader.load(basePath + 'sand.png');
sandTex.magFilter = THREE.NearestFilter;

const waterTex = textureLoader.load(basePath + 'water1.jpg');
waterTex.magFilter = THREE.NearestFilter;

const workbenchTex = textureLoader.load(basePath + 'workbench.png');
workbenchTex.magFilter = THREE.NearestFilter;

const chestTex = textureLoader.load(basePath + 'chest.png');
chestTex.magFilter = THREE.NearestFilter;

// Keep references for compatibility
const floorTexture = stoneFloorTex;
const blockTexture = stoneWallTex;

// === DYNAMIC CHUNK SYSTEM ===
const voxelGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);

// Materials for each biome
const stoneMat = new THREE.MeshStandardMaterial({ map: stoneFloorTex, roughness: 0.9 });
const stoneWallMat = new THREE.MeshStandardMaterial({ map: stoneWallTex, roughness: 0.9 });
const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.9 });
const sandMat = new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.9 });
const waterMaterial = new THREE.MeshStandardMaterial({ map: waterTex, roughness: 0.3, metalness: 0.2 });

// Compatibility references
const floorMat = stoneMat;
const wallMat = stoneWallMat;

// Loaded tiles and collision map
const loadedTiles = new Map();
const objectsMap = new Map();

// === TORCH LIGHT POOL (Performance optimization) ===
// Instead of creating PointLight for each torch, use a pool of lights
// that are dynamically assigned to the closest torches each frame
const MAX_TORCH_LIGHTS = 5; // Maximum active lights
const torchLightPool = [];
for (let i = 0; i < MAX_TORCH_LIGHTS; i++) {
    const light = new THREE.PointLight(0xffaa00, 8.0, 15);
    light.decay = 1.5;
    light.castShadow = false;
    light.visible = false;
    scene.add(light);
    torchLightPool.push(light);
}

// Track all torch positions for light assignment
const torchPositions = [];

function getKey(worldX, worldZ) {
    const gx = Math.round(worldX / TILE_SIZE);
    const gz = Math.round(worldZ / TILE_SIZE);
    return `${gx},${gz}`;
}

function getTileKey(gx, gz) {
    return `${gx},${gz}`;
}

// === MUTATIONS CACHE ===
// Cache for world mutations - loaded once at start, applied when chunks load
const mutationsCache = new Map(); // key: "x,z" -> { type: 'build'|'destroy'|'torch', applied: false }

function addMutationToCache(type, x, z) {
    const gx = Math.round(x / TILE_SIZE);
    const gz = Math.round(z / TILE_SIZE);
    const key = getTileKey(gx, gz);
    mutationsCache.set(key, { type, x, z, applied: false });
}

function getMutationForTile(gx, gz) {
    const key = getTileKey(gx, gz);
    return mutationsCache.get(key);
}

function markMutationApplied(gx, gz) {
    const key = getTileKey(gx, gz);
    const mutation = mutationsCache.get(key);
    if (mutation) mutation.applied = true;
}

// === APPLY MUTATIONS (Silent - no network, no animation) ===
// These are used when loading cached mutations into visible chunks

function applyMutationDestroy(x, z) {
    const key = getKey(x, z);
    const objData = objectsMap.get(key);
    if (!objData) return;

    if (objData.type === 'built' || objData.type === 'torch' || objData.type === 'wall' || objData.type === 'rock') {
        scene.remove(objData.mesh);
        const floor = new THREE.Mesh(voxelGeo, stoneMat.clone());
        floor.position.set(x, -0.35, z);
        floor.receiveShadow = true;
        scene.add(floor);
        objectsMap.set(key, { type: 'floor', mesh: floor, hp: 3, isRebuilt: true });
    } else if (objData.type === 'floor') {
        scene.remove(objData.mesh);
        objectsMap.delete(key);
    }
}

function applyMutationBuild(x, z) {
    const key = getKey(x, z);
    const objData = objectsMap.get(key);

    if (!objData) {
        // Hole - rebuild floor
        const floorBlock = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 0.7, 0.7),
            new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.9 })
        );
        floorBlock.position.set(x, -0.35, z);
        floorBlock.receiveShadow = true;
        scene.add(floorBlock);
        objectsMap.set(key, { type: 'floor', mesh: floorBlock, hp: 3, isRebuilt: true });
    } else if (objData.type === 'floor') {
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
        objectsMap.set(key, { type: 'built', mesh: box });
    }
}

function applyMutationTorch(x, z) {
    const key = getKey(x, z);
    const objData = objectsMap.get(key);
    if (!objData || objData.type !== 'floor') return;

    const torchGeoLocal = new THREE.BoxGeometry(0.1, 0.4, 0.1);
    const torchMatLocal = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const torch = new THREE.Mesh(torchGeoLocal, torchMatLocal);
    torch.position.set(x, 0.2, z);
    scene.add(torch);

    // Track torch position for light pool assignment (no PointLight created here!)
    torchPositions.push({ x, z });

    objectsMap.set(key, { type: 'torch', mesh: torch });
}

const WORLD_SEED = 12345; // Fixed seed
console.log("World Seed:", WORLD_SEED);

// Hash function for pseudo-random numbers
function seededRandom(x, z) {
    const seed = (x + WORLD_SEED) * 374761393 + (z + WORLD_SEED) * 668265263;
    let t = (seed ^ (seed >> 13)) * 1274126177;
    t = (t ^ (t >> 16));
    return (t & 0x7fffffff) / 0x7fffffff;
}

// === NOISE GENERATOR (Value Noise) ===
function lerp(a, b, t) { return a + (b - a) * t; }
function smooth(t) { return t * t * (3 - 2 * t); }

function valueNoise(x, z) {
    const xi = Math.floor(x);
    const zi = Math.floor(z);

    // Smooth interpolation weights
    const sx = smooth(x - xi);
    const sz = smooth(z - zi);

    // Random values at corners
    const n00 = seededRandom(xi, zi);
    const n10 = seededRandom(xi + 1, zi);
    const n01 = seededRandom(xi, zi + 1);
    const n11 = seededRandom(xi + 1, zi + 1);

    // Mix
    const nx0 = lerp(n00, n10, sx);
    const nx1 = lerp(n01, n11, sx);
    return lerp(nx0, nx1, sz);
}

// Determine biome based on distance from center
function getBiome(gx, gz) {
    const dx = gx - CENTER;
    const dz = gz - CENTER;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < STONE_RADIUS) return 'stone';
    if (dist < GRASS_RADIUS) return 'grass';
    return 'sand';
}

// Determine tile type with ORGANIC GENERATION
function getTileType(gx, gz) {
    const biome = getBiome(gx, gz);

    // Map edges
    if (gx <= 1 || gx >= MAP_SIZE - 2 || gz <= 1 || gz >= MAP_SIZE - 2) {
        return { type: 'wall', biome };
    }

    // Clear spawn area
    const dx = gx - CENTER;
    const dz = gz - CENTER;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 15) return { type: 'floor', biome: 'stone' }; // Larger spawn

    if (biome === 'stone') {
        // CAVES: Organic shapes
        // Scale 0.08 = nice caverns
        const caveNoise = valueNoise(gx * 0.08, gz * 0.08);
        const detail = valueNoise(gx * 0.2, gz * 0.2) * 0.2;

        // Threshold: > 0.55 is wall, else floor
        if (caveNoise + detail > 0.55) return { type: 'wall', biome };

    } else if (biome === 'grass') {
        // FOREST: Tree clumps
        const treeNoise = valueNoise(gx * 0.1, gz * 0.1);
        if (treeNoise > 0.65) return { type: 'wall', biome };

    } else if (biome === 'sand') {
        // OCEAN: Large bodies of water
        const waterNoise = valueNoise(gx * 0.04, gz * 0.04);
        if (waterNoise < 0.45) return { type: 'water', biome };

        // Rare rocks
        if (seededRandom(gx, gz) < 0.01) return { type: 'wall', biome };
    }

    return { type: 'floor', biome };
}

// Get floor material for biome
function getFloorMaterial(biome) {
    if (biome === 'grass') return grassMat;
    if (biome === 'sand') return sandMat;
    return stoneMat;
}

// Load a single tile
function loadTile(gx, gz) {
    const key = getTileKey(gx, gz);
    if (loadedTiles.has(key)) return;
    if (gx < 0 || gx >= MAP_SIZE || gz < 0 || gz >= MAP_SIZE) return;

    const worldX = gx * TILE_SIZE;
    const worldZ = gz * TILE_SIZE;
    const tileInfo = getTileType(gx, gz);

    if (tileInfo.type === 'water') {
        const water = new THREE.Mesh(voxelGeo, waterMaterial);
        water.position.set(worldX, -0.40, worldZ);
        water.receiveShadow = true;
        scene.add(water);
        objectsMap.set(key, { type: 'water', mesh: water });
        loadedTiles.set(key, { mesh: water, gx, gz });
    } else {
        const floor = new THREE.Mesh(voxelGeo, getFloorMaterial(tileInfo.biome).clone());
        floor.position.set(worldX, -0.35, worldZ);
        floor.receiveShadow = true;
        scene.add(floor);

        if (tileInfo.type === 'wall') {
            const wall = new THREE.Mesh(voxelGeo, stoneWallMat.clone());
            wall.position.set(worldX, 0.35, worldZ);
            wall.castShadow = true;
            wall.receiveShadow = true;
            scene.add(wall);
            objectsMap.set(key, { type: 'wall', mesh: wall, floorMesh: floor, hp: 1 });
            loadedTiles.set(key, { mesh: wall, floor, gx, gz });
        } else {
            objectsMap.set(key, { type: 'floor', mesh: floor, hp: 3, isRebuilt: true });
            loadedTiles.set(key, { mesh: floor, gx, gz });
        }
    }

    // === APPLY CACHED MUTATION (if any) ===
    const mutation = getMutationForTile(gx, gz);
    if (mutation && !mutation.applied) {
        markMutationApplied(gx, gz);
        // Apply mutation silently (isRemote=true to avoid re-saving/re-broadcasting)
        if (mutation.type === 'destroy') {
            applyMutationDestroy(mutation.x, mutation.z);
        } else if (mutation.type === 'build') {
            applyMutationBuild(mutation.x, mutation.z);
        } else if (mutation.type === 'torch') {
            applyMutationTorch(mutation.x, mutation.z);
        }
    }
}

// Unload a tile
function unloadTile(key) {
    const tile = loadedTiles.get(key);
    if (!tile) return;
    if (tile.mesh) scene.remove(tile.mesh);
    if (tile.floor) scene.remove(tile.floor);
    loadedTiles.delete(key);
    objectsMap.delete(key);
}

// Update chunks around player
let lastChunkX = -999, lastChunkZ = -999;

function updateChunks(playerX, playerZ) {
    const pgx = Math.round(playerX / TILE_SIZE);
    const pgz = Math.round(playerZ / TILE_SIZE);

    if (Math.abs(pgx - lastChunkX) < 2 && Math.abs(pgz - lastChunkZ) < 2) return;
    lastChunkX = pgx;
    lastChunkZ = pgz;

    for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
        for (let dz = -VIEW_RADIUS; dz <= VIEW_RADIUS; dz++) {
            loadTile(pgx + dx, pgz + dz);
        }
    }

    const unloadRadius = VIEW_RADIUS + 5; // Aggressive unload
    for (const [key, tile] of loadedTiles) {
        const dist = Math.max(Math.abs(tile.gx - pgx), Math.abs(tile.gz - pgz));
        if (dist > unloadRadius) unloadTile(key);
    }
}

// Dummy functions for old code compatibility
function hideFloorInstance(instanceId) { }
const floorMesh = { setColorAt: () => { }, setMatrixAt: () => { }, getMatrixAt: () => { }, instanceColor: { needsUpdate: false }, instanceMatrix: { needsUpdate: false } };
const caveWalls = { setMatrixAt: () => { }, getMatrixAt: () => { }, instanceMatrix: { needsUpdate: false } };

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
    // Fallsback to hide loading screen after 4s (in case of error)
    setTimeout(() => {
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';

        // Force start loop if not running
        if (!isGameRunning && player) {
            animate();
        }
    }, 4000);

    if (avatarUrl === 'adventurer_run') {
        let runTex = null, idleTex = null, slashTex = null;

        const checkReady = () => {
            if (runTex && idleTex && slashTex) {
                setupPlayer(runTex, true, idleTex, slashTex);
                document.getElementById('loading').style.display = 'none';
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

function createNameLabel(text) {
    console.log('Creating name label:', text);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    context.clearRect(0, 0, 256, 64);
    context.font = 'Bold 32px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.strokeStyle = 'black';
    context.lineWidth = 4;
    context.strokeText(text, 128, 32);
    context.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        sizeAttenuation: true
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2, 0.5, 1);
    sprite.renderOrder = 1000;
    return sprite;
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

        playerLabel = createNameLabel('Gracz');
        scene.add(playerLabel);

        // === STARTING ITEMS ===
        const placeObjectOnGrid = (gx, gz, texture, type) => {
            const key = getKey(gx * TILE_SIZE, gz * TILE_SIZE);
            const worldX = gx * TILE_SIZE;
            const worldZ = gz * TILE_SIZE;

            // 1. Manually place floor & mark loaded to prevent overwrite
            if (!loadedTiles.has(key)) {
                const floor = new THREE.Mesh(voxelGeo, stoneFloorTex.clone());
                floor.position.set(worldX, -0.35, worldZ);
                floor.receiveShadow = true;
                scene.add(floor);
                loadedTiles.set(key, { mesh: floor, gx, gz });
            }

            // 2. Add Object as Mesh (Standard Material to react to light)
            const mat = new THREE.MeshStandardMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.5,
                roughness: 1,
                metalness: 0,
                side: THREE.DoubleSide
            });

            // Size 0.8x0.8 fits well on 0.7 tile visual
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), mat);

            // Tilt slightly back (billboard style)
            mesh.rotation.x = -Math.PI / 6;
            // Lift up
            mesh.position.set(worldX, 0.3, worldZ);

            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);

            // Simple blob shadow (optional, but keep for style)
            const shadow = new THREE.Mesh(
                new THREE.PlaneGeometry(0.5, 0.25),
                new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })
            );
            shadow.rotation.x = -Math.PI / 2;
            shadow.position.set(worldX, 0.03, worldZ + 0.05);
            scene.add(shadow);

            // 3. Set collision
            objectsMap.set(key, { type: type, mesh: mesh });
        };

        const startGx = Math.floor(MAP_SIZE / 2) + 2;
        const startGz = Math.floor(MAP_SIZE / 2) + 2;

        placeObjectOnGrid(startGx + 2, startGz, workbenchTex, 'workbench');
        placeObjectOnGrid(startGx + 3, startGz, chestTex, 'chest');

        // === INITIALIZE MULTIPLAYER ===
        console.log('Main: Starting multiplayer init...');
        multiplayer = initMultiplayer(
            // Position update - store target for interpolation
            (data) => {
                const p = otherPlayers.get(data.id);
                if (p) {
                    // First position update - set directly without interpolation
                    if (p.targetX === null || p.targetZ === null) {
                        p.mesh.position.set(data.x, 0.6, data.z);
                        p.shadow.position.set(data.x, 0.02, data.z + 0.05);
                        p.label.position.set(data.x, 1.8, data.z);
                    }

                    // Store target position for smooth interpolation
                    p.targetX = data.x;
                    p.targetZ = data.z;

                    // Update Animation States
                    p.isMoving = data.moving;
                    p.isAttacking = data.attacking;
                    p.facingRight = data.facingRight;
                }
            },
            // Join
            (id, number) => {
                const runT = texture.clone();
                const idleT = idleTexture.clone();
                const slashT = slashTexture.clone();
                runT.needsUpdate = true;
                idleT.needsUpdate = true;
                slashT.needsUpdate = true;

                const mat = new THREE.SpriteMaterial({ map: idleT, transparent: true, alphaTest: 0.5, color: 0x8888ff });
                const m = new THREE.Sprite(mat);
                m.scale.set(1.5 * 0.9, 1.5 * 0.9, 1);
                m.position.set(0, 0.6, 0);
                scene.add(m);

                const sGeo = new THREE.PlaneGeometry(0.8, 0.4);
                const sMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
                const s = new THREE.Mesh(sGeo, sMat);
                s.rotation.x = -Math.PI / 2;
                scene.add(s);

                const label = createNameLabel(`Gracz ${number}`);
                scene.add(label);

                otherPlayers.set(id, {
                    mesh: m,
                    shadow: s,
                    label: label,
                    runTex: runT,
                    idleTex: idleT,
                    slashTex: slashT,
                    isMoving: false,
                    isAttacking: false,
                    facingRight: true,
                    targetX: null, // null = not yet received first position
                    targetZ: null
                });
                console.log('Player joined:', id, 'as Gracz', number);
            },
            // Leave
            (id) => {
                const p = otherPlayers.get(id);
                if (p) {
                    scene.remove(p.mesh);
                    scene.remove(p.shadow);
                    scene.remove(p.label);
                    otherPlayers.delete(id);
                }
                console.log('Player left:', id);
            },
            // Server Full
            () => {
                alert('Serwer pełny! (Max 2 graczy)');
                window.location.reload();
            },
            // Local Number Update
            (number) => {
                if (playerLabel) {
                    scene.remove(playerLabel);
                    playerLabel = createNameLabel(`Gracz ${number}`);
                    scene.add(playerLabel);
                }
            },
            // Remote Action (build, destroy, torch)
            (action) => {
                console.log('Remote action:', action);
                if (action.type === 'destroy') {
                    destroyBlock(action.x, action.z, true);
                } else if (action.type === 'build') {
                    placeBlock(action.x, action.z, true);
                } else if (action.type === 'torch') {
                    placeTorch(action.x, action.z, true);
                }
            }
        );

        // === LOAD SAVED WORLD MUTATIONS TO CACHE ===
        // Mutations are cached and applied only when chunks become visible (in loadTile)
        if (multiplayer && multiplayer.loadMutations) {
            multiplayer.loadMutations().then(mutations => {
                console.log('Caching', mutations.length, 'mutations (will apply when visible)...');
                for (const m of mutations) {
                    addMutationToCache(m.mutation_type, m.x, m.z);
                }
            });
        }
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

const dropWoodTexture = textureLoader.load(basePath + 'wood1.jpg');
dropWoodTexture.magFilter = THREE.NearestFilter;

function spawnDrop(x, z, type = 'stone') {
    const tex = type === 'wood' ? dropWoodTexture : dropTexture;

    const dropGeo = new THREE.PlaneGeometry(0.2, 0.2);
    const dropMat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide
    });

    const drop = new THREE.Mesh(dropGeo, dropMat);
    drop.position.set(x + (Math.random() - 0.5) * 0.3, 0.2, z + (Math.random() - 0.5) * 0.3);
    drop.rotation.x = -Math.PI / 2;

    scene.add(drop);
    drops.push({ mesh: drop, spawnTime: Date.now(), type: type });
}

function triggerAttack() {
    if (isAttacking) return;
    isAttacking = true;
    attackStartTime = Date.now();
}

// === DESTROY BLOCK ===
// === DESTROY BLOCK ===
function destroyBlock(tx, tz, isRemote = false) {
    // Only trigger attack animation for local player
    if (!isRemote) {
        triggerAttack();
    }
    const x = tx !== undefined ? tx : selector.position.x;
    const z = tz !== undefined ? tz : selector.position.z;
    const key = getKey(x, z);

    if (!isRemote && multiplayer && multiplayer.sendAction) {
        multiplayer.sendAction('destroy', x, z);
        // Save to database for persistence
        if (multiplayer.saveMutation) {
            multiplayer.saveMutation('destroy', x, z);
        }
    }

    // Prevent destroying floor too close to player (only for local)
    const dist = Math.sqrt((x - player.position.x) ** 2 + (z - player.position.z) ** 2);
    const objData = objectsMap.get(key);

    // If chunk not loaded (remote action), cache for later application
    if (!objData && isRemote) {
        addMutationToCache('destroy', x, z);
        console.log('Remote destroy cached for later:', x, z);
        return;
    }

    // Check if any player is standing on this tile
    if (!isRemote && objData && (objData.type === 'floor' || objData.type === 'wood')) {
        // Check local player
        if (dist < 0.6) {
            console.log("Za blisko!");
            return;
        }
        // Check other players
        for (const p of otherPlayers.values()) {
            const pDist = Math.sqrt((x - p.mesh.position.x) ** 2 + (z - p.mesh.position.z) ** 2);
            if (pDist < 0.6) {
                console.log("Tu stoi inny gracz!");
                return;
            }
        }
    }

    if (objData) {
        if (objData.type === 'built' || objData.type === 'torch') {
            scene.remove(objData.mesh);
            // Create floor replacement for built wall
            const floor = new THREE.Mesh(voxelGeo, stoneMat.clone());
            floor.position.set(x, -0.35, z);
            floor.receiveShadow = true;
            scene.add(floor);
            objectsMap.set(key, { type: 'floor', mesh: floor, hp: 3, isRebuilt: true });

        } else if (objData.type === 'rock') {
            scene.remove(objData.mesh);
            const floor = new THREE.Mesh(voxelGeo, stoneMat.clone());
            floor.position.set(x, -0.35, z);
            floor.receiveShadow = true;
            scene.add(floor);
            objectsMap.set(key, { type: 'floor', mesh: floor, hp: 3, isRebuilt: true });
            spawnDrop(x, z);

        } else if (objData.type === 'wall') {
            // Destroy wall
            scene.remove(objData.mesh);
            spawnDrop(x, z);

            // If chunks generated a floor underneath, it should still be in the scene but untracked or tracked differently?
            // Actually, in loadedTiles we track 'floor' separately. But objectsMap only has the top object.
            // In loadTile, we did: objectsMap.set(key, { type: 'wall', mesh: wall, floorMesh: floor, hp: 1 });

            if (objData.floorMesh) {
                // Reveal the floor underneath
                objectsMap.set(key, { type: 'floor', mesh: objData.floorMesh, hp: 3 });
            } else {
                // Fallback
                const floor = new THREE.Mesh(voxelGeo, stoneMat.clone());
                floor.position.set(x, -0.35, z);
                floor.receiveShadow = true;
                scene.add(floor);
                objectsMap.set(key, { type: 'floor', mesh: floor, hp: 3 });
            }

        } else if (objData.type === 'wood') {
            objData.hp--;
            if (objData.hp === 1) {
                if (objData.mesh.material.color) objData.mesh.material.color.setHex(0xaaaaaa);
            } else if (objData.hp <= 0) {
                scene.remove(objData.mesh);
                spawnDrop(x, z, 'wood');

                const floor = new THREE.Mesh(voxelGeo, stoneMat.clone());
                floor.position.set(x, -0.35, z);
                floor.receiveShadow = true;
                scene.add(floor);
                objectsMap.set(key, { type: 'floor', mesh: floor, hp: 3 });
            }

        } else if (objData.type === 'floor') {
            objData.hp--;

            // Visual damage
            if (!objData.mesh.userData.uniqueMaterial) {
                objData.mesh.material = objData.mesh.material.clone();
                objData.mesh.userData.uniqueMaterial = true;
            }

            if (objData.hp === 2) objData.mesh.material.color.setHex(0xaaaaaa);
            else if (objData.hp === 1) objData.mesh.material.color.setHex(0x555555);
            else if (objData.hp <= 0) {
                scene.remove(objData.mesh);
                objectsMap.delete(key);
                console.log("Dziura!");
            }
        }
    }
}

// === PLACE BLOCK ===
function placeBlock(tx, tz, isRemote = false) {
    const x = tx !== undefined ? tx : selector.position.x;
    const z = tz !== undefined ? tz : selector.position.z;
    const key = getKey(x, z);

    if (!isRemote && multiplayer && multiplayer.sendAction) {
        multiplayer.sendAction('build', x, z);
        if (multiplayer.saveMutation) {
            multiplayer.saveMutation('build', x, z);
        }
    }

    const dist = Math.sqrt((x - player.position.x) ** 2 + (z - player.position.z) ** 2);
    const isHole = !objectsMap.has(key);

    // Allow floor rebuild at any distance (escape mechanism)
    if (!isRemote && !isHole && dist < 0.5) return;

    if (!objectsMap.has(key)) {
        // For remote actions on chunks that might not exist yet, check if tile is loaded
        const gx = Math.round(x / TILE_SIZE);
        const gz = Math.round(z / TILE_SIZE);
        const tileKey = getTileKey(gx, gz);

        if (isRemote && !loadedTiles.has(tileKey)) {
            // Chunk not loaded - cache for later application
            addMutationToCache('build', x, z);
            console.log('Remote build cached for later:', x, z);
            return;
        }

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

function placeTorch(tx, tz, isRemote = false) {
    const x = tx !== undefined ? tx : selector.position.x;
    const z = tz !== undefined ? tz : selector.position.z;
    const key = getKey(x, z);

    if (!isRemote && multiplayer && multiplayer.sendAction) {
        multiplayer.sendAction('torch', x, z);
        if (multiplayer.saveMutation) {
            multiplayer.saveMutation('torch', x, z);
        }
    }

    // If chunk not loaded (remote action), cache for later application
    if (!objectsMap.has(key)) {
        if (isRemote) {
            addMutationToCache('torch', x, z);
            console.log('Remote torch cached for later:', x, z);
        } else {
            console.log("Nie można na dziurze!");
        }
        return;
    }

    const objData = objectsMap.get(key);
    if (objData.type !== 'floor') {
        if (isRemote) {
            addMutationToCache('torch', x, z);
            console.log('Remote torch cached (not floor):', x, z);
        } else {
            console.log("Tylko na podłodze!");
        }
        return;
    }

    const torch = new THREE.Mesh(torchGeo, torchMat);
    torch.position.set(x, 0.2, z);
    scene.add(torch);

    // Track torch position for light pool assignment (no PointLight created here!)
    torchPositions.push({ x, z });

    objectsMap.set(key, { type: 'torch', mesh: torch });
}

// === UPDATE TORCH LIGHTS (Called every frame) ===
// Assigns lights from pool to the closest torches to the player
function updateTorchLights() {
    if (!player || torchPositions.length === 0) {
        // Hide all lights if no player or no torches
        for (const light of torchLightPool) {
            light.visible = false;
        }
        return;
    }

    const px = player.position.x;
    const pz = player.position.z;

    // Calculate distances to all torches
    const distances = torchPositions.map((t, i) => ({
        index: i,
        x: t.x,
        z: t.z,
        dist: Math.sqrt((t.x - px) ** 2 + (t.z - pz) ** 2)
    }));

    // Sort by distance
    distances.sort((a, b) => a.dist - b.dist);

    // Assign lights to closest torches
    for (let i = 0; i < torchLightPool.length; i++) {
        const light = torchLightPool[i];
        if (i < distances.length && distances[i].dist < 30) {
            light.position.set(distances[i].x, 0.8, distances[i].z);
            light.visible = true;
        } else {
            light.visible = false;
        }
    }
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

// === GAME LOOP ===
const clock = new THREE.Clock();
const BASE_SPEED = 6.0; // Faster movement
let lastFacing = { x: 0, y: 1 };
let isGameRunning = false;
let lastNetUpdate = 0; // For multiplayer throttling
let wasMovingLastFrame = false; // Track previous movement state for sync

function animate() {
    isGameRunning = true;
    requestAnimationFrame(animate);

    const delta = clock.getDelta(); // Time since last frame in seconds

    // Dynamic map loading
    updateChunks(player.position.x, player.position.z);

    // Update torch light pool - assign lights to closest torches
    updateTorchLights();

    if (!player) return;

    // INPUT
    let dx = input.x;
    let dy = input.y;
    if (keys['w'] || keys['arrowup']) dy = -1;
    if (keys['s'] || keys['arrowdown']) dy = 1;
    if (keys['a'] || keys['arrowleft']) dx = -1;
    if (keys['d'] || keys['arrowright']) dx = 1;

    // Normalize input vector to prevent faster diagonal movement
    if (dx !== 0 || dy !== 0) {
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 1) { // Only normalize if > 1 (allows partial joystick push)
            dx /= length;
            dy /= length;
        }
    }

    let isMoving = (Math.abs(dx) > 0 || Math.abs(dy) > 0);

    // MULTIPLAYER POS SYNC (Throttle 200ms - optimized for Supabase limits)
    // Send when moving, attacking, OR when just stopped moving (to sync idle state)
    const shouldSendUpdate = isMoving || isAttacking || (wasMovingLastFrame && !isMoving);
    if (multiplayer && Date.now() - lastNetUpdate > 200 && shouldSendUpdate) {
        const facingRight = lastFacing.x >= 0;
        multiplayer.sendPosition(player.position.x, player.position.z, input.x, input.y, isMoving, isAttacking, facingRight);
        lastNetUpdate = Date.now();
    }
    wasMovingLastFrame = isMoving;

    if (isMoving) {
        if (Math.abs(dx) > Math.abs(dy)) {
            lastFacing.x = Math.sign(dx); lastFacing.y = 0;
        } else {
            lastFacing.x = 0; lastFacing.y = Math.sign(dy);
        }

        const moveDist = BASE_SPEED * delta;

        // Collision Helper
        const checkCollision = (cx, cz) => {
            const range = 0.2;
            const points = [
                [cx - range, cz - range], [cx + range, cz - range],
                [cx - range, cz + range], [cx + range, cz + range]
            ];
            for (let p of points) {
                const k = getKey(p[0], p[1]);
                const objData = objectsMap.get(k);

                // Void/Unloaded -> Block
                if (!objData) return true;

                // Water -> Block
                if (objData.type === 'water') return true;

                // Obstacles (Walls, Workbench, Chest, etc) -> Block
                // Allowed: floor, wood, torch
                if (objData.type !== 'floor' && objData.type !== 'wood' && objData.type !== 'torch') {
                    return true;
                }
            }
            return false;
        };

        // Move X
        if (dx !== 0) {
            const nextX = player.position.x + dx * moveDist;
            if (!checkCollision(nextX, player.position.z)) {
                player.position.x = nextX;
            }
        }

        // Move Z
        if (dy !== 0) {
            const nextZ = player.position.z + dy * moveDist;
            if (!checkCollision(player.position.x, nextZ)) {
                player.position.z = nextZ;
            }
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

    // UPDATE COORDINATES DISPLAY
    const pIx = Math.round(player.position.x / TILE_SIZE);
    const pIz = Math.round(player.position.z / TILE_SIZE);
    const coordsEl = document.getElementById('coords');
    if (coordsEl) {
        coordsEl.innerHTML = `
            Gracz: ${pIx} / ${pIz}<br>
            Cel: ${sIx} / ${sIz}<hr style="border:0;border-top:1px solid rgba(255,255,255,0.2);margin:4px 0;">
            <small style="opacity: 0.7">${GAME_VERSION} - ${LAST_UPDATE}</small>
        `;
    }

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

        // ANIMATION FOR OTHER PLAYERS
        for (const p of otherPlayers.values()) {
            // === SMOOTH POSITION INTERPOLATION ===
            // Skip interpolation if target position not yet received
            if (p.targetX !== null && p.targetZ !== null) {
                const lerpFactor = 0.15; // Smoothness (lower = smoother but delayed)
                const currentX = p.mesh.position.x;
                const currentZ = p.mesh.position.z;
                const newX = currentX + (p.targetX - currentX) * lerpFactor;
                const newZ = currentZ + (p.targetZ - currentZ) * lerpFactor;

                p.mesh.position.set(newX, 0.6, newZ);
                p.shadow.position.set(newX, 0.02, newZ + 0.05);
                p.label.position.set(newX, 1.8, newZ);
            }

            if (isSpriteSheet && player.userData.isStitched) {
                let currentTex = p.idleTex;
                let count = 12;
                let speed = 100;

                if (p.isAttacking) {
                    currentTex = p.slashTex;
                    count = 8;
                    speed = 60;
                } else if (p.isMoving) {
                    currentTex = p.runTex;
                    count = 10;
                    speed = 80;
                }

                if (p.mesh.material.map !== currentTex) {
                    p.mesh.material.map = currentTex;
                }

                const frameIndex = Math.floor(Date.now() / speed) % count;
                if (p.facingRight) {
                    p.mesh.material.map.offset.x = (frameIndex + 1) / count;
                    p.mesh.material.map.repeat.x = -1 / count;
                } else {
                    p.mesh.material.map.offset.x = frameIndex / count;
                    p.mesh.material.map.repeat.x = 1 / count;
                }
                p.mesh.material.map.offset.y = 0;
            }
        }

        // Update Shadow & Light Position
        if (playerShadow) {
            playerShadow.position.set(player.position.x, 0.02, player.position.z + 0.05);
        }
        if (playerLight) {
            playerLight.position.set(player.position.x, 1.5, player.position.z);
        }

        if (playerLabel) {
            playerLabel.position.set(player.position.x, 2.2, player.position.z);
        }

        // Shadow sync (Texture)
        if (playerShadow && playerShadow.material.map !== player.material.map) {
            playerShadow.material.map = player.material.map;
            playerShadow.material.needsUpdate = true;
        }

        // Camera Follow


        // Camera Follow
        const targetX = player.position.x;
        const targetZ = player.position.z + 5;
        camera.position.x += (targetX - camera.position.x) * 0.2;
        camera.position.z += (targetZ - camera.position.z) * 0.2;
        camera.position.y = 7;
        camera.lookAt(camera.position.x, 0, camera.position.z - 5);

        // Update UI Coords
        const coordsDiv = document.getElementById('coords');
        if (coordsDiv) {
            const px = Math.round(player.position.x / TILE_SIZE);
            const pz = Math.round(player.position.z / TILE_SIZE);
            const dist = Math.round(Math.sqrt((px - CENTER) ** 2 + (pz - CENTER) ** 2));
            coordsDiv.innerHTML = `Poz: ${px}, ${pz}<br>Dystans: ${dist}<hr style="border:0;border-top:1px solid rgba(255,255,255,0.3);margin:4px 0;"><small style="opacity:0.7">${GAME_VERSION} - ${LAST_UPDATE}</small>`;
        }

        renderer.render(scene, camera);
    }
}

// === MINIMAP ===
const mapOverlay = document.getElementById('map-overlay');
const mapCanvas = document.getElementById('map-canvas');
const mapCtx = mapCanvas.getContext('2d');
let isMapOpen = false;

window.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') {
        toggleMap();
    }
});

function toggleMap() {
    isMapOpen = !isMapOpen;
    mapOverlay.style.display = isMapOpen ? 'flex' : 'none';
    if (isMapOpen) {
        drawMap();
    }
}

function drawMap() {
    if (!player) return;

    // Clear canvas
    mapCtx.fillStyle = '#000';
    mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);

    // Map settings
    // Show 1000x1000 area around player
    const drawRadius = 500;
    const centerX = mapCanvas.width / 2;
    const centerY = mapCanvas.height / 2;

    // Player grid position
    const pgx = Math.round(player.position.x / TILE_SIZE);
    const pgz = Math.round(player.position.z / TILE_SIZE);

    const startX = pgx - drawRadius;
    const startZ = pgz - drawRadius;

    const pixelSize = mapCanvas.width / (drawRadius * 2);

    for (let x = 0; x < drawRadius * 2; x++) {
        for (let z = 0; z < drawRadius * 2; z++) {
            const worldX = startX + x;
            const worldZ = startZ + z;

            // Check bounds
            if (worldX < 0 || worldX >= MAP_SIZE || worldZ < 0 || worldZ >= MAP_SIZE) continue;

            // Get procedural tile data directly
            const tileInfo = getTileType(worldX, worldZ);

            // Determine color
            let color = '#000';

            if (tileInfo.type === 'wall') {
                if (tileInfo.biome === 'stone') color = '#222';
                else if (tileInfo.biome === 'grass') color = '#030';
                else if (tileInfo.biome === 'sand') color = '#430';
            } else if (tileInfo.type === 'water') {
                color = '#33a';
            } else {
                // Floor
                if (tileInfo.biome === 'stone') color = '#555';
                else if (tileInfo.biome === 'grass') color = '#4a4';
                else if (tileInfo.biome === 'sand') color = '#da6';
            }

            mapCtx.fillStyle = color;
            // Use simple rects for efficiency
            mapCtx.fillRect(x * pixelSize, z * pixelSize, pixelSize, pixelSize);
        }
    }

    // Draw Player
    mapCtx.fillStyle = 'red';
    mapCtx.beginPath();
    mapCtx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    mapCtx.fill(); // Player dot

    // Draw Spawn (Center) if visible
    const spawnScreenX = (CENTER - startX) * pixelSize;
    const spawnScreenZ = (CENTER - startZ) * pixelSize;
    if (spawnScreenX >= 0 && spawnScreenX < mapCanvas.width && spawnScreenZ >= 0 && spawnScreenZ < mapCanvas.height) {
        mapCtx.fillStyle = 'cyan';
        mapCtx.fillRect(spawnScreenX - 2, spawnScreenZ - 2, 4, 4);
    }
}

// === AUTO START ===
document.getElementById('char-selection').style.display = 'none';
startGame('adventurer_run');
