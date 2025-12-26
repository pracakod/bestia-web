
// --- PROCEDURAL PLAYER CLASS (Global Scope) ---
class ProceduralPlayer {
    constructor(container) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 120;
        this.canvas.height = 120;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.animTime = 0;
        this.idleTime = 0;
        this.facing = 0; // 0:Front, 1:Back, 2:Right, 3:Left
        this.isMoving = false;
        this.bodyRotation = 0;
        this.turnFactor = 1;
        // Attack state
        this.isAttacking = false;
        this.attackTimer = 0;
        this.comboHand = 0;
    }

    triggerAttack() {
        if (!this.isAttacking) {
            this.isAttacking = true;
            this.attackTimer = 0;
            this.comboHand = (this.comboHand + 1) % 2;
            return true; // Attack started
        }
        return false;
    }

    update(dt, inputDx, inputDy) {
        // Attack timer
        if (this.isAttacking) {
            this.attackTimer += dt * 4;
            if (this.attackTimer >= 1) {
                this.isAttacking = false;
                this.attackTimer = 0;
            }
        }

        let targetRot = 0, targetTurn = 1;
        if (inputDx !== 0 || inputDy !== 0) {
            this.isMoving = true;

            // 8-way facing: 0=S, 1=N, 2=E, 3=W, 4=SE, 5=SW, 6=NE, 7=NW
            const absX = Math.abs(inputDx);
            const absY = Math.abs(inputDy);

            if (absX < 0.1 && inputDy > 0) this.facing = 0;       // S
            else if (absX < 0.1 && inputDy < 0) this.facing = 1;  // N
            else if (inputDx > 0 && absY < 0.1) this.facing = 2;  // E
            else if (inputDx < 0 && absY < 0.1) this.facing = 3;  // W
            else if (inputDx > 0 && inputDy > 0) this.facing = 4; // SE
            else if (inputDx < 0 && inputDy > 0) this.facing = 5; // SW
            else if (inputDx > 0 && inputDy < 0) this.facing = 6; // NE
            else if (inputDx < 0 && inputDy < 0) this.facing = 7; // NW
        } else {
            this.isMoving = false;
        }

        // Set target rotation and turn factor based on facing
        // Facing: 0=S, 1=N, 2=E, 3=W, 4=SE, 5=SW, 6=NE, 7=NW
        switch (this.facing) {
            case 0: targetRot = 0; targetTurn = 1; break;     // S - front
            case 1: targetRot = 0; targetTurn = -1; break;    // N - back
            case 2: targetRot = 1; targetTurn = 0; break;     // E - right side
            case 3: targetRot = -1; targetTurn = 0; break;    // W - left side
            case 4: targetRot = 0.5; targetTurn = 0.5; break; // SE - front-right
            case 5: targetRot = -0.5; targetTurn = 0.5; break;// SW - front-left
            case 6: targetRot = 0.5; targetTurn = -0.5; break;// NE - back-right
            case 7: targetRot = -0.5; targetTurn = -0.5; break;// NW - back-left
        }

        this.bodyRotation += (targetRot - this.bodyRotation) * 10 * dt;
        this.turnFactor += (targetTurn - this.turnFactor) * 8 * dt;
        if (this.isMoving) { this.animTime += dt * 5; this.idleTime = 0; }
        else { this.animTime = 0; this.idleTime += dt * 2; }
        this.draw();
    }

    draw() {
        const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, CX = W / 2, GY = H - 20;
        ctx.clearRect(0, 0, W, H);
        const C = { SKIN: '#ffdbac', SKIN_S: '#e0b080', SHIRT: '#8b0000', PANTS: '#263238', SHOES: '#212121', HAIR: '#3e2723' };
        let bob = this.isMoving ? Math.abs(Math.sin(this.animTime)) * 3 : Math.sin(this.idleTime) * 1.5;
        let hipY = GY - 35 - bob, legY = hipY + 12, rot = this.bodyRotation;

        // Direction flags for 8-way facing
        // Cardinal: 0=S, 1=N, 2=E, 3=W; Diagonal: 4=SE, 5=SW, 6=NE, 7=NW
        let isRight = this.facing === 2 || this.facing === 4 || this.facing === 6;
        let isLeft = this.facing === 3 || this.facing === 5 || this.facing === 7;
        let isSide = isRight || isLeft;
        let isBack = this.facing === 1 || this.facing === 6 || this.facing === 7;
        let isFront = this.facing === 0 || this.facing === 4 || this.facing === 5;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(CX, GY, 14, 5, 0, 0, Math.PI * 2); ctx.fill();

        const drawLeg = (left) => {
            let ph = left ? 0 : Math.PI, ho = (left ? -7 : 7) * (1 - Math.abs(rot) * 0.8);
            let sw = Math.cos(this.animTime + ph) * (isSide ? -1 : 1), lf = Math.max(0, Math.sin(this.animTime + ph)) * 10;
            if (!this.isMoving) { sw = 0; lf = 0; } let hx = CX + ho, st = 14, sx = 0;
            if (isRight) sx = sw * st; else if (isLeft) sx = sw * -st;
            let fx = hx + sx, fy = GY - lf, kx = (hx + fx) / 2 + sx * 0.2, ky = (legY + fy) / 2;
            ctx.lineWidth = 8; ctx.strokeStyle = C.PANTS; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hx, legY); ctx.quadraticCurveTo(kx, ky, fx, fy); ctx.stroke();
            ctx.fillStyle = C.SHOES; ctx.beginPath(); ctx.ellipse(fx, fy, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
        };

        const drawArm = (left) => {
            let sx = CX + (left ? -13 : 13) * (1 - Math.abs(rot) * 0.6);
            let sy = hipY - 24;
            let ph = left ? Math.PI : 0;
            let hx = sx, hy = sy + 25;
            let activeArm = (this.comboHand === 0) ? !left : left;

            // ATTACK ANIMATION
            if (this.isAttacking && activeArm) {
                let progress = this.attackTimer;
                let extension = progress < 0.3 ? progress / 0.3 : 1 - ((progress - 0.3) / 0.7);

                let attackDirX = 0, attackDirY = 1;
                if (isRight) { attackDirX = 1; attackDirY = 0; }
                else if (isLeft) { attackDirX = -1; attackDirY = 0; }
                else if (isBack) { attackDirX = 0; attackDirY = -1; }

                let reach = 20;
                hx = sx + (attackDirX * reach * extension) + (attackDirX * 5);
                hy = sy + 5 + (attackDirY * reach * extension * 0.5) - (extension * 8);

                // Swing trail
                if (progress > 0.1 && progress < 0.4) {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(hx - attackDirX * 10, hy - attackDirY * 5);
                    ctx.lineTo(hx, hy);
                    ctx.stroke();
                    ctx.restore();
                }
            } else {
                // Normal movement
                if (this.isMoving) {
                    let sw = Math.cos(this.animTime + ph) * 15;
                    if (isSide) hx += sw; else hy -= Math.abs(sw) * 0.5;
                } else {
                    hx += Math.sin(this.idleTime) * 2;
                }
            }

            ctx.strokeStyle = C.SHIRT; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
            let handRadius = (this.isAttacking && activeArm) ? 6 : 4;
            ctx.fillStyle = C.SKIN; ctx.beginPath(); ctx.arc(hx, hy, handRadius, 0, Math.PI * 2); ctx.fill();
        };

        if (isBack) { drawLeg(true); drawLeg(false); drawArm(true); drawArm(false); } else { drawLeg(true); drawLeg(false); }
        ctx.fillStyle = C.SHIRT; ctx.beginPath(); let w = 14 - Math.abs(rot) * 5;
        ctx.moveTo(CX - w, hipY - 28); ctx.lineTo(CX + w, hipY - 28); ctx.lineTo(CX + w - 2, hipY + 10); ctx.lineTo(CX - w + 2, hipY + 10); ctx.fill();
        if (!isBack) { drawArm(true); drawArm(false); }
        let headY = hipY - 42, headX = CX + rot * 4;
        ctx.fillStyle = C.SKIN_S; ctx.fillRect(headX - 4, headY + 12, 8, 8);
        ctx.fillStyle = C.SKIN; ctx.beginPath(); ctx.arc(headX, headY, 13, 0, Math.PI * 2); ctx.fill();
        if (!isBack) {
            ctx.fillStyle = '#111'; if (isSide) { ctx.beginPath(); ctx.arc(headX + (isRight ? 5 : -5), headY, 2, 0, Math.PI * 2); ctx.fill(); }
            else { ctx.beginPath(); ctx.arc(headX - 4, headY, 2, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(headX + 4, headY, 2, 0, Math.PI * 2); ctx.fill(); }
        }
        ctx.fillStyle = C.HAIR; ctx.beginPath(); ctx.arc(headX, headY - 2, 14, 0, Math.PI * 2);
        ctx.moveTo(headX - 14, headY - 5); ctx.quadraticCurveTo(headX, headY - 20, headX + 14, headY - 5);
        if (isBack) { ctx.lineTo(headX + 14, headY + 8); ctx.quadraticCurveTo(headX, headY + 15, headX - 14, headY + 8); }
        else { ctx.lineTo(headX + 14, headY + 2); ctx.quadraticCurveTo(headX, headY - 5, headX - 14, headY + 2); }
        ctx.fill();
    }
}

// --- MONSTERS ---
const monsters = [];

function createMonster(x, y, name, hp, visual) {
    return {
        x: x * TILE_SIZE,
        y: y * TILE_SIZE,
        hp: hp,
        maxHp: hp,
        name: name,
        visual: visual, // Can be emoji or image path
        element: null
    };
}

function spawnMonster(world, monster) {
    const el = document.createElement('div');
    el.className = 'entity monster';

    // Check if visual is image path or emoji
    let visualHtml;
    if (monster.visual.includes('.png') || monster.visual.includes('.jpg')) {
        visualHtml = `<img class="monster-img" src="img/${monster.visual}" alt="${monster.name}" draggable="false">`;
    } else {
        visualHtml = `<div class="monster-emoji" style="user-select:none;">${monster.visual}</div>`;
    }

    el.innerHTML = `
                <div class="monster-name">${monster.name} Lv.1</div>
                <div class="monster-hp-bar"><div class="monster-hp-fill" style="width:100%"></div></div>
                ${visualHtml}
            `;
    el.style.left = monster.x + 'px';
    el.style.top = monster.y + 'px';
    el.style.zIndex = Math.floor(monster.x / TILE_SIZE + monster.y / TILE_SIZE);
    world.appendChild(el);
    monster.element = el;
}

function updateMonsterHP(monster) {
    if (!monster.element) return;
    const fill = monster.element.querySelector('.monster-hp-fill');
    if (fill) {
        const pct = Math.max(0, monster.hp / monster.maxHp * 100);
        fill.style.width = pct + '%';
    }
}

function checkAttackHit() {
    if (!window.proceduralPlayer || !window.proceduralPlayer.isAttacking) return;

    const attackRange = TILE_SIZE * 2; // Balanced range (2 tiles)

    for (let i = monsters.length - 1; i >= 0; i--) {
        const m = monsters[i];
        // Center of monster
        const mx = m.x + 12;
        const my = m.y + 12;
        const dist = Math.sqrt((playerPixelX - mx) ** 2 + (playerPixelY - my) ** 2);

        if (dist < attackRange) {
            // Hit!
            const damage = 10 + Math.floor(Math.random() * 10);
            m.hp -= damage;
            updateMonsterHP(m);

            // Floating damage
            showFloatingDamage(m.x, m.y, damage);

            if (m.hp <= 0) {
                // Monster died
                if (m.element) m.element.remove();
                monsters.splice(i, 1);
                showFloatingDamage(m.x, m.y - 20, '💀 DEAD!', 'gold');
            }
            break; // Hit one monster per attack
        }
    }
}

function showFloatingDamage(x, y, text, color = 'red') {
    const el = document.createElement('div');
    el.className = 'floating-damage';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.color = color;
    el.textContent = typeof text === 'number' ? '-' + text : text;
    document.getElementById('worldGrid').appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

let lastHitTime = 0;
function triggerPlayerAttack() {
    if (window.proceduralPlayer && window.proceduralPlayer.triggerAttack()) {
        // Check for hits multiple times during attack animation
        const now = Date.now();
        if (now - lastHitTime > 200) { // Prevent spam
            lastHitTime = now;
            checkAttackHit();
            setTimeout(checkAttackHit, 80);
            setTimeout(checkAttackHit, 160);
        }
    }
}
// --- DATA ---
// Clean names and specific attributes as requested
const allCharacters = [
    // MALE
    { file: 'avatars/male/aniol2.png', name: 'Upadły', attribute: 'Moc Światła', gender: 'male' },
    { file: 'avatars/male/druid (2).png', name: 'Druid', attribute: 'Natura', gender: 'male' },
    { file: 'avatars/male/krol.png', name: 'Król', attribute: 'Charyzma', gender: 'male' },
    { file: 'avatars/male/lucznikchlop.png', name: 'Zwiadowca', attribute: 'Zręczność', gender: 'male' },
    { file: 'avatars/male/mag1.png', name: 'Mag', attribute: 'Inteligencja', gender: 'male' },
    { file: 'avatars/male/nekroman1.png', name: 'Nekromanta', attribute: 'Mroczna Magia', gender: 'male' },
    // FEMALE
    { file: 'avatars/female/aniiol1.png', name: 'Anielica', attribute: 'Łaska', gender: 'female' },
    { file: 'avatars/female/druid3.png', name: 'Szamanka', attribute: 'Uzdrawianie', gender: 'female' },
    { file: 'avatars/female/krolowa.png', name: 'Królowa', attribute: 'Władza', gender: 'female' },
    { file: 'avatars/female/lucznikkobieta.png', name: 'Łowczyni', attribute: 'Precyzja', gender: 'female' },
    { file: 'avatars/female/magkobiet.png', name: 'Czarodziejka', attribute: 'Żywioły', gender: 'female' },
    { file: 'avatars/female/nekromanta2.png', name: 'Nekromantka', attribute: 'Klątwy', gender: 'female' }
];

let selectedHero = null;
let creationName = "";
let creationGender = "";

// MISSING KEYS FIX
const keys = {};

let playerPos = { x: 15, y: 15 }; // Center of 30x30 map
const TILE_SIZE = 16; // Smaller tiles (was 32)

// MOVEMENT STATE
let isMoving = false;
let lastMoveTime = 0;
const MOVE_COOLDOWN = 180; // ms

// --- ARENA STATE ---
const battleState = {
    active: false,
    units: [],
    currentUnitIndex: 0,
    gridSize: { x: 12, y: 10 },
    tileSize: 64,

    log: (msg) => {
        const log = document.getElementById('battleLog');
        if (log) {
            log.innerHTML += `<div>> ${msg}</div>`;
            log.scrollTop = log.scrollHeight;
        }
    },

    endTurn: () => {
        battleState.currentUnitIndex = (battleState.currentUnitIndex + 1) % battleState.units.length;
        battleState.startTurn();
    },

    startTurn: () => {
        if (!battleState.active) return;
        const unit = battleState.units[battleState.currentUnitIndex];
        // simple highlight logic or AI trigger would go here
    }
};

// === QUEST SYSTEM ===
const quests = {
    killBeasts: { current: 0, required: 3, completed: false }
};

function updateQuestProgress() {
    quests.killBeasts.current = Math.min(quests.killBeasts.current + 1, quests.killBeasts.required);

    // Side Panel Update
    const countEl = document.getElementById('questBestiaCount');
    if (countEl) {
        countEl.textContent = `(${quests.killBeasts.current}/${quests.killBeasts.required})`;
    }

    // Modal Update
    const modalCountEl = document.getElementById('modalQuestBestiaCount');
    if (modalCountEl) {
        modalCountEl.textContent = `(${quests.killBeasts.current}/${quests.killBeasts.required})`;
    }

    // Check completion
    if (quests.killBeasts.current >= quests.killBeasts.required && !quests.killBeasts.completed) {
        quests.killBeasts.completed = true;

        // Update Panel
        const questEl = document.getElementById('questBestia');
        if (questEl) {
            questEl.style.color = '#4ade80';
            questEl.innerHTML = `<span style="color:#4ade80;">✅</span> Zabij Bestie <span style="color:#4ade80;">(UKOŃCZONE!)</span>`;
        }

        // Update Modal
        const modalQuestEl = document.getElementById('modalQuestBestia');
        if (modalQuestEl) {
            modalQuestEl.style.borderColor = '#4ade80';
            modalQuestEl.style.background = 'rgba(74, 222, 128, 0.1)';
            modalQuestEl.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-weight:bold; color:#4ade80;">✅ Zabij Bestie</span>
                            <span style="color:#4ade80;">UKOŃCZONE!</span>
                        </div>
                    `;
        }

        showGameMessage('🎉 Quest ukończony: Zabij Bestie!', 'success');
        // Bonus reward
        playerGold += 50;
        const goldEl = document.getElementById('goldText');
        if (goldEl) goldEl.textContent = playerGold;
    }
}

// === HOUSE COLLISION ===
const houseArea = { x1: 3, y1: 3, x2: 7, y2: 6 }; // House bounds (in tiles)
const houseDoor = { x: 5, y: 7 }; // Door position

function isInsideHouse(px, py) {
    const tx = Math.floor(px / TILE_SIZE);
    const ty = Math.floor(py / TILE_SIZE);
    return tx >= houseArea.x1 && tx <= houseArea.x2 && ty >= houseArea.y1 && ty <= houseArea.y2;
}

function isAtHouseDoor(px, py) {
    const tx = Math.floor(px / TILE_SIZE);
    const ty = Math.floor(py / TILE_SIZE);
    return tx >= houseDoor.x - 1 && tx <= houseDoor.x + 1 && ty === houseDoor.y;
}

let insideHouse = false;
let interiorPixelX = 5 * 32; // Pixel position in interior
let interiorPixelY = 8 * 32;
const INTERIOR_SIZE_X = 12;
const INTERIOR_SIZE_Y = 10;
const INTERIOR_TILE = 32;

// Interior map: 0=floor, 1=wall, 2=bed, 3=chest, 4=table, 5=door, 6=toilet, 7=bathtub, 8=carpet
const interiorMap = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 8, 8, 8, 0, 0, 1, 0, 0, 0, 0, 1],
    [1, 2, 2, 8, 0, 0, 1, 0, 6, 0, 7, 1],
    [1, 0, 0, 8, 0, 0, 1, 0, 0, 0, 7, 1],
    [1, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1],
    [1, 0, 0, 4, 4, 0, 0, 0, 0, 0, 0, 1],
    [1, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

function enterHouse() {
    if (insideHouse) return;
    insideHouse = true;

    // Remove door button
    const doorBtn = document.getElementById('doorButton');
    if (doorBtn) doorBtn.remove();

    // Hide main map
    document.getElementById('worldGrid').style.display = 'none';

    // Create interior container
    const interior = document.createElement('div');
    interior.id = 'houseInterior';
    interior.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                width: ${INTERIOR_SIZE_X * INTERIOR_TILE}px;
                height: ${INTERIOR_SIZE_Y * INTERIOR_TILE}px;
                background: #2d1b0e;
                transform-style: preserve-3d;
                transform: translate(-50%, -50%) rotateX(60deg) scale(1.5);
                box-shadow: 0 20px 60px rgba(0,0,0,0.8);
                border: 3px solid #5c4a12;
            `;

    // Generate interior tiles
    for (let y = 0; y < INTERIOR_SIZE_Y; y++) {
        for (let x = 0; x < INTERIOR_SIZE_X; x++) {
            const tile = document.createElement('div');
            tile.className = 'interior-tile';
            tile.dataset.x = x;
            tile.dataset.y = y;
            tile.style.cssText = `
                        position: absolute;
                        left: ${x * INTERIOR_TILE}px;
                        top: ${y * INTERIOR_TILE}px;
                        width: ${INTERIOR_TILE}px;
                        height: ${INTERIOR_TILE}px;
                        box-sizing: border-box;
                        transform-style: preserve-3d;
                    `;

            // Floor (always present)
            const floor = document.createElement('div');
            floor.style.cssText = `
                        position: absolute;
                        width: 100%; height: 100%;
                        background: linear-gradient(135deg, #8b6914, #6b5210);
                        border: 0.5px solid rgba(0,0,0,0.1);
                    `;
            tile.appendChild(floor);

            const type = interiorMap[y][x];
            if (type === 1) { // Wall
                const isLeftSide = (x === 0 || (x === 6 && y <= 4));
                const isRightSide = (x === INTERIOR_SIZE_X - 1);
                const isBackWall = (y === 0);
                const isFrontWall = (y === INTERIOR_SIZE_Y - 1);

                // Only create wall if it's NOT a transparent front wall segment
                if (!(isFrontWall && !isLeftSide && !isRightSide)) {
                    const wall = document.createElement('div');
                    if (isLeftSide) {
                        wall.style.cssText = `
                                    position: absolute;
                                    top: 0; left: 0; width: 64px; height: 100%;
                                    background: linear-gradient(90deg, #4d2b12, #654321);
                                    border-left: 2px solid #8b6914;
                                    transform-origin: left;
                                    transform: rotateY(85deg);
                                    box-shadow: inset -15px 0 30px rgba(0,0,0,0.5);
                                `;
                    } else if (isRightSide) {
                        wall.style.cssText = `
                                    position: absolute;
                                    top: 0; right: 0; width: 64px; height: 100%;
                                    background: linear-gradient(-90deg, #4d2b12, #654321);
                                    border-right: 2px solid #8b6914;
                                    transform-origin: right;
                                    transform: rotateY(-85deg); 
                                    box-shadow: inset 15px 0 30px rgba(0,0,0,0.5);
                                `;
                    } else {
                        // Standard back wall or interior horizontal
                        wall.style.cssText = `
                                    position: absolute;
                                    bottom: 0; left: 0; width: 100%; height: 64px;
                                    background: linear-gradient(0deg, #3d2414, #5c3a1a);
                                    border-top: 2px solid #8b6914;
                                    transform-origin: bottom;
                                    transform: rotateX(-90deg);
                                    box-shadow: inset 0 -15px 30px rgba(0,0,0,0.5);
                                `;
                    }
                    tile.appendChild(wall);
                } else {
                    floor.style.background = '#1a0f07';
                }
            } else if (type === 2) { // Bed
                tile.innerHTML += `<div onclick="restAtHome()" style="position:absolute; bottom:0; width:100%; height:32px; transform-origin:bottom; transform:rotateX(-60deg); font-size:32px; display:flex; align-items:center; justify-content:center; cursor:pointer;">🛏️</div>`;
            } else if (type === 3) { // Chest
                tile.innerHTML += `<div onclick="showGameMessage('Skrzynia jest pusta...', 'info')" style="position:absolute; bottom:0; width:100%; height:24px; transform-origin:bottom; transform:rotateX(-60deg); font-size:24px; display:flex; align-items:center; justify-content:center; cursor:pointer;">📦</div>`;
            } else if (type === 4) { // Table/Chair
                tile.innerHTML += `<div onclick="saveAtHome()" style="position:absolute; bottom:0; width:100%; height:24px; transform-origin:bottom; transform:rotateX(-60deg); font-size:24px; display:flex; align-items:center; justify-content:center; cursor:pointer;">🪑</div>`;
            } else if (type === 5) { // Door
                floor.style.background = 'linear-gradient(180deg, #4a2c17, #3d2414)';
                tile.innerHTML += `<div style="position:absolute; bottom:0; width:100%; height:20px; transform-origin:bottom; transform:rotateX(-60deg); font-size:20px; display:flex; align-items:center; justify-content:center;">🚪</div>`;
            } else if (type === 6) { // Toilet
                tile.innerHTML += `<div style="position:absolute; bottom:0; width:100%; height:24px; transform-origin:bottom; transform:rotateX(-60deg); font-size:24px; display:flex; align-items:center; justify-content:center;">🚽</div>`;
            } else if (type === 7) { // Bathtub
                tile.innerHTML += `<div style="position:absolute; bottom:0; width:100%; height:32px; transform-origin:bottom; transform:rotateX(-60deg); font-size:32px; display:flex; align-items:center; justify-content:center;">🛁</div>`;
            } else if (type === 8) { // Carpet
                floor.style.background = 'radial-gradient(circle, #a00, #700)';
            }

            interior.appendChild(tile);
        }
    }

    // Room Labels
    const labels = [
        { text: 'SYPIALNIA', x: 2 * INTERIOR_TILE, y: 0.5 * INTERIOR_TILE },
        { text: 'ŁAZIENKA', x: 9 * INTERIOR_TILE, y: 0.5 * INTERIOR_TILE },
        { text: 'SALON', x: 5 * INTERIOR_TILE, y: 6 * INTERIOR_TILE },
    ];
    labels.forEach(l => {
        const label = document.createElement('div');
        label.style.cssText = `
                    position: absolute;
                    left: ${l.x}px; top: ${l.y}px;
                    color: rgba(255,255,255,0.3);
                    font-size: 10px;
                    font-weight: bold;
                    pointer-events: none;
                    transform: translateZ(1px);
                    white-space: nowrap;
                `;
        label.textContent = l.text;
        interior.appendChild(label);
    });

    // Move the real player entity to interior
    const playerEntity = document.getElementById('playerEntity');
    if (playerEntity) {
        interior.appendChild(playerEntity);
        playerEntity.style.transform = 'translate3d(0, 0, 10px) rotateX(-60deg) scale(1.5)';
        playerEntity.style.transition = 'none';
    }

    // Reset interior position
    interiorPixelX = 5 * INTERIOR_TILE;
    interiorPixelY = 7 * INTERIOR_TILE;

    updateInteriorPlayerPosition();

    document.querySelector('.game-map-container').appendChild(interior);
}

function updateInteriorPlayerPosition() {
    const player = document.getElementById('playerEntity');
    if (player && insideHouse) {
        player.style.left = (interiorPixelX - 16) + 'px';
        player.style.top = (interiorPixelY - 24) + 'px';
    }
}

function moveInteriorSmooth(dx, dy, dt) {
    const speed = 120; // Slightly faster for interior
    let nextX = interiorPixelX + dx * speed * dt;
    let nextY = interiorPixelY + dy * speed * dt;

    // Separate X and Y for sliding along walls
    function isWalkable(px, py) {
        const tx = Math.floor(px / INTERIOR_TILE);
        const ty = Math.floor(py / INTERIOR_TILE);
        if (tx < 0 || tx >= INTERIOR_SIZE_X || ty < 0 || ty >= INTERIOR_SIZE_Y) return false;
        const tile = interiorMap[ty][tx];
        // Walkable types: 0 (floor), 5 (door), 8 (carpet), 3 (chest), 4 (table), 2 (bed), 6 (toilet), 7 (bath)
        // Basically everything except wall (1)
        return tile !== 1;
    }

    // Try X movement
    if (isWalkable(nextX, interiorPixelY)) {
        interiorPixelX = nextX;
    }
    // Try Y movement
    if (isWalkable(interiorPixelX, nextY)) {
        interiorPixelY = nextY;
    }

    updateInteriorPlayerPosition();

    // Interaction Check (center point)
    const curTX = Math.floor(interiorPixelX / INTERIOR_TILE);
    const curTY = Math.floor(interiorPixelY / INTERIOR_TILE);
    const curTile = interiorMap[curTY][curTX];

    // Auto-triggering interactions
    if (curTile === 5) { // Door
        exitHouse();
    } else if (curTile === 2) { // Bed
        restAtHome();
    }
}

function exitHouse() {
    insideHouse = false;

    // Move player back to world grid BEFORE removing interior
    const playerEntity = document.getElementById('playerEntity');
    const worldGrid = document.getElementById('worldGrid');
    if (playerEntity && worldGrid) {
        worldGrid.appendChild(playerEntity);
        playerEntity.style.transform = 'translate3d(0, 0, 10px) rotateX(-60deg) scale(0.7)';
        playerEntity.style.transition = 'none'; // Remove transition for outdoor movement
    }

    const interior = document.getElementById('houseInterior');
    if (interior) interior.remove();

    // Show main map again
    worldGrid.style.display = 'block';

    // Move player away from door
    playerPixelX = houseDoor.x * TILE_SIZE;
    playerPixelY = (houseDoor.y + 1) * TILE_SIZE;

    // Reset interior position
    interiorPixelX = 5 * INTERIOR_TILE;
    interiorPixelY = 7 * INTERIOR_TILE;

    // Update player position on map
    updatePlayerPosition();
}

function restAtHome() {
    playerHP = 100;
    playerMana = 50;
    if (currentCombat) {
        currentCombat.playerHP = 100;
        currentCombat.playerMaxMana = 50;
    }
    showGameMessage('💤 Odpoczywasz... HP i Mana odnowione!', 'success');
    document.querySelector('.hp-fill').style.width = '100%';
    document.getElementById('hpText').textContent = '100/100';
}

function saveAtHome() {
    saveGame();
    showGameMessage('💾 Gra zapisana!', 'success');
}

// WIZARD LOGIC
function nextStep(currentStep) {
    if (currentStep === 1) {
        // 1. Name Validation
        const nameInput = document.getElementById('playerNameInput');
        const name = nameInput.value.trim();
        const err = document.getElementById('nameError');

        if (name.length < 3) {
            err.textContent = "Imię musi mieć min. 3 znaki!";
            return;
        }
        if (name.length > 15) {
            err.textContent = "Imię może mieć max. 15 znaków!";
            return;
        }

        // 2. Gender Validation
        if (!creationGender) {
            err.textContent = "Wybierz płeć!";
            return;
        }

        creationName = name;
        err.textContent = "";

        // Go to step 2 (Class Selection)
        document.getElementById('step-name').classList.remove('active');
        document.getElementById('step-class').classList.add('active');

        renderClassSelection();
    }
}

function prevStep(currentStep) {
    if (currentStep === 2) {
        document.getElementById('step-class').classList.remove('active');
        document.getElementById('step-name').classList.add('active');
    }
}

function selectGender(gender) {
    creationGender = gender;
    // Visual feedback
    document.querySelectorAll('.gender-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${gender}`).classList.add('active');

    checkShowNextBtn();
}

function checkShowNextBtn() {
    const nameInput = document.getElementById('playerNameInput');
    const name = nameInput.value.trim();
    const nextBtn = document.getElementById('nextStepBtn');

    if (name.length >= 3 && creationGender) {
        nextBtn.style.display = 'inline-block';
    } else {
        nextBtn.style.display = 'none';
    }
}

// Listen to input changes
document.addEventListener('DOMContentLoaded', () => {
    const nameInput = document.getElementById('playerNameInput');
    if (nameInput) {
        nameInput.addEventListener('input', checkShowNextBtn);
    }
});

function renderClassSelection() {
    const grid = document.getElementById('charGrid');
    grid.innerHTML = ''; // Clear prev

    // Filter by gender
    const filteredChars = allCharacters.filter(c => c.gender === creationGender);

    filteredChars.forEach((char) => {
        const card = document.createElement('div');
        card.className = 'card';

        card.innerHTML = `
                    <div class="card-image-container">
                        <img src="img/${char.file}" class="card-image" alt="${char.name}">
                    </div>
                    <div class="card-content">
                        <div class="class-name">${char.name}</div>
                        <div class="char-attribute">${char.attribute}</div>
                    </div>
                `;

        card.onclick = () => {
            document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedHero = char;
            document.getElementById('playBtn').classList.remove('disabled');
            document.getElementById('playBtn').classList.add('visible');
        };
        grid.appendChild(card);
    });
}
// --- GAME LOGIC ---
function startGame() {
    if (!selectedHero) return;

    // Transition UI
    document.getElementById('selectScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.add('active');
    // document.getElementById('attackBtn').style.display = 'flex'; // Deprecated
    // Attack is now turn-based via clicking monsters
    document.getElementById('joystickContainer').style.display = 'block'; // Show joystick

    // Setup HUD
    document.getElementById('hudAvatar').src = `img/${selectedHero.file}`;

    // USE CHOSEN NAME
    document.getElementById('hudName').innerText = creationName.toUpperCase();

    // Save game on start
    saveGame();

    // Update level in HUD
    updateHUDLevel();

    // Spawn World first so player entity exists
    createWorld();

    // Wait for layout to update so updateCamera can read container width/height
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            updatePlayerPosition();
        });
    });

    // Log
    addToChat(`System: Wybrano postać ${selectedHero.name}.`, 'chat-sys');

    // Listeners
    window.addEventListener('keydown', e => keys[e.key] = true);
    window.addEventListener('keyup', e => keys[e.key] = false);

    // Start Game Loop
    playerPixelX = playerPos.x * TILE_SIZE; // Initialize pixel position
    playerPixelY = playerPos.y * TILE_SIZE;
    requestAnimationFrame(gameLoop);
}

// GAME LOOP for Smooth Movement
let lastTime = 0;
function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // Cap dt to prevent jumps
    lastTime = timestamp;

    let dx = 0;
    let dy = 0;

    // X axis - separate from Y for 8-way movement
    if (keys['ArrowLeft'] || keys['a']) dx = -1;
    else if (keys['ArrowRight'] || keys['d']) dx = 1;

    // Y axis - separate from X for 8-way movement
    if (keys['ArrowUp'] || keys['w']) dy = -1;
    else if (keys['ArrowDown'] || keys['s']) dy = 1;

    // Normalize diagonal movement (so it's not faster)
    if (dx !== 0 && dy !== 0) {
        const factor = 0.707; // 1/sqrt(2)
        dx *= factor;
        dy *= factor;
    }

    if (!battleState.active && selectedHero) {
        if (insideHouse) {
            moveInteriorSmooth(dx, dy, dt);
        } else {
            attemptMove(dx, dy, dt); // Normal outdoor movement
        }
    }

    // Update Animation
    if (window.proceduralPlayer) {
        window.proceduralPlayer.update(dt, dx, dy);
    }

    // Monster AI - attack player if close
    if (typeof updateMonsterAI === 'function') {
        updateMonsterAI();
    }

    requestAnimationFrame(gameLoop);
}

// Physics-based smooth movement (like movement_demo.html)
let playerPixelX = 0;
let playerPixelY = 0;
let playerVelX = 0;
let playerVelY = 0;
const MOVE_ACCEL = 800;   // Acceleration (pixels/s²)
const MOVE_FRICTION = 12; // Friction multiplier
const MOVE_MAX_SPEED = 150; // Max speed (pixels/s)

function attemptMove(dx, dy, dt) {
    // Apply acceleration based on input
    let accelX = dx * MOVE_ACCEL;
    let accelY = dy * MOVE_ACCEL;

    // Apply friction (slows down when no input)
    let speed = Math.sqrt(playerVelX * playerVelX + playerVelY * playerVelY);
    if (speed > 0.1) {
        let fricX = -playerVelX / speed * MOVE_FRICTION * speed * dt;
        let fricY = -playerVelY / speed * MOVE_FRICTION * speed * dt;

        // Only apply friction if not accelerating in that direction
        if (dx === 0) playerVelX += fricX;
        if (dy === 0) playerVelY += fricY;
    }

    // Apply acceleration
    playerVelX += accelX * dt;
    playerVelY += accelY * dt;

    // Clamp to max speed
    speed = Math.sqrt(playerVelX * playerVelX + playerVelY * playerVelY);
    if (speed > MOVE_MAX_SPEED) {
        playerVelX = (playerVelX / speed) * MOVE_MAX_SPEED;
        playerVelY = (playerVelY / speed) * MOVE_MAX_SPEED;
    }

    // Stop if very slow and no input
    if (speed < 5 && dx === 0 && dy === 0) {
        playerVelX = 0;
        playerVelY = 0;
    }

    // Update position
    let newX = playerPixelX + playerVelX * dt;
    let newY = playerPixelY + playerVelY * dt;

    // House collision check
    if (isInsideHouse(newX, newY)) {
        // Block movement into house
        newX = playerPixelX;
        newY = playerPixelY;
        playerVelX = 0;
        playerVelY = 0;
    }

    // Check if at house door - show/hide door button
    const doorBtn = document.getElementById('doorButton');
    if (isAtHouseDoor(newX, newY)) {
        if (!doorBtn) {
            const btn = document.createElement('button');
            btn.id = 'doorButton';
            btn.innerHTML = '🚪 Wejdź';
            btn.style.cssText = `
                        position: fixed;
                        bottom: 100px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: linear-gradient(135deg, #8b4513, #654321);
                        border: 2px solid #ffd700;
                        color: white;
                        padding: 12px 24px;
                        border-radius: 10px;
                        font-size: 16px;
                        cursor: pointer;
                        z-index: 1000;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                    `;
            btn.onclick = enterHouse;
            document.body.appendChild(btn);
        }
    } else {
        if (doorBtn) doorBtn.remove();
    }

    playerPixelX = newX;
    playerPixelY = newY;

    // Bounds check (30 tiles * TILE_SIZE)
    const MAX_PX = 30 * TILE_SIZE - TILE_SIZE;
    if (playerPixelX < 0) { playerPixelX = 0; playerVelX = 0; }
    if (playerPixelX > MAX_PX) { playerPixelX = MAX_PX; playerVelX = 0; }
    if (playerPixelY < 0) { playerPixelY = 0; playerVelY = 0; }
    if (playerPixelY > MAX_PX) { playerPixelY = MAX_PX; playerVelY = 0; }

    // Update grid position for z-index and other logic
    playerPos.x = Math.floor(playerPixelX / TILE_SIZE);
    playerPos.y = Math.floor(playerPixelY / TILE_SIZE);

    updatePlayerPosition();
}



function createWorld() {
    const world = document.getElementById('worldGrid');
    world.innerHTML = '';

    const MAP_SIZE = 30;
    world.style.width = (MAP_SIZE * TILE_SIZE) + 'px';
    world.style.height = (MAP_SIZE * TILE_SIZE) + 'px';

    // TERRAIN TYPES: 0=grass, 1=path, 2=plaza, 3=water, 4=sand, 5=forest, 6=flowers
    const mapData = new Array(MAP_SIZE).fill(0).map(() => new Array(MAP_SIZE).fill(0));

    const centerX = Math.floor(MAP_SIZE / 2);
    const centerY = Math.floor(MAP_SIZE / 2);

    // === GENERATE TERRAIN ===

    // 1. Lake in bottom-right corner
    for (let y = 22; y < 29; y++) {
        for (let x = 20; x < 28; x++) {
            const distX = x - 24;
            const distY = y - 25.5;
            if (distX * distX + distY * distY < 20) {
                mapData[y][x] = 3; // Water
            }
        }
    }

    // 2. Sand around water
    for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < MAP_SIZE; x++) {
            if (mapData[y][x] === 0) {
                // Check if near water
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const ny = y + dy, nx = x + dx;
                        if (ny >= 0 && ny < MAP_SIZE && nx >= 0 && nx < MAP_SIZE) {
                            if (mapData[ny][nx] === 3) mapData[y][x] = 4; // Sand
                        }
                    }
                }
            }
        }
    }

    // 3. Forest patches - SMALLER, FEWER TREES
    const forestCenters = [{ x: 3, y: 22 }, { x: 26, y: 4 }]; // Only 2 forest areas
    forestCenters.forEach(fc => {
        for (let y = fc.y - 2; y <= fc.y + 2; y++) { // Smaller radius (2 instead of 3)
            for (let x = fc.x - 2; x <= fc.x + 2; x++) {
                if (y >= 0 && y < MAP_SIZE && x >= 0 && x < MAP_SIZE) {
                    const dist = Math.abs(x - fc.x) + Math.abs(y - fc.y);
                    if (dist <= 3 && mapData[y][x] === 0 && Math.random() > 0.55) { // 55% chance to skip
                        mapData[y][x] = 5; // Forest
                    }
                }
            }
        }
    });

    // 4. Main roads (cross)
    for (let i = 0; i < MAP_SIZE; i++) {
        if (mapData[centerY][i] !== 3) mapData[centerY][i] = 1;
        if (mapData[centerY + 1][i] !== 3) mapData[centerY + 1][i] = 1;
        if (mapData[i][centerX] !== 3) mapData[i][centerX] = 1;
        if (mapData[i][centerX + 1] !== 3) mapData[i][centerX + 1] = 1;
    }

    // 4b. Path from house doors to the right side
    // House is x=3-7, y=3-6, door center = x=5
    // Path under door and to the right
    mapData[6][5] = 1; // Under door
    for (let x = 5; x < MAP_SIZE; x++) {
        if (mapData[7][x] !== 3) mapData[7][x] = 1;
    }

    // 5. Central plaza
    for (let y = centerY - 2; y <= centerY + 3; y++) {
        for (let x = centerX - 2; x <= centerX + 3; x++) {
            mapData[y][x] = 2;
        }
    }

    // 6. Flower patches - FEWER
    for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < MAP_SIZE; x++) {
            if (mapData[y][x] === 0 && Math.random() > 0.97) { // Only 3%
                mapData[y][x] = 6; // Flowers
            }
        }
    }

    // 7. Single rocks scattered on map - for mining later
    const rockPositions = [{ x: 12, y: 4 }, { x: 5, y: 12 }, { x: 22, y: 18 }, { x: 8, y: 25 }];
    rockPositions.forEach(rp => {
        if (mapData[rp.y][rp.x] === 0) {
            mapData[rp.y][rp.x] = 7; // Rock
        }
    });

    // === RENDER MAP WITH ENHANCED SVG ===
    for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < MAP_SIZE; x++) {
            const tile = document.createElement('div');
            tile.className = 'tile-svg-container';
            tile.style.cssText = `position:absolute;left:${x * TILE_SIZE}px;top:${y * TILE_SIZE}px;width:${TILE_SIZE}px;height:${TILE_SIZE}px;`;

            const type = mapData[y][x];
            let svg = '';

            if (type === 0) { // GRASS - Custom texture
                // Use custom grass image instead of SVG
                tile.innerHTML = `<img src="img/grass.png" style="width:${TILE_SIZE}px;height:${TILE_SIZE}px;display:block;"/>`;
                tile.style.overflow = 'hidden';

                // 5% chance for 3D grass tuft - LESS
                if (Math.random() > 0.95) {
                    if (!window._pendingGrass) window._pendingGrass = [];
                    window._pendingGrass.push({ x, y });
                }
            }
            else if (type === 1) { // PATH - Cobblestone
                svg = `<rect width="32" height="32" fill="#c4a35a"/>
                       <rect x="2" y="2" width="12" height="10" fill="#b08d40" rx="2"/>
                       <rect x="16" y="4" width="14" height="8" fill="#9a7a3a" rx="2"/>
                       <rect x="4" y="14" width="10" height="8" fill="#9a7a3a" rx="2"/>
                       <rect x="18" y="16" width="12" height="10" fill="#b08d40" rx="2"/>
                       <rect x="2" y="24" width="14" height="6" fill="#b08d40" rx="2"/>`;
            }
            else if (type === 2) { // PLAZA - Stone tiles
                svg = `<rect width="32" height="32" fill="#8b7355"/>
                       <rect x="1" y="1" width="14" height="14" fill="#7a6348" stroke="#6b5540" stroke-width="1" rx="1"/>
                       <rect x="17" y="1" width="14" height="14" fill="#8b7355" stroke="#6b5540" stroke-width="1" rx="1"/>
                       <rect x="1" y="17" width="14" height="14" fill="#8b7355" stroke="#6b5540" stroke-width="1" rx="1"/>
                       <rect x="17" y="17" width="14" height="14" fill="#7a6348" stroke="#6b5540" stroke-width="1" rx="1"/>`;
            }
            else if (type === 3) { // WATER - Animated waves
                const waveOffset = Math.random() * 10;
                svg = `<defs>
                         <linearGradient id="water${x}${y}" x1="0%" y1="0%" x2="100%" y2="100%">
                           <stop offset="0%" style="stop-color:#1e90ff"/>
                           <stop offset="50%" style="stop-color:#4169e1"/>
                           <stop offset="100%" style="stop-color:#1e90ff"/>
                         </linearGradient>
                       </defs>
                       <rect width="32" height="32" fill="url(#water${x}${y})"/>
                       <path d="M0,${12 + waveOffset} Q8,${8 + waveOffset} 16,${12 + waveOffset} T32,${12 + waveOffset}" stroke="rgba(255,255,255,0.4)" fill="none" stroke-width="2"/>
                       <path d="M0,${20 + waveOffset} Q8,${16 + waveOffset} 16,${20 + waveOffset} T32,${20 + waveOffset}" stroke="rgba(255,255,255,0.3)" fill="none" stroke-width="1.5"/>
                       <circle cx="${10 + waveOffset}" cy="${10}" r="2" fill="rgba(255,255,255,0.2)"/>`;
            }
            else if (type === 4) { // SAND - Beach
                svg = `<rect width="32" height="32" fill="#f4d58d"/>
                       <circle cx="8" cy="24" r="2" fill="#e8c872"/>
                       <circle cx="22" cy="12" r="3" fill="#e8c872"/>
                       <circle cx="26" cy="26" r="1.5" fill="#dabb5d"/>
                       <ellipse cx="14" cy="20" rx="4" ry="2" fill="#e8c872" opacity="0.5"/>`;
            }
            else if (type === 5) { // FOREST - Grass base + separate 3D tree element
                // Floor tile is custom grass with tree shadow overlay
                tile.innerHTML = `<div style="position:relative;width:${TILE_SIZE}px;height:${TILE_SIZE}px;">
                    <img src="img/grass.png" style="width:100%;height:100%;display:block;"/>
                    <svg style="position:absolute;top:0;left:0;" width="${TILE_SIZE}" height="${TILE_SIZE}" viewBox="0 0 32 32">
                        <ellipse cx="16" cy="24" rx="10" ry="4" fill="rgba(0,0,0,0.35)"/>
                    </svg>
                </div>`;
                tile.style.overflow = 'hidden';

                // Add tree as separate 3D element AFTER tile rendering
                const treeType = Math.random();
                const treeHeight = 48 + Math.floor(Math.random() * 16); // 48-64px tall
                const treeWidth = 32;

                // Queue tree for later creation (after tiles)
                if (!window._pendingTrees) window._pendingTrees = [];
                window._pendingTrees.push({ x, y, treeType, treeHeight, treeWidth });
            }
            else if (type === 6) { // FLOWERS - Grass base + separate 3D flower elements
                const flowerColors = ['#ff6b6b', '#feca57', '#ff9ff3', '#54a0ff', '#fff', '#ff85a1', '#a855f7'];
                const c1 = flowerColors[Math.floor(Math.random() * flowerColors.length)];

                // Floor tile is custom grass image
                tile.innerHTML = `<img src="img/grass.png" style="width:${TILE_SIZE}px;height:${TILE_SIZE}px;display:block;"/>`;
                tile.style.overflow = 'hidden';

                // Queue flowers for 3D creation
                if (!window._pendingFlowers) window._pendingFlowers = [];
                window._pendingFlowers.push({ x, y, color: c1 });
            }
            else if (type === 7) { // ROCKS - Grass base (shadow is on the image via CSS drop-shadow)
                // Floor tile is custom grass image
                tile.innerHTML = `<img src="img/grass.png" style="width:${TILE_SIZE}px;height:${TILE_SIZE}px;display:block;"/>`;
                tile.style.overflow = 'hidden';

                // Queue rock for 3D creation
                if (!window._pendingRocks) window._pendingRocks = [];
                window._pendingRocks.push({ x, y });
            }

            // Only set SVG if innerHTML wasn't already set (e.g., for grass images)
            if (svg) {
                tile.innerHTML = `<svg width="${TILE_SIZE}" height="${TILE_SIZE}" viewBox="0 0 32 32">${svg}</svg>`;
            }
            world.appendChild(tile);
        }
    }

    // === CREATE 3D TREES ===
    if (window._pendingTrees && window._pendingTrees.length > 0) {
        window._pendingTrees.forEach(treeData => {
            const { x, y, treeType, treeHeight, treeWidth } = treeData;

            const tree = document.createElement('div');
            tree.className = 'env-tree';
            tree.style.position = 'absolute';
            tree.style.left = (x * TILE_SIZE) + 'px';
            tree.style.top = (y * TILE_SIZE) + 'px';
            tree.style.width = treeWidth + 'px';
            tree.style.height = treeHeight + 'px';
            tree.style.zIndex = Math.floor(y + 10);

            let treeSvg = '';

            if (treeType > 0.6) {
                // PINE TREE - Standing upright
                treeSvg = `<svg width="${treeWidth}" height="${treeHeight}" viewBox="0 0 32 64" preserveAspectRatio="xMidYMax meet">
                    <defs>
                        <linearGradient id="pineT${x}${y}" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" style="stop-color:#3d2a1a"/>
                            <stop offset="40%" style="stop-color:#6b4423"/>
                            <stop offset="100%" style="stop-color:#2d1a0a"/>
                        </linearGradient>
                        <linearGradient id="pineL${x}${y}" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:#2d7a2d"/>
                            <stop offset="50%" style="stop-color:#1a5c1a"/>
                            <stop offset="100%" style="stop-color:#0d3d0d"/>
                        </linearGradient>
                    </defs>
                    <!-- Trunk -->
                    <rect x="14" y="48" width="5" height="16" fill="url(#pineT${x}${y})"/>
                    <rect x="14" y="48" width="1" height="16" fill="rgba(255,255,255,0.15)"/>
                    <!-- Pine layers -->
                    <polygon points="16,2 2,22 30,22" fill="url(#pineL${x}${y})"/>
                    <polygon points="16,2 2,22 16,22" fill="rgba(255,255,255,0.1)"/>
                    <polygon points="16,12 4,32 28,32" fill="#1a6b1a"/>
                    <polygon points="16,12 4,32 16,32" fill="rgba(255,255,255,0.08)"/>
                    <polygon points="16,24 6,44 26,44" fill="#2d8b2d"/>
                    <polygon points="16,24 6,44 16,44" fill="rgba(255,255,255,0.06)"/>
                    <polygon points="16,36 8,52 24,52" fill="#3d9d3d"/>
                    <!-- Snow on top -->
                    <circle cx="16" cy="4" r="2" fill="rgba(255,255,255,0.25)"/>
                </svg>`;
            } else if (treeType > 0.3) {
                // OAK TREE - Round canopy
                treeSvg = `<svg width="${treeWidth}" height="${treeHeight}" viewBox="0 0 32 64" preserveAspectRatio="xMidYMax meet">
                    <defs>
                        <linearGradient id="oakT${x}${y}" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" style="stop-color:#4a3520"/>
                            <stop offset="30%" style="stop-color:#7a5530"/>
                            <stop offset="100%" style="stop-color:#3a2510"/>
                        </linearGradient>
                        <radialGradient id="oakL${x}${y}" cx="30%" cy="30%" r="70%">
                            <stop offset="0%" style="stop-color:#5cb85c"/>
                            <stop offset="60%" style="stop-color:#3d8b3d"/>
                            <stop offset="100%" style="stop-color:#1a5c1a"/>
                        </radialGradient>
                    </defs>
                    <!-- Trunk -->
                    <rect x="13" y="40" width="6" height="24" fill="url(#oakT${x}${y})"/>
                    <rect x="13" y="40" width="1.5" height="24" fill="rgba(255,255,255,0.12)"/>
                    <!-- Canopy -->
                    <ellipse cx="16" cy="28" rx="15" ry="14" fill="#1a5c1a"/>
                    <ellipse cx="16" cy="24" rx="14" ry="12" fill="url(#oakL${x}${y})"/>
                    <ellipse cx="12" cy="18" rx="6" ry="5" fill="rgba(255,255,255,0.15)"/>
                    <ellipse cx="22" cy="26" rx="4" ry="3" fill="rgba(0,0,0,0.1)"/>
                    <!-- Detail leaves -->
                    <circle cx="6" cy="24" r="4" fill="#4a9c4a"/>
                    <circle cx="26" cy="20" r="3" fill="#3d8b3d"/>
                    <circle cx="16" cy="12" r="3" fill="#5cb85c"/>
                </svg>`;
            } else {
                // BIRCH TREE - White bark
                treeSvg = `<svg width="${treeWidth}" height="${treeHeight}" viewBox="0 0 32 64" preserveAspectRatio="xMidYMax meet">
                    <defs>
                        <linearGradient id="birchB${x}${y}" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" style="stop-color:#d4d4d4"/>
                            <stop offset="30%" style="stop-color:#f5f5f5"/>
                            <stop offset="70%" style="stop-color:#e8e8e8"/>
                            <stop offset="100%" style="stop-color:#b0b0b0"/>
                        </linearGradient>
                    </defs>
                    <!-- Birch trunk -->
                    <rect x="14" y="32" width="4" height="32" fill="url(#birchB${x}${y})"/>
                    <rect x="15" y="36" width="1" height="4" fill="#333"/>
                    <rect x="16" y="46" width="1" height="3" fill="#333"/>
                    <rect x="14.5" y="56" width="1" height="2" fill="#333"/>
                    <!-- Light canopy -->
                    <ellipse cx="16" cy="22" rx="12" ry="10" fill="#5cb85c"/>
                    <ellipse cx="16" cy="18" rx="10" ry="8" fill="#7dce7d"/>
                    <ellipse cx="12" cy="14" rx="5" ry="4" fill="#9de09d"/>
                    <ellipse cx="20" cy="22" rx="4" ry="3" fill="rgba(0,0,0,0.08)"/>
                    <!-- Highlight -->
                    <ellipse cx="11" cy="12" rx="3" ry="2" fill="rgba(255,255,255,0.25)"/>
                </svg>`;
            }

            tree.innerHTML = treeSvg;
            world.appendChild(tree);
        });
        window._pendingTrees = []; // Clear queue
    }

    // === CREATE 3D FLOWERS - TINY ===
    if (window._pendingFlowers && window._pendingFlowers.length > 0) {
        window._pendingFlowers.forEach(flowerData => {
            const { x, y, color } = flowerData;

            const flower = document.createElement('div');
            flower.className = 'env-flower-3d';
            flower.style.position = 'absolute';
            flower.style.left = (x * TILE_SIZE + 12) + 'px';
            flower.style.top = (y * TILE_SIZE + 8) + 'px';
            flower.style.width = '8px';
            flower.style.height = '10px';
            flower.style.zIndex = Math.floor(y + 5);

            flower.innerHTML = `<svg width="8" height="10" viewBox="0 0 8 10" preserveAspectRatio="xMidYMax meet">
                <path d="M4,10 Q4.5,6 4,3" stroke="#2d7a2d" stroke-width="0.8" fill="none"/>
                <circle cx="4" cy="2.5" r="2.5" fill="${color}"/>
                <circle cx="4" cy="2.5" r="1" fill="#fff700"/>
            </svg>`;

            world.appendChild(flower);
        });
        window._pendingFlowers = [];
    }

    // === CREATE 3D GRASS TUFTS - TINY ===
    if (window._pendingGrass && window._pendingGrass.length > 0) {
        window._pendingGrass.forEach(grassData => {
            const { x, y } = grassData;

            const grass = document.createElement('div');
            grass.className = 'env-flower-3d';
            grass.style.position = 'absolute';
            grass.style.left = (x * TILE_SIZE + 11) + 'px';
            grass.style.top = (y * TILE_SIZE + 10) + 'px';
            grass.style.width = '10px';
            grass.style.height = '8px';
            grass.style.zIndex = Math.floor(y + 3);

            const shade = Math.random() > 0.5 ? '#2d7a2d' : '#3d8b3d';

            grass.innerHTML = `<svg width="10" height="8" viewBox="0 0 10 8" preserveAspectRatio="xMidYMax meet">
                <path d="M2,8 Q3,4 2,0" stroke="${shade}" stroke-width="0.8" fill="none"/>
                <path d="M5,8 Q6,3 5,0" stroke="${shade}" stroke-width="1" fill="none"/>
                <path d="M8,8 Q7,4 8,1" stroke="${shade}" stroke-width="0.8" fill="none"/>
            </svg>`;

            world.appendChild(grass);
        });
        window._pendingGrass = [];
    }

    // === CREATE 3D ROCKS - CUSTOM IMAGE ===
    if (window._pendingRocks && window._pendingRocks.length > 0) {
        window._pendingRocks.forEach(rockData => {
            const { x, y } = rockData;

            // Create shadow element FIRST (behind rock)
            const shadow = document.createElement('div');
            shadow.style.position = 'absolute';
            shadow.style.left = (x * TILE_SIZE + 4) + 'px';
            shadow.style.top = (y * TILE_SIZE + 22) + 'px';
            shadow.style.width = '24px';
            shadow.style.height = '10px';
            shadow.style.background = 'radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 50%, transparent 70%)';
            shadow.style.borderRadius = '50%';
            shadow.style.zIndex = Math.floor(y + 7);
            world.appendChild(shadow);

            // Create rock element
            const rock = document.createElement('div');
            rock.className = 'env-rock';
            rock.style.position = 'absolute';
            rock.style.left = (x * TILE_SIZE + 2) + 'px';
            rock.style.top = (y * TILE_SIZE + 2) + 'px';
            rock.style.width = '28px';
            rock.style.height = '28px';
            rock.style.zIndex = Math.floor(y + 8);
            rock.dataset.type = 'rock';

            // Use custom rock image (no drop-shadow, shadow is separate element)
            rock.innerHTML = `<img src="img/rock.png" alt="rock" style="width:100%;height:100%;object-fit:contain;"/>`;

            world.appendChild(rock);
        });
        window._pendingRocks = [];
    }

    // Add Player Entity (CANVAS)
    const playerContainer = document.createElement('div');
    playerContainer.id = 'playerEntity';
    playerContainer.className = 'entity player-token';
    // Remove static IMG logic
    playerContainer.style.zIndex = Math.floor(playerPos.x + playerPos.y + 1);
    playerContainer.style.width = '32px';
    playerContainer.style.height = '32px';
    playerContainer.style.marginLeft = '-16px'; // Center horizontally
    playerContainer.style.marginTop = '-22px'; // Offset to place feet on tile
    playerContainer.style.transform = `translate3d(0, 0, 10px) rotateX(-60deg) scale(0.7)`;

    // Initialize Procedural Player
    window.proceduralPlayer = new ProceduralPlayer(playerContainer);

    world.appendChild(playerContainer);

    // === PLAYER'S HOUSE (Top-Left Corner) ===
    const playerHouse = document.createElement('div');
    playerHouse.className = 'player-house';
    playerHouse.style.position = 'absolute';
    playerHouse.style.left = (3 * TILE_SIZE) + 'px';
    playerHouse.style.top = (3 * TILE_SIZE) + 'px';
    playerHouse.style.width = (5 * TILE_SIZE) + 'px';
    playerHouse.style.height = (4 * TILE_SIZE) + 'px';
    playerHouse.style.transformStyle = 'preserve-3d';
    playerHouse.style.transform = 'translate3d(0, 0, 5px) rotateX(-60deg)';
    playerHouse.style.transformOrigin = 'bottom center';
    playerHouse.style.zIndex = '50';

    playerHouse.innerHTML = `
                <svg width="100%" height="100%" viewBox="0 0 80 64" xmlns="http://www.w3.org/2000/svg">
                    <!-- House Base -->
                    <rect x="5" y="24" width="70" height="40" fill="#8b4513" stroke="#5c2d0a" stroke-width="2"/>
                    <!-- Roof -->
                    <polygon points="40,0 0,24 80,24" fill="#654321" stroke="#4a2c17" stroke-width="2"/>
                    <!-- Roof highlight -->
                    <polygon points="40,0 0,24 40,24" fill="#7a5230" opacity="0.5"/>
                    <!-- Door -->
                    <rect x="32" y="38" width="16" height="26" fill="#4a2c17" stroke="#3d2414" stroke-width="2"/>
                    <circle cx="44" cy="52" r="2" fill="#ffd700"/>
                    <!-- Windows -->
                    <rect x="12" y="32" width="14" height="12" fill="#87ceeb" stroke="#5c2d0a" stroke-width="2"/>
                    <line x1="19" y1="32" x2="19" y2="44" stroke="#5c2d0a" stroke-width="1"/>
                    <line x1="12" y1="38" x2="26" y2="38" stroke="#5c2d0a" stroke-width="1"/>
                    <rect x="54" y="32" width="14" height="12" fill="#87ceeb" stroke="#5c2d0a" stroke-width="2"/>
                    <line x1="61" y1="32" x2="61" y2="44" stroke="#5c2d0a" stroke-width="1"/>
                    <line x1="54" y1="38" x2="68" y2="38" stroke="#5c2d0a" stroke-width="1"/>
                    <!-- Chimney -->
                    <rect x="55" y="4" width="10" height="16" fill="#666" stroke="#444" stroke-width="1"/>
                    <!-- Smoke -->
                    <circle cx="60" cy="-2" r="3" fill="rgba(200,200,200,0.5)"/>
                    <circle cx="62" cy="-8" r="2" fill="rgba(200,200,200,0.3)"/>
                    <!-- Sign -->
                    <rect x="2" y="50" width="4" height="14" fill="#8b4513"/>
                    <rect x="-2" y="48" width="20" height="10" fill="#deb887" stroke="#8b4513" stroke-width="1"/>
                    <text x="8" y="55" font-size="6" fill="#4a2c17" font-weight="bold" text-anchor="middle">DOM</text>
                </svg>
            `;

    world.appendChild(playerHouse);

    // Spawn monsters with custom images
    const beast1 = createMonster(18, 14, 'Bestia', 50, 'monsters/bestaia1.png');
    monsters.push(beast1);
    spawnMonster(world, beast1);

    const beast2 = createMonster(20, 18, 'Bestia', 50, 'monsters/bestia2.png');
    monsters.push(beast2);
    spawnMonster(world, beast2);

    const beast3 = createMonster(12, 20, 'Bestia', 40, 'monsters/bestaia1.png');
    monsters.push(beast3);
    spawnMonster(world, beast3);


}

function spawnEntity(parent, x, y, icon) {
    const el = document.createElement('div');
    el.className = 'entity npc';
    el.innerHTML = icon;
    el.style.left = (x * TILE_SIZE) + 'px';
    el.style.top = (y * TILE_SIZE) + 'px';
    // Simple depth sorting
    el.style.zIndex = Math.floor(x + y);

    // Make enemies interactable
    if (icon === '🐀' || icon === '🕷️') {
        el.style.pointerEvents = 'auto';
        el.style.cursor = 'pointer';
        el.onclick = () => startBattle(icon === '🐀' ? 'Przerośnięty Szczur' : 'Wielki Pająk', icon);
    }

    parent.appendChild(el);
}

// --- ARENA LOGIC ---
function startBattle(enemyName, enemyIcon) {
    battleState.active = true;
    document.getElementById('arenaScreen').classList.add('active');

    // Setup Arena Grid
    const grid = document.getElementById('arenaGrid');
    grid.innerHTML = '';
    for (let y = 0; y < battleState.gridSize.y; y++) {
        for (let x = 0; x < battleState.gridSize.x; x++) {
            const tile = document.createElement('div');
            tile.className = 'arena-tile';
            tile.style.left = (x * battleState.tileSize) + 'px';
            tile.style.top = (y * battleState.tileSize) + 'px';
            tile.dataset.x = x;
            tile.dataset.y = y;
            tile.onclick = () => handleArenaClick(x, y);
            grid.appendChild(tile);
        }
    }

    // Create Units (Adjust for new grid size)
    // Random monster
    const monsterImg = Math.random() > 0.5 ? 'monsters/bestaia1.png' : 'monsters/bestia2.png';

    battleState.units = [
        { name: selectedHero.name, icon: `img/${selectedHero.file}`, maxHp: 100, hp: 100, x: 1, y: 4, isPlayer: true, id: 'hero' },
        { name: enemyName, icon: `img/${monsterImg}`, maxHp: enemyName === 'Boss' ? 200 : 50, hp: enemyName === 'Boss' ? 200 : 50, x: 10, y: 4, isPlayer: false, id: 'enemy' }
    ];

    // Render Units
    battleState.units.forEach(u => spawnArenaUnit(u));

    battleState.currentUnitIndex = 0;
    battleState.startTurn();
}

function spawnArenaUnit(unit) {
    const el = document.createElement('div');
    el.className = `arena-unit ${unit.isPlayer ? 'hero' : 'enemy'}`;
    el.id = `unit-${unit.id}`;

    let visual = '';
    if (unit.icon) visual = `<img src="${unit.icon}">`;
    else visual = `<div style="font-size:50px">${unit.iconHtml}</div>`;

    el.innerHTML = `
                <div class="arena-unit-hp"><div class="arena-unit-hp-fill" style="width:${(unit.hp / unit.maxHp) * 100}%"></div></div>
                ${visual}
            `;
    updateArenaUnitPos(el, unit.x, unit.y);
    document.getElementById('arenaGrid').appendChild(el);
}

function updateArenaUnitPos(el, x, y) {
    el.style.left = (x * battleState.tileSize + battleState.tileSize / 2) + 'px';
    el.style.top = (y * battleState.tileSize + battleState.tileSize / 2) + 'px';
    el.style.zIndex = x + y + 10;
}

function highlightUnit(unit) {
    // Simple visual cue for now
    document.querySelectorAll('.arena-unit').forEach(u => u.style.filter = 'brightness(0.6)');
    document.getElementById(`unit-${unit.id}`).style.filter = 'brightness(1.2) drop-shadow(0 0 10px gold)';
}

function handleArenaClick(x, y) {
    const currentUnit = battleState.units[battleState.currentUnitIndex];
    if (!currentUnit.isPlayer) return; // Wait for AI

    // Simple movement logic
    const dx = Math.abs(x - currentUnit.x);
    const dy = Math.abs(y - currentUnit.y);

    // Allow move to adjacent
    if (dx <= 1 && dy <= 1 && (dx + dy) > 0) {
        // Check if occupied
        const target = battleState.units.find(u => u.x === x && u.y === y);
        if (target) {
            // Combat Logic - Damage Variation
            const dmg = Math.floor(Math.random() * 10) + 10; // 10-20 dmg

            battleState.log(`${currentUnit.name} atakuje ${target.name} za ${dmg}!`);
            showFloatingText(target.x, target.y, `-${dmg}`, 'red');

            target.hp -= dmg;
            updateUnitVisuals(target);

            if (target.hp <= 0) {
                battleState.log(`${target.name} pokonany!`);
                showFloatingText(target.x, target.y, '☠', 'darkred');
                setTimeout(() => {
                    document.getElementById('arenaScreen').classList.remove('active');
                    battleState.active = false;
                }, 1500);
            }
        } else {
            // Move
            currentUnit.x = x;
            currentUnit.y = y;
            updateArenaUnitPos(document.getElementById(`unit-${currentUnit.id}`), x, y);
        }
        battleState.endTurn();
    }
}

function updateUnitVisuals(unit) {
    const el = document.getElementById(`unit-${unit.id}`);
    el.querySelector('.arena-unit-hp-fill').style.width = (unit.hp / unit.maxHp) * 100 + '%';
}

function aiTurn() {
    const ai = battleState.units[battleState.currentUnitIndex];
    const target = battleState.units.find(u => u.isPlayer);

    if (!target || target.hp <= 0) { battleState.endTurn(); return; }

    // Simple Chase
    const dx = target.x - ai.x;
    const dy = target.y - ai.y;

    // Try to move closer
    let moveX = ai.x;
    let moveY = ai.y;

    if (Math.abs(dx) > Math.abs(dy)) {
        moveX += Math.sign(dx);
    } else {
        moveY += Math.sign(dy);
    }

    // Interaction Check
    if (moveX === target.x && moveY === target.y) {
        // Attack Player
        const dmg = Math.floor(Math.random() * 5) + 5; // 5-10 dmg
        battleState.log(`${ai.name} gryzie ${target.name} za ${dmg}!`);
        showFloatingText(target.x, target.y, `-${dmg}`, 'red');

        target.hp -= dmg;
        updateUnitVisuals(target);
        if (target.hp <= 0) {
            battleState.log(`${target.name} padł! KONIEC GRY.`);
            setTimeout(() => location.reload(), 2000); // Reset for demo
        }
    } else {
        // Check if tile free
        const occupied = battleState.units.find(u => u.x === moveX && u.y === moveY);
        if (!occupied) {
            ai.x = moveX;
            ai.y = moveY;
            updateArenaUnitPos(document.getElementById(`unit-${ai.id}`), moveX, moveY);
        }
    }

    battleState.endTurn();
}

function showFloatingText(x, y, text, color) {
    const grid = document.getElementById('arenaGrid');
    const el = document.createElement('div');
    el.innerText = text;
    el.style.position = 'absolute';
    el.style.left = (x * battleState.tileSize + 30) + 'px';
    el.style.top = (y * battleState.tileSize) + 'px';
    el.style.color = color || 'white';
    el.style.fontSize = '24px';
    el.style.fontWeight = 'bold';
    el.style.textShadow = '0 0 5px black';
    el.style.zIndex = 1000;
    el.style.animation = 'floatUp 1s ease-out forwards';
    el.style.pointerEvents = 'none';
    // Simple transition
    el.style.transition = 'all 1s';
    setTimeout(() => { el.style.top = (y * battleState.tileSize - 50) + 'px'; el.style.opacity = 0; }, 50);

    grid.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

function updatePlayerPosition() {
    // W tym trybie (Kamery za graczem) nie przesuwamy gracza na ekranie!
    // Gracz zawsze zostaje na środku (w sensie logicznym), a przesuwamy MAPĘ.
    // Ale dla zachowania hierarchii DOM, player jest w worldGrid.
    // Używamy PIKSELI dla płynnego ruchu!

    const player = document.getElementById('playerEntity');
    if (player) {
        player.style.left = playerPixelX + 'px';  // PIXEL position, not tile!
        player.style.top = playerPixelY + 'px';
        player.style.zIndex = Math.floor(playerPos.x + playerPos.y + 1);
    }
    updateCamera();
}

function updateCamera() {
    const world = document.getElementById('worldGrid');
    const container = document.querySelector('.game-map-container');

    // Środek ekranu
    const cx = container.offsetWidth / 2;
    const cy = container.offsetHeight / 2;

    // Pozycja gracza w świecie (w pikselach) - używamy PIXEL position!
    // Dodajemy TILE_SIZE/2 żeby celować w środek kafelka
    const px = playerPixelX + (TILE_SIZE / 2);
    const py = playerPixelY + (TILE_SIZE / 2);

    // Przesuwamy świat tak, by gracz był w cx, cy
    // world left = cx - px
    // world top = cy - py
    // Pamiętamy o rotateX(65deg)
    // Transform: translation musi być zaaplikowane do kontenera lub do transformation matrix.
    // Najprościej: przesunąć worldGrid metodą translate3d w jego lokalnym układzie? Nie, to przesunie go w 3D po pochyleniu.
    // Musimy przesunąć 'left' i 'top' diva #worldGrid, albo użyć translate przed rotacją.

    // W CSS mamy: transform: rotateX(65deg);
    // Zmieńmy to na dynamiczne:

    // worldGrid jest absolute. Zmieniajmy jego left/top.
    // Defaultowo jest left: 50%, top: 25% co ustala "Anchor" transformacji.
    // Aby "kamera" śledziła, musimy przesuwać worldGrid w PRZECIWNĄ stronę niż ruch gracza.
    // Jeśli gracz idzie w prawo (x+), worldGrid musi iść w lewo (x-).

    // UWAGA: rotacja X jest "w miejscu". Przesuwanie left/top działa w przestrzeni ekranu (Screen Space).
    // A my chcemy przesuwać mapę w jej własnej płaszczyźnie (World Space)?
    // Jeśli przesuniemy left/top, to cała pochylona płaszczyzna się przesunie.
    // To zadziała, pod warunkiem, że przesunięcie w dół (Y) uwzględni skrót perspektywiczny?
    // Nie, rotateX(65deg) skraca wizualnie Y.
    // Jeśli przesuniemy worldGrid o 10px w dół (screen Y), to wizualnie przesunie się o 10px.
    // Ale w świecie gry 10px "po podłodze" to mniej pikseli na ekranie (cos(65)).
    // NIEPRAWDĘ mówię. Jeśli element jest obrócony, to jego osie lokalne też.
    // Użyjmy transformacji w kolejności: translate(moveWorld) -> rotateX.

    // Resetujemy defaultowe left/top z CSS
    world.style.left = '0';
    world.style.top = '0';
    world.style.marginLeft = '0';

    // CRITICAL: Set transform origin to 0 0 so our translations work as expected relative to top-left
    world.style.transformOrigin = '0 0';

    world.style.transform = `
                translate3d(${cx}px, ${cy}px, 0) 
                scale(3.5)
                rotateX(60deg) 
                translate3d(${-px}px, ${-py}px, 0)
            `;
}


// Old handleInput removed in favor of gameLoop


function addToChat(msg, type = 'chat-msg') {
    // Chat removed, but keeping function to prevent errors if called
    // console.log(msg); 
}

window.addEventListener('resize', () => {
    if (selectedHero) updateCamera();
});

function toggleMenu() {
    const overlay = document.getElementById('overlay');
    const joystick = document.getElementById('joystickContainer');

    if (overlay.style.display === 'flex') {
        overlay.style.display = 'none';
        if (joystick) joystick.style.display = 'block';
    } else {
        overlay.style.display = 'flex';
        if (joystick) joystick.style.display = 'none';
    }
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

function toggleModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal.classList.contains('active')) {
        modal.classList.remove('active');
    } else {
        // Close others first
        document.querySelectorAll('.mobile-modal').forEach(m => m.classList.remove('active'));
        modal.classList.add('active');
    }
}

// Mobile Controls handlers
document.querySelectorAll('.dpad-btn').forEach(btn => {
    const key = btn.dataset.key;

    const startMove = (e) => {
        e.preventDefault(); // Prevent scroll
        if (keys[key]) return; // Already pressed
        keys[key] = true;
        btn.classList.add('active');
        if (!isMoving) requestAnimationFrame(gameLoop);
    };

    const endMove = (e) => {
        if (e.cancelable) e.preventDefault();
        keys[key] = false;
        btn.classList.remove('active');
    };

    // --- PROCEDURAL PLAYER ---
    class ProceduralPlayer {
        constructor(container) {
            this.canvas = document.createElement('canvas');
            this.canvas.width = 120; // High res for small size
            this.canvas.height = 120;
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
            container.appendChild(this.canvas);
            this.ctx = this.canvas.getContext('2d');

            // State matching the prototype
            this.animTime = 0;
            this.idleTime = 0;
            this.facing = 0; // 0:Front, 1:Back, 2:Right, 3:Left
            this.isMoving = false;
            this.bodyRotation = 0;
            this.turnFactor = 1;
            this.velMag = 0;
        }

        update(dt, inputDx, inputDy) {
            // Determine facing based on input
            let targetRot = 0;
            let targetTurn = 1;

            if (inputDx !== 0 || inputDy !== 0) {
                this.isMoving = true;
                this.velMag = 15; // Simulated speed for anim

                if (inputDy < 0) this.facing = 1; // Up -> Back
                else if (inputDy > 0) this.facing = 0; // Down -> Front
                if (inputDx > 0) this.facing = 2; // Right
                else if (inputDx < 0) this.facing = 3; // Left
            } else {
                this.isMoving = false;
                this.velMag = 0;
            }

            if (this.facing === 2) targetRot = 1;
            else if (this.facing === 3) targetRot = -1;

            if (this.facing === 1) targetTurn = -1; // Back
            else if (this.facing === 0) targetTurn = 1; // Front
            if (this.facing === 2 || this.facing === 3) targetTurn = 0;

            // Smooth transitions
            this.bodyRotation += (targetRot - this.bodyRotation) * 10 * dt;
            this.turnFactor += (targetTurn - this.turnFactor) * 8 * dt;

            if (this.isMoving) {
                this.animTime += dt * 5; // Run speed
                this.idleTime = 0;
            } else {
                this.animTime = 0;
                this.idleTime += dt * 2;
            }

            this.draw();
        }

        draw() {
            const ctx = this.ctx;
            const W = this.canvas.width;
            const H = this.canvas.height;
            const CX = W / 2;
            const GROUND_Y = H - 20;

            ctx.clearRect(0, 0, W, H);

            // Colors
            const C = {
                SKIN: '#ffdbac',
                SKIN_SHADOW: '#e0b080',
                SHIRT: '#29b6f6',
                PANTS: '#263238',
                SHOES: '#212121',
                HAIR: '#3e2723' // Dark Brown
            };

            let bob = this.isMoving ? Math.abs(Math.sin(this.animTime)) * 3 : Math.sin(this.idleTime) * 1.5;
            let hipY = GROUND_Y - 35 - bob; // Raised hips
            let legStartY = hipY + 12;

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(CX, GROUND_Y, 14, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            let isFacingRight = (this.facing === 2);
            let isFacingLeft = (this.facing === 3);
            let isSideView = (isFacingRight || isFacingLeft);
            // logic for "visual back" based on transition value
            let visualIsBack = this.turnFactor < -0.2;

            let rot = this.bodyRotation;

            const drawLeg = (isLeft) => {
                let phase = isLeft ? 0 : Math.PI;
                let hipOffset = isLeft ? -7 : 7;
                hipOffset *= (1 - Math.abs(rot) * 0.8);

                let swing = Math.cos(this.animTime + phase);
                if (isSideView) swing *= -1;

                let lift = Math.max(0, Math.sin(this.animTime + phase)) * 10;
                if (!this.isMoving) { swing = 0; lift = 0; }

                let hipX = CX + hipOffset;
                let stride = 14;

                let stepX = 0;
                if (isFacingRight) stepX = swing * stride;
                else if (isFacingLeft) stepX = swing * -stride;

                let footX = hipX + stepX;
                let footY = GROUND_Y - lift; // Simplified Z-height

                let kneeX = (hipX + footX) / 2 + (stepX * 0.2);
                let kneeY = (legStartY + footY) / 2;

                ctx.lineWidth = 8;
                ctx.strokeStyle = C.PANTS;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(hipX, legStartY);
                ctx.quadraticCurveTo(kneeX, kneeY, footX, footY);
                ctx.stroke();

                ctx.fillStyle = C.SHOES;
                ctx.beginPath();
                ctx.ellipse(footX, footY, 6, 3, 0, 0, Math.PI * 2);
                ctx.fill();
            };

            const drawArm = (isLeft) => {
                let shoulderX = CX + (isLeft ? -13 : 13) * (1 - Math.abs(rot) * 0.6);
                let shoulderY = hipY - 24;
                let phase = isLeft ? Math.PI : 0;

                let handX = shoulderX;
                let handY = shoulderY + 25;

                if (this.isMoving) {
                    let swing = Math.cos(this.animTime + phase) * 15;
                    if (isSideView) handX += swing;
                    else handY -= Math.abs(swing) * 0.5;
                } else {
                    handX += Math.sin(this.idleTime) * 2;
                }

                ctx.strokeStyle = C.SHIRT;
                ctx.lineWidth = 7;
                ctx.beginPath();
                ctx.moveTo(shoulderX, shoulderY);
                ctx.lineTo(handX, handY);
                ctx.stroke();

                ctx.fillStyle = C.SKIN;
                ctx.beginPath();
                ctx.arc(handX, handY, 4, 0, Math.PI * 2);
                ctx.fill();
            };

            // Draw Order
            if (visualIsBack) {
                drawLeg(true); drawLeg(false);
                drawArm(true); drawArm(false);
            } else {
                drawLeg(true); drawLeg(false); // Front legs
            }

            // TORSO
            ctx.fillStyle = C.SHIRT;
            ctx.beginPath();
            let w = 14 - Math.abs(rot) * 5;
            ctx.moveTo(CX - w, hipY - 28); // Shoulders
            ctx.lineTo(CX + w, hipY - 28);
            ctx.lineTo(CX + w - 2, hipY + 10);
            ctx.lineTo(CX - w + 2, hipY + 10);
            ctx.fill();

            if (!visualIsBack) {
                drawArm(true); drawArm(false);
            }

            // HEAD
            let headY = hipY - 42;
            let headX = CX + rot * 4;

            // Neck
            ctx.fillStyle = C.SKIN_SHADOW;
            ctx.fillRect(headX - 4, headY + 12, 8, 8);

            // Face
            ctx.fillStyle = C.SKIN;
            ctx.beginPath();
            ctx.arc(headX, headY, 13, 0, Math.PI * 2);
            ctx.fill();

            // EYES - FIX: Only draw if NOT back
            if (!visualIsBack) {
                let eyeOff = rot * 8;
                ctx.fillStyle = '#111';

                if (isSideView) {
                    ctx.beginPath(); ctx.arc(headX + (isFacingRight ? 5 : -5), headY, 2, 0, Math.PI * 2); ctx.fill();
                } else {
                    ctx.beginPath(); ctx.arc(headX - 4, headY, 2, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(headX + 4, headY, 2, 0, Math.PI * 2); ctx.fill();
                }
            }

            // HAIR - FIX: Improved style
            ctx.fillStyle = C.HAIR;
            ctx.beginPath();
            // Base
            ctx.arc(headX, headY - 2, 14, 0, Math.PI * 2); // Bigger volume
            // Spikes / Messy top
            ctx.moveTo(headX - 14, headY - 5);
            ctx.quadraticCurveTo(headX, headY - 20, headX + 14, headY - 5);

            // Back cover if facing back
            if (visualIsBack) {
                ctx.lineTo(headX + 14, headY + 8);
                ctx.quadraticCurveTo(headX, headY + 15, headX - 14, headY + 8);
            } else {
                // Front bangs
                ctx.lineTo(headX + 14, headY + 2);
                ctx.quadraticCurveTo(headX, headY - 5, headX - 14, headY + 2);
            }
            ctx.fill();
        }
    }

    // Mouse
    btn.addEventListener('mousedown', startMove);
    btn.addEventListener('mouseup', endMove);
    btn.addEventListener('mouseleave', endMove);

    // Touch
    btn.addEventListener('touchstart', (e) => startMove(e), { passive: false });
    btn.addEventListener('touchend', (e) => endMove(e), { passive: false });
    btn.addEventListener('touchcancel', (e) => endMove(e), { passive: false });
});

// VIRTUAL JOYSTICK
let joystickActive = false;
let joystickDx = 0;
let joystickDy = 0;

function setupJoystick() {
    const container = document.getElementById('joystickContainer');
    const base = document.getElementById('joystickBase');
    const knob = document.getElementById('joystickKnob');
    if (!base || !knob) return;

    const maxDist = 35;

    const handleMove = (clientX, clientY) => {
        const rect = base.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }

        knob.style.left = `calc(50% + ${dx}px)`;
        knob.style.top = `calc(50% + ${dy}px)`;

        // Normalize to -1 to 1
        joystickDx = dx / maxDist;
        joystickDy = dy / maxDist;

        // Dead zone
        if (Math.abs(joystickDx) < 0.2) joystickDx = 0;
        if (Math.abs(joystickDy) < 0.2) joystickDy = 0;

        // Set virtual keys for gameLoop
        keys['ArrowLeft'] = joystickDx < -0.3;
        keys['ArrowRight'] = joystickDx > 0.3;
        keys['ArrowUp'] = joystickDy < -0.3;
        keys['ArrowDown'] = joystickDy > 0.3;
    };

    const handleEnd = () => {
        joystickActive = false;
        knob.style.left = '50%';
        knob.style.top = '50%';
        knob.style.transform = 'translate(-50%, -50%)';
        joystickDx = 0;
        joystickDy = 0;
        keys['ArrowLeft'] = false;
        keys['ArrowRight'] = false;
        keys['ArrowUp'] = false;
        keys['ArrowDown'] = false;
    };

    base.addEventListener('mousedown', (e) => {
        joystickActive = true;
        handleMove(e.clientX, e.clientY);
    });

    base.addEventListener('touchstart', (e) => {
        e.preventDefault();
        joystickActive = true;
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    window.addEventListener('mousemove', (e) => {
        if (joystickActive) handleMove(e.clientX, e.clientY);
    });

    window.addEventListener('touchmove', (e) => {
        if (joystickActive) handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchend', handleEnd);
}

setupJoystick();

// IRATUS-STYLE TURN COMBAT SYSTEM
let playerHP = 100;
let playerMana = 50;
let playerLevel = 1;
let playerXP = 0;
let playerGold = 0;
let monstersKilled = 0;
let currentCombat = null;
let playerTurn = true;
let isDefending = false;

// XP thresholds for each level (first kill = instant level 2)
const XP_THRESHOLDS = [0, 0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 4000];

function getXPForNextLevel(level) {
    return XP_THRESHOLDS[level + 1] || (level * 500);
}

function calculateXPGain(monsterLevel) {
    return 50 + (monsterLevel * 20) + Math.floor(Math.random() * 30);
}

function addXP(amount) {
    if (playerLevel === 1 && monstersKilled === 0) {
        // First kill - instant level 2!
        playerLevel = 2;
        playerXP = 0;
        showGameMessage('⬆️ LEVEL UP! Poziom 2!', 'success');
        updateHUDLevel();
        saveGame();
        return;
    }

    playerXP += amount;
    const needed = getXPForNextLevel(playerLevel);

    while (playerXP >= needed && playerLevel < 99) {
        playerXP -= needed;
        playerLevel++;
        showGameMessage(`⬆️ LEVEL UP! Poziom ${playerLevel}!`, 'success');
    }
    updateHUDLevel();
    saveGame();
}

function updateHUDLevel() {
    const levelEl = document.getElementById('hudLevel');
    if (levelEl) levelEl.textContent = 'Lv.' + playerLevel;

    const xpEl = document.getElementById('hudXP');
    if (xpEl) {
        const needed = getXPForNextLevel(playerLevel);
        xpEl.textContent = playerXP + '/' + needed + ' XP';
    }
}

// SAVE/LOAD GAME
function saveGame() {
    const saveData = {
        heroFile: selectedHero ? selectedHero.file : null,
        heroName: selectedHero ? selectedHero.name : null,
        playerName: creationName,
        level: playerLevel,
        xp: playerXP,
        hp: playerHP,
        mana: playerMana,
        gold: playerGold,
        monstersKilled: monstersKilled
    };
    localStorage.setItem('bestia_save', JSON.stringify(saveData));
}

function loadGame() {
    const data = localStorage.getItem('bestia_save');
    if (!data) return false;

    try {
        const save = JSON.parse(data);
        if (save.heroFile && save.playerName) {
            // Find hero by file
            selectedHero = allCharacters.find(h => h.file === save.heroFile) || null;
            creationName = save.playerName || '';
            playerLevel = save.level || 1;
            playerXP = save.xp || 0;
            playerHP = save.hp || 100;
            playerMana = save.mana || 50;
            playerGold = save.gold || 0;
            monstersKilled = save.monstersKilled || 0;
            return true;
        }
    } catch (e) {
        console.error('Failed to load save:', e);
    }
    return false;
}

function resetGame() {
    localStorage.removeItem('bestia_save');
    selectedHero = null;
    creationName = '';
    playerLevel = 1;
    playerXP = 0;
    playerHP = 100;
    playerMana = 50;
    playerGold = 0;
    monstersKilled = 0;
    location.reload();
}

function startCombat(monster) {
    currentCombat = {
        monster: monster,
        playerHP: playerHP,
        playerMaxHP: 100,
        // Add Mana to combat state
        playerMana: playerMana,
        playerMaxMana: 50,

        enemyHP: monster.hp,
        enemyMaxHP: monster.maxHp,
        enemyName: monster.name
    };

    // Setup combat screen
    document.getElementById('combatScreen').classList.add('active');

    // Player Info
    document.getElementById('playerCombatName').textContent = selectedHero ? selectedHero.name.toUpperCase() : 'GRACZ';
    document.getElementById('playerCombatLevel').textContent = 'Lvl 1'; // Placeholder for now

    // Enemy Info
    document.getElementById('enemyCombatName').textContent = monster.name.toUpperCase();
    document.getElementById('enemyCombatLevel').textContent = 'Lvl ' + (monster.level || 1);

    // Set Player Sprite (Image)
    const playerSprite = document.getElementById('playerCombatSprite');
    if (selectedHero && selectedHero.file) {
        playerSprite.innerHTML = `<img src="img/${selectedHero.file}" style="width:100px;height:100px;object-fit:contain;">`;
        // Remove any emoji text content if present, just in case
        // logic handled by innerHTML replacement
    } else {
        playerSprite.textContent = '🧙';
    }

    // Set Enemy Sprite
    const enemySprite = document.getElementById('enemyCombatSprite');
    if (monster.visual.includes('.png') || monster.visual.includes('.jpg')) {
        enemySprite.innerHTML = `<img src="img/${monster.visual}" style="width:80px;height:80px;object-fit:contain;">`;
    } else {
        enemySprite.textContent = monster.visual;
    }

    // Update HP displays
    updateCombatHP();

    playerTurn = true;
    isDefending = false;
    combatTurn = 1;
    combatPotions = 3;
    updateTurnCounter();
    document.getElementById('turnIndicator').textContent = 'TWOJA TURA';
    document.getElementById('combatLog').innerHTML = `> Walka z ${monster.name} rozpoczęta!`;
    setButtonsEnabled(true);
}

function updateCombatHP() {
    const c = currentCombat;
    document.getElementById('playerCombatHP').style.width = (c.playerHP / c.playerMaxHP * 100) + '%';
    document.getElementById('playerHPText').textContent = `${Math.max(0, c.playerHP)}/${c.playerMaxHP}`;

    // Mana Update
    document.getElementById('playerCombatMana').style.width = (playerMana / c.playerMaxMana * 100) + '%';
    document.getElementById('playerManaText').textContent = `${Math.max(0, playerMana)}/${c.playerMaxMana}`;

    document.getElementById('enemyCombatHP').style.width = (c.enemyHP / c.enemyMaxHP * 100) + '%';
    document.getElementById('enemyHPText').textContent = `${Math.max(0, c.enemyHP)}/${c.enemyMaxHP}`;
}

function setButtonsEnabled(enabled) {
    document.querySelectorAll('.combat-btn').forEach(btn => {
        btn.disabled = !enabled;
    });
}

function showFloatingDamage(targetId, amount, type = 'damage') {
    const target = document.getElementById(targetId);
    if (!target) return;

    const floater = document.createElement('div');
    floater.className = `floating-damage ${type}`;
    floater.textContent = type === 'heal' ? `+${amount}` : `-${amount}`;

    // Position relative to target
    const rect = target.getBoundingClientRect();
    floater.style.left = (rect.left + rect.width / 2 - 20) + 'px';
    floater.style.top = (rect.top - 10) + 'px';
    floater.style.position = 'fixed';

    document.body.appendChild(floater);

    // Remove after animation
    setTimeout(() => floater.remove(), 1000);
}

function addCombatLog(msg, type = 'system') {
    const log = document.getElementById('combatLog');
    let color = 'rgba(255,255,255,0.8)'; // default gray
    if (type === 'player') color = '#4ade80'; // green
    else if (type === 'enemy') color = '#f87171'; // red
    else if (type === 'heal') color = '#60a5fa'; // blue for heal
    log.innerHTML += `<br><span style="color:${color}">> ${msg}</span>`;
    log.scrollTop = log.scrollHeight;
}

// Turn counter
let combatTurn = 1;

function updateTurnCounter() {
    document.getElementById('turnCounter').textContent = `Tura ${combatTurn}`;
}

// Particle Effects
function spawnParticles(targetId, count = 8, color = '#ff6644') {
    const target = document.getElementById(targetId);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = centerX + 'px';
        particle.style.top = centerY + 'px';
        particle.style.width = (4 + Math.random() * 6) + 'px';
        particle.style.height = particle.style.width;
        particle.style.background = color;

        // Random direction
        const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
        const distance = 30 + Math.random() * 40;
        particle.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
        particle.style.setProperty('--ty', Math.sin(angle) * distance + 'px');

        document.body.appendChild(particle);
        setTimeout(() => particle.remove(), 600);
    }
}

// Sound Effects (using Web Audio API for simple beeps)
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    gainNode.gain.value = 0.1;

    if (type === 'hit') {
        oscillator.frequency.value = 150;
        oscillator.type = 'square';
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    } else if (type === 'magic') {
        oscillator.frequency.value = 400;
        oscillator.type = 'sine';
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    } else if (type === 'heal') {
        oscillator.frequency.value = 600;
        oscillator.type = 'sine';
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    } else if (type === 'victory') {
        oscillator.frequency.value = 523; // C5
        oscillator.type = 'triangle';
        setTimeout(() => { oscillator.frequency.value = 659; }, 150); // E5
        setTimeout(() => { oscillator.frequency.value = 784; }, 300); // G5
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    }

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.5);
}

// Combat Items (Potions)
let combatPotions = 3; // Start with 3 health potions
let combatManaPotions = 3; // Start with 3 mana potions

function useCombatItem() {
    if (!playerTurn || !currentCombat) return;

    if (combatPotions <= 0) {
        addCombatLog('Brak mikstur zdrowia!', 'system');
        return;
    }

    combatPotions--;
    const healAmount = 40;
    currentCombat.playerHP = Math.min(currentCombat.playerMaxHP, currentCombat.playerHP + healAmount);

    showFloatingDamage('playerCombatSprite', healAmount, 'heal');
    spawnParticles('playerCombatSprite', 6, '#44ff88');
    playSound('heal');
    addCombatLog(`Użyto mikstury zdrowia! +${healAmount} HP (Pozostało: ${combatPotions})`, 'heal');
    updateCombatHP();

    setButtonsEnabled(false);
    setTimeout(enemyTurn, 800);
}

function useManaPotion() {
    if (!playerTurn || !currentCombat) return;

    if (combatManaPotions <= 0) {
        addCombatLog('Brak mikstur many!', 'system');
        return;
    }

    combatManaPotions--;
    const manaAmount = 25;
    currentCombat.playerMana = Math.min(currentCombat.playerMaxMana, currentCombat.playerMana + manaAmount);
    playerMana = currentCombat.playerMana; // Sync global

    showFloatingDamage('playerCombatSprite', manaAmount, 'mana');
    spawnParticles('playerCombatSprite', 6, '#4488ff');
    playSound('magic');
    addCombatLog(`Użyto mikstury many! +${manaAmount} MP (Pozostało: ${combatManaPotions})`, 'heal');
    updateCombatHP();

    setButtonsEnabled(false);
    setTimeout(enemyTurn, 800);
}

// XP Reward Bar
function showXPReward(xpGained, goldGained) {
    const bar = document.createElement('div');
    bar.className = 'xp-reward-bar';
    bar.innerHTML = `
                <h3>🎉 ZWYCIĘSTWO! 🎉</h3>
                <p>+${xpGained} XP | +${goldGained} 💰</p>
                <div class="xp-bar-container">
                    <div class="xp-bar-fill" style="width: 0%"></div>
                </div>
            `;
    document.body.appendChild(bar);

    // Animate XP bar
    setTimeout(() => {
        bar.querySelector('.xp-bar-fill').style.width = '100%';
    }, 100);

    // Remove after delay
    setTimeout(() => bar.remove(), 3000);
}

function combatSkill(skillName) {
    if (!playerTurn || !currentCombat) return;

    let damage = 0;
    let manaCost = 0;
    let healAmount = 0;
    let logMsg = '';
    let animationClass = 'attacking';

    // Skill Logic
    if (skillName === 'attack') {
        manaCost = 0;
        damage = 8 + Math.floor(Math.random() * 8); // 8-15 dmg
        logMsg = `Szybki atak! Zadajesz ${damage} obrażeń.`;
    } else if (skillName === 'power') {
        manaCost = 10;
        if (playerMana < manaCost) {
            addCombatLog('Za mało many! (Potrzeba 10)', 'system');
            return;
        }
        damage = 18 + Math.floor(Math.random() * 12); // 18-30 dmg
        logMsg = `Silny atak! Zadajesz ${damage} obrażeń! 💥`;
    } else if (skillName === 'fireball') {
        manaCost = 20;
        if (playerMana < manaCost) {
            addCombatLog('Za mało many! (Potrzeba 20)', 'system');
            return;
        }
        damage = 25 + Math.floor(Math.random() * 15); // 25-40 dmg
        logMsg = `Kula ognia! Zadajesz ${damage} obrażeń! 🔥`;
        animationClass = 'attacking';
    } else if (skillName === 'heal') {
        manaCost = 15;
        if (playerMana < manaCost) {
            addCombatLog('Za mało many! (Potrzeba 15)', 'system');
            return;
        }
        healAmount = 30;
        logMsg = `Leczenie! Odzyskujesz ${healAmount} HP. ❤️`;
        animationClass = '';
    }

    // Pay Mana
    if (manaCost > 0) {
        playerMana -= manaCost;
    }

    setButtonsEnabled(false);

    // Execute Effects
    if (damage > 0) {
        // Player attack animation
        const playerSprite = document.getElementById('playerCombatSprite');
        playerSprite.classList.add(animationClass);
        setTimeout(() => playerSprite.classList.remove(animationClass), 300);

        currentCombat.enemyHP -= damage;

        // Enemy hit animation + floating damage + particles + sound
        setTimeout(() => {
            const enemySprite = document.getElementById('enemyCombatSprite');
            enemySprite.classList.add('hit');
            showFloatingDamage('enemyCombatSprite', damage, 'damage');
            spawnParticles('enemyCombatSprite', 8, skillName === 'fireball' ? '#ff6600' : '#ff4444');
            playSound(skillName === 'fireball' ? 'magic' : 'hit');
            setTimeout(() => enemySprite.classList.remove('hit'), 300);
        }, 150);
    }

    if (healAmount > 0) {
        currentCombat.playerHP = Math.min(currentCombat.playerMaxHP, currentCombat.playerHP + healAmount);
        const playerSprite = document.getElementById('playerCombatSprite');
        playerSprite.classList.add('hit');
        showFloatingDamage('playerCombatSprite', healAmount, 'heal');
        spawnParticles('playerCombatSprite', 6, '#44ff88');
        playSound('heal');
        setTimeout(() => playerSprite.classList.remove('hit'), 300);
    }

    addCombatLog(logMsg, healAmount > 0 ? 'heal' : 'player');
    updateCombatHP();

    // Check enemy death
    if (currentCombat.enemyHP <= 0) {
        setTimeout(() => endCombat(true), 500);
        return;
    }

    // Enemy turn
    setTimeout(enemyTurn, 800);
}

// function combatAttack() REMOVED in favor of combatSkill('attack')

function combatDefend() {
    if (!playerTurn || !currentCombat) return;
    setButtonsEnabled(false);
    isDefending = true;
    addCombatLog('Przygotwujesz się do obrony!', 'player');
    document.getElementById('turnIndicator').textContent = 'OBRONA!';

    setTimeout(enemyTurn, 500);
}

function combatFlee() {
    if (!playerTurn || !currentCombat) return;

    // 50% chance to flee
    if (Math.random() > 0.5) {
        addCombatLog('Udało Ci się uciec!', 'player');
        setTimeout(() => endCombat(null), 500);
    } else {
        addCombatLog('Nie udało się uciec!', 'system');
        setButtonsEnabled(false);
        setTimeout(enemyTurn, 500);
    }
}

function enemyTurn() {
    playerTurn = false;
    document.getElementById('turnIndicator').textContent = 'TURA WROGA';

    setTimeout(() => {
        // Enemy attack animation
        const enemySprite = document.getElementById('enemyCombatSprite');
        enemySprite.classList.add('attacking');
        setTimeout(() => enemySprite.classList.remove('attacking'), 300);

        // Calculate damage (reduced if defending)
        let damage = 5 + Math.floor(Math.random() * 10);
        if (isDefending) {
            damage = Math.floor(damage * 0.3);
            addCombatLog(`Blokowałeś! Tylko ${damage} obrażeń!`, 'player');
        } else {
            addCombatLog(`${currentCombat.enemyName} zadaje ${damage} obrażeń!`, 'enemy');
        }

        currentCombat.playerHP -= damage;
        playerHP = currentCombat.playerHP;

        // Player hit animation + floating damage + particles + sound
        setTimeout(() => {
            const playerSprite = document.getElementById('playerCombatSprite');
            playerSprite.classList.add('hit');
            showFloatingDamage('playerCombatSprite', damage, 'enemy-damage');
            spawnParticles('playerCombatSprite', 6, '#ffaa00');
            playSound('hit');
            setTimeout(() => playerSprite.classList.remove('hit'), 300);
        }, 150);

        updateCombatHP();
        isDefending = false;

        // Check player death
        if (currentCombat.playerHP <= 0) {
            setTimeout(() => endCombat(false), 500);
            return;
        }

        // Back to player turn
        setTimeout(() => {
            playerTurn = true;
            combatTurn++;
            updateTurnCounter();
            document.getElementById('turnIndicator').textContent = 'TWOJA TURA';
            setButtonsEnabled(true);
        }, 500);
    }, 500);
}

function endCombat(playerWon) {
    document.getElementById('combatScreen').classList.remove('active');

    if (playerWon === true) {
        // Victory!
        const monsterLevel = currentCombat.monster.level || 1;
        const xpGain = calculateXPGain(monsterLevel);
        const goldGain = 10 + Math.floor(Math.random() * 20);

        monstersKilled++;
        playerGold += goldGain;

        // Update Quest: Kill Beasts
        updateQuestProgress();

        // Play victory sound and show XP bar
        playSound('victory');
        showXPReward(xpGain, goldGain);

        // Add XP (handles leveling)
        addXP(xpGain);

        // Remove monster from map
        const m = currentCombat.monster;
        const idx = monsters.indexOf(m);
        if (idx > -1) {
            if (m.element) m.element.remove();
            monsters.splice(idx, 1);
        }

        // Update gold in HUD
        const goldEl = document.getElementById('goldText');
        if (goldEl) goldEl.textContent = playerGold;
    } else if (playerWon === false) {
        // Defeat
        showGameMessage('💀 Przegrałeś walkę!', 'error');
        playerHP = 100;
    }
    // else: fled, no changes except HP

    // Update HUD HP
    const hpFill = document.querySelector('.hp-fill');
    const hpText = document.getElementById('hpText');
    if (hpFill) hpFill.style.width = playerHP + '%';
    if (hpText) hpText.textContent = playerHP + '/100';

    currentCombat = null;
}

// Custom in-game message (replaces alert to prevent fullscreen exit)
function showGameMessage(text, type = 'info') {
    const overlay = document.createElement('div');
    overlay.className = 'game-message-overlay';
    overlay.innerHTML = `
                <div class="game-message ${type}">
                    <div class="game-message-text">${text}</div>
                    <button class="game-message-btn" onclick="this.parentElement.parentElement.remove()">OK</button>
                </div>
            `;
    document.body.appendChild(overlay);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (overlay.parentElement) overlay.remove();
    }, 3000);
}

// Settings Menu
function showSettingsMenu() {
    const overlay = document.createElement('div');
    overlay.className = 'game-message-overlay';
    overlay.id = 'settingsOverlay';
    overlay.innerHTML = `
                <div class="game-message" style="width: 280px; padding-top: 50px;">
                    <button onclick="document.getElementById('settingsOverlay').remove()" 
                            style="position:absolute; top:10px; right:10px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:#fff; font-size:20px; font-weight:bold; width:36px; height:36px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 5px rgba(0,0,0,0.3);">✕</button>
                    <div class="game-message-text" style="font-size: 1.2rem;">⚙️ Ustawienia</div>
                    <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:15px;">
                        <button class="game-message-btn" style="padding: 10px; font-size: 0.9rem;" onclick="toggleFullscreen(); document.getElementById('settingsOverlay').remove();">📺 Pełny Ekran</button>
                        <button class="game-message-btn" style="background: linear-gradient(135deg, #f44336, #d32f2f); padding: 10px; font-size: 0.9rem;" onclick="confirmResetGame()">🗑️ Resetuj Postać</button>
                    </div>
                    <button class="game-message-btn" style="padding: 8px 20px; font-size: 0.8rem; background: #333; color: #ccc;" onclick="document.getElementById('settingsOverlay').remove()">Zamknij</button>
                </div>
            `;
    document.body.appendChild(overlay);
}

function confirmResetGame() {
    const overlay = document.createElement('div');
    overlay.className = 'game-message-overlay';
    overlay.id = 'confirmResetOverlay';
    overlay.innerHTML = `
                <div class="game-message error" style="width: 280px; padding-top: 40px;">
                    <button onclick="document.getElementById('confirmResetOverlay').remove()" 
                            style="position:absolute; top:10px; right:12px; background:none; border:none; color:#fff; font-size:20px; cursor:pointer;">✕</button>
                    <div class="game-message-text" style="font-size: 1.1rem; color:#fff;">⚠️ Resetować?</div>
                    <div style="font-size: 0.8rem; color: #fff; opacity: 0.9; margin-bottom: 15px;">Utracisz poziom i postępy!</div>
                    <div style="display:flex; gap:10px; justify-content:center;">
                        <button class="game-message-btn" style="background: linear-gradient(135deg, #f44336, #d32f2f); padding: 10px 20px; font-size: 0.9rem;" onclick="resetGame()">RESETUJ</button>
                        <button class="game-message-btn" style="padding: 10px 20px; font-size: 0.9rem; background: #333; color: #ccc;" onclick="document.getElementById('confirmResetOverlay').remove();">NIE</button>
                    </div>
                </div>
            `;
    document.body.appendChild(overlay);
}

// Make monsters clickable for combat
function makeMonsterClickable(monsterElement, monster) {
    monsterElement.style.cursor = 'pointer';
    monsterElement.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Check if close enough (2 tiles)
        const mx = monster.x + 12;
        const my = monster.y + 12;
        const dist = Math.sqrt((playerPixelX - mx) ** 2 + (playerPixelY - my) ** 2);

        if (dist < TILE_SIZE * 2.5) {
            startCombat(monster);
        } else {
            showFloatingDamage(playerPixelX, playerPixelY - 20, 'Za daleko!', '#ffff00');
        }
    });
}

// Override spawnMonster to make monsters clickable
const originalSpawnMonster = spawnMonster;
spawnMonster = function (world, monster) {
    originalSpawnMonster(world, monster);
    makeMonsterClickable(monster.element, monster);
};

// FULLSCREEN TOGGLE
function toggleFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log('Fullscreen error:', err);
            });
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

// Alias for menu
function toggleFullScreen() {
    toggleFullscreen();
}

// Auto-fullscreen on first interaction (mobile)
let hasRequestedFullscreen = false;
function requestFullscreenOnce() {
    if (hasRequestedFullscreen) return;
    hasRequestedFullscreen = true;

    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => { });
    } else if (document.documentElement.webkitRequestFullscreen) {
        document.documentElement.webkitRequestFullscreen();
    }

    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => { });
    }
}

document.addEventListener('click', requestFullscreenOnce, { once: true });
// Removed touchstart to prevent "API can only be initiated by a user gesture" errors on scroll
// document.addEventListener('touchstart', requestFullscreenOnce, { once: true });

document.addEventListener('fullscreenchange', () => {
    const btn = document.querySelector('.fullscreen-hint');
    if (btn) {
        btn.style.display = document.fullscreenElement ? 'none' : 'block';
    }
});

// PWA Install Prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('installBtn');
    if (installBtn) installBtn.style.display = 'inline-block';
});

function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('PWA installed');
            }
            deferredPrompt = null;
            document.getElementById('installBtn').style.display = 'none';
        });
    } else {
        alert('Dodaj grę do ekranu głównego:\n\nAndroid: Menu ⋮ → "Zainstaluj aplikację"\niOS: Share → "Dodaj do ekranu początkowego"');
    }
}

// Try to lock screen to landscape
function tryLockLandscape() {
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape')
            .then(() => console.log('Locked to landscape'))
            .catch(() => alert('Blokada orientacji nie jest obsługiwana.\nSpróbuj włączyć pełny ekran lub zainstalować jako PWA.'));
    } else {
        alert('Blokada orientacji nie jest obsługiwana w tej przeglądarce.\n\niOS: Dodaj do ekranu głównego jako aplikację.');
    }
}

// AUTO-LOAD SAVED GAME ON STARTUP
(function initGame() {
    // Fix layout on load
    fixIOSLayout();
    window.addEventListener('resize', fixIOSLayout);
    window.addEventListener('orientationchange', () => {
        setTimeout(fixIOSLayout, 100);
    });

    if (loadGame()) {
        // Found saved game - auto start!
        console.log('Loaded saved game:', creationName, selectedHero?.name);

        // Fill in the name input if it exists
        const nameInput = document.getElementById('heroNameInput');
        if (nameInput) nameInput.value = creationName;

        // Wait a moment for DOM to be ready, then start game
        setTimeout(() => {
            startGame();
        }, 100);
    }
})();

// AGGRESSIVE iOS LAYOUT FIX
function fixIOSLayout() {
    const height = window.innerHeight;
    document.documentElement.style.height = height + 'px';
    document.body.style.height = height + 'px';

    const combatScreen = document.getElementById('combatScreen');
    if (combatScreen) {
        combatScreen.style.height = height + 'px';
        // Force bottom padding regarding safe area manually if needed
        // But mostly ensuring the container fits the visible window is key
    }
}
