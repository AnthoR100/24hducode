/**
 * 3026 Explorer Bot — nearest-unexplored exploration
 *
 * Usage : node bot.js
 */

import { readFileSync } from "fs";

// ─── Config ────────────────────────────────────────────
const envFile = readFileSync(".env", "utf8");
const env = Object.fromEntries(
  envFile.split("\n").filter(l => l.includes("=") && !l.startsWith("#")).map(l => {
    const [k, ...v] = l.split("=");
    return [k.trim(), v.join("=").trim()];
  })
);

const SERVER     = env.BOT_SERVER || "http://213.32.90.176:4000";
const API        = `${SERVER}/game`;
const DB         = `${SERVER}/db`;
const TOKEN      = env.CODINGGAME_ID;
const MOVE_DELAY = parseInt(env.MOVE_DELAY) || 500;
const SAFETY     = 8;
const MAX_ENERGY = 200;

const TARGET_ZONES = [3, 4];

// ─── State ─────────────────────────────────────────────
const cells = new Map();
const checkpoints = new Set();
const riskCells = new Set();
const dangerNearby = new Set();
let shipPos = null;
let energy = null;
let prevEnergy = null;
let maxZoneSeen = 0;

const DIR_HINTS = {
  N:  { dx: 0,  dy: -1 }, S:  { dx: 0,  dy: 1 },
  E:  { dx: 1,  dy: 0 },  W:  { dx: -1, dy: 0 },
  NE: { dx: 1,  dy: -1 }, NW: { dx: -1, dy: -1 },
  SE: { dx: 1,  dy: 1 },  SW: { dx: -1, dy: 1 },
};

// ─── Helpers ───────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dist = (x1, y1, x2, y2) => Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
function log(icon, msg) { console.log(`  ${icon} [${new Date().toLocaleTimeString("fr-FR")}] ${msg}`); }

// ─── API ───────────────────────────────────────────────
async function gameApi(method, path, body = null) {
  const opts = { method, headers: { "codinggame-id": TOKEN } };
  if (body) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
  try {
    const res = await fetch(`${API}${path}`, opts);
    if (res.status === 204) return { ok: true };
    const text = await res.text();
    if (!text) return { ok: true };
    const data = JSON.parse(text);
    if (!res.ok) { log("❌", `${path}: ${data.message || data.codeError || res.status}`); return null; }
    return data;
  } catch (e) { log("❌", `Réseau: ${e.message}`); return null; }
}

// ─── Taxes auto ────────────────────────────────────────
async function checkAndPayTaxes() {
  // Essayer GET sans filtre (le filtre ?status=DUE passe peut-être mal)
  const taxes = await gameApi("GET", "/taxes");
  if (!taxes || !Array.isArray(taxes)) return;

  const due = taxes.filter(t => t.state === "DUE");
  if (due.length === 0) return;

  log("💸", `${due.length} taxe(s) à payer`);

  for (const tax of due) {
    log("💸", `${tax.type} — ${tax.amount} OR (id: ${tax.id.slice(0, 8)})`);

    // Essayer PUT d'abord (OAS), sinon POST
    let r = await gameApi("PUT", `/taxes/${tax.id}`);
    if (!r) {
      log("⚠", "PUT échoué, essai POST...");
      r = await gameApi("POST", `/taxes/${tax.id}`);
    }
    if (r) log("✅", `Taxe payée (${tax.amount} OR)`);
    else log("❌", `Échec paiement`);
  }
}

// ─── Cell management ───────────────────────────────────
function storeCell(c) {
  const key = `${c.x},${c.y}`;
  cells.set(key, { x: c.x, y: c.y, type: c.type, zone: c.zone || cells.get(key)?.zone || 0 });
  if (c.zone && c.zone > maxZoneSeen) maxZoneSeen = c.zone;
}

function getZone(x, y) { return cells.get(`${x},${y}`)?.zone || 0; }
function isExplored(x, y) { return cells.has(`${x},${y}`); }

function isDangerous(x, y) {
  if (riskCells.has(`${x},${y}`)) return true;
  if (dangerNearby.has(`${x},${y}`)) return true;
  if (cells.get(`${x},${y}`)?.type === "ROCKS") return true;
  return false;
}

function markDanger(x, y) {
  riskCells.add(`${x},${y}`);
  for (let dx = -2; dx <= 2; dx++)
    for (let dy = -2; dy <= 2; dy++)
      dangerNearby.add(`${x + dx},${y + dy}`);
}

// ─── Checkpoints ───────────────────────────────────────
function distToCheckpoint(x, y) {
  let min = Infinity;
  for (const key of checkpoints) {
    const [cx, cy] = key.split(",").map(Number);
    min = Math.min(min, dist(x, y, cx, cy));
  }
  return min;
}

function nearestCheckpoint(x, y) {
  let best = null, minD = Infinity;
  for (const key of checkpoints) {
    const [cx, cy] = key.split(",").map(Number);
    const d = dist(x, y, cx, cy);
    if (d < minD) { minD = d; best = { x: cx, y: cy }; }
  }
  return best;
}

function canSafelyMove(nx, ny, currentEnergy) {
  const back = distToCheckpoint(nx, ny);
  if (back === Infinity) return currentEnergy > SAFETY;
  return (currentEnergy - 1) >= (back + SAFETY);
}

function shouldReturn() {
  if (!shipPos || energy === null) return true;
  return energy <= distToCheckpoint(shipPos.x, shipPos.y) + SAFETY;
}

// ─── Move ──────────────────────────────────────────────
async function move(direction) {
  prevEnergy = energy;
  const prevPos = shipPos ? { ...shipPos } : null;

  const d = await gameApi("POST", "/ship/move", { direction });
  if (!d) return null;

  if (d.discoveredCells) {
    d.discoveredCells.forEach(c => storeCell(c));
  }
  if (d.position) {
    storeCell(d.position);
    shipPos = { x: d.position.x, y: d.position.y };
  }
  energy = d.energy;

  // Checkpoint
  if (energy === MAX_ENERGY && shipPos) {
    const key = `${shipPos.x},${shipPos.y}`;
    if (!checkpoints.has(key)) {
      checkpoints.add(key);
      log("📌", `Checkpoint: (${shipPos.x},${shipPos.y}) — total: ${checkpoints.size}`);
    }
  }

  // Détection remorquage
  if (prevPos && shipPos && dist(prevPos.x, prevPos.y, shipPos.x, shipPos.y) > 3 && energy === MAX_ENERGY) {
    markDanger(prevPos.x, prevPos.y);
    log("🚨", `REMORQUAGE ! (${prevPos.x},${prevPos.y}) → dangereux`);
    await checkAndPayTaxes();
    return d;
  }

  // Perte énergie anormale
  if (prevEnergy !== null && energy !== null && energy !== MAX_ENERGY && energy < prevEnergy - 2) {
    markDanger(shipPos.x, shipPos.y);
    log("🐙", `INCIDENT (${shipPos.x},${shipPos.y}) — ${prevEnergy}→${energy}`);
    await checkAndPayTaxes();
  }

  return d;
}

// ─── Navigate ──────────────────────────────────────────
function bestDirToward(targetX, targetY) {
  if (!shipPos) return null;
  let best = null, bestScore = -Infinity;
  for (const [dir, { dx, dy }] of Object.entries(DIR_HINTS)) {
    const nx = shipPos.x + dx, ny = shipPos.y + dy;
    if (!canSafelyMove(nx, ny, energy)) continue;
    const d = -dist(nx, ny, targetX, targetY);
    const danger = isDangerous(nx, ny) ? -20 : 0;
    // Bonus pour cellules inexplorées en chemin
    let newCells = 0;
    for (let vx = -1; vx <= 1; vx++)
      for (let vy = -1; vy <= 1; vy++)
        if (!isExplored(nx + vx, ny + vy)) newCells++;
    const score = d + danger + newCells * 2;
    if (score > bestScore) { bestScore = score; best = dir; }
  }
  return best;
}

async function navigateTo(targetX, targetY, reason = "") {
  if (reason) log("🧭", `${reason} → (${targetX},${targetY})`);
  let stuck = 0, lastPos = null;

  while (dist(shipPos.x, shipPos.y, targetX, targetY) > 1) {
    if (shouldReturn()) return false;
    const dir = bestDirToward(targetX, targetY);
    if (!dir) return false;
    const d = await move(dir);
    if (!d) { await sleep(3000); continue; }
    if (lastPos && lastPos.x === shipPos.x && lastPos.y === shipPos.y) {
      stuck++; if (stuck > 5) return false;
    } else stuck = 0;
    lastPos = { ...shipPos };
    process.stdout.write(`\r  🧭 (${shipPos.x},${shipPos.y}) ⚡${energy} 🔙${distToCheckpoint(shipPos.x, shipPos.y)} z${getZone(shipPos.x, shipPos.y)}      `);
    await sleep(MOVE_DELAY);
  }
  console.log();
  return true;
}

async function returnToCheckpoint() {
  if (energy === MAX_ENERGY) return true;
  const cp = nearestCheckpoint(shipPos.x, shipPos.y);
  if (!cp) return false;
  return await navigateTo(cp.x, cp.y, "🏠 Retour checkpoint");
}

// ─── Find nearest unexplored cell reachable ────────────
function findNearestUnexplored() {
  if (!shipPos) return null;
  let best = null, bestDist = Infinity;

  // Scanner en cercles croissants
  for (let r = 1; r <= 50; r++) {
    if (best) break; // trouvé au rayon précédent
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const tx = shipPos.x + dx, ty = shipPos.y + dy;
        if (isExplored(tx, ty)) continue;

        const d = dist(shipPos.x, shipPos.y, tx, ty);
        const back = distToCheckpoint(tx, ty);
        if (d + back + SAFETY > energy) continue;

        // Priorité aux zones 3-4
        // Checker les voisins explorés pour deviner la zone
        let nearZone = 0;
        for (let vx = -2; vx <= 2; vx++) {
          for (let vy = -2; vy <= 2; vy++) {
            const z = getZone(tx + vx, ty + vy);
            if (z > nearZone) nearZone = z;
          }
        }
        const zoneBonus = TARGET_ZONES.includes(nearZone) ? -20 : 0;
        const score = d + zoneBonus;

        if (score < bestDist) { bestDist = score; best = { x: tx, y: ty, dist: d, zone: nearZone }; }
      }
    }
  }
  return best;
}

// ─── Init ──────────────────────────────────────────────
async function init() {
  console.log(`\n  🤖 3026 Explorer Bot — nearest unexplored`);
  console.log(`  📡 ${API} | ⏱ ${MOVE_DELAY}ms | 🛡 marge ${SAFETY}`);
  console.log(`  🎯 Priorité zones: ${TARGET_ZONES.join(",")}\n`);

  // Charger cellules
  try {
    const data = await (await fetch(`${DB}/cells`)).json();
    data.forEach(c => {
      cells.set(`${c.x},${c.y}`, { x: c.x, y: c.y, type: c.type, zone: c.zone || 0 });
      if (c.zone > maxZoneSeen) maxZoneSeen = c.zone;
    });
    log("📦", `${data.length} cellules, zone max: ${maxZoneSeen}`);
  } catch { log("⚠", "DB pas dispo"); }

  // Profil
  const player = await gameApi("GET", "/players/details");
  if (player) log("👤", `${player.name} | OR:${player.money} | Îles:${player.discoveredIslands?.length}`);

  // Taxes
  await checkAndPayTaxes();

  // Premier move
  log("🚢", "Position...");
  let d = await move("E");
  if (!d) {
    log("⚠", "Panne ? Attente 60s...");
    await sleep(60000);
    d = await move("E");
    if (!d) { log("❌", "Arrêt."); process.exit(1); }
  }

  if (energy === MAX_ENERGY) {
    checkpoints.add(`${shipPos.x},${shipPos.y}`);
    log("📌", `Checkpoint initial: (${shipPos.x},${shipPos.y})`);
  }

  if (checkpoints.size === 0) {
    checkpoints.add(`${shipPos.x},${shipPos.y}`);
    log("📌", "Fallback checkpoint");
  }

  log("📍", `(${shipPos.x},${shipPos.y}) ⚡${energy} z${getZone(shipPos.x, shipPos.y)} | cp:${checkpoints.size}`);
}

// ─── Main loop ─────────────────────────────────────────
async function run() {
  await init();
  log("🚀", "Go !\n");

  let totalDiscovered = 0;

  while (true) {
    if (energy === MAX_ENERGY && shipPos) checkpoints.add(`${shipPos.x},${shipPos.y}`);

    // Énergie faible → retour
    if (shouldReturn()) {
      await returnToCheckpoint();
      const d = await move("E");
      if (d) log("🔋", `⚡${energy}`);
      else { await sleep(5000); continue; }
      await checkAndPayTaxes();
      continue;
    }

    // Trouver la cellule inexplorée la plus proche
    const target = findNearestUnexplored();

    if (!target) {
      log("🎉", "Plus rien d'accessible à portée !");
      await returnToCheckpoint();
      const d = await move("E");
      if (d) log("🔋", `⚡${energy} — relance scan...`);
      await checkAndPayTaxes();
      await sleep(5000);
      continue;
    }

    // Aller vers la cible
    const dir = bestDirToward(target.x, target.y);
    if (!dir) {
      await returnToCheckpoint();
      const d = await move("E");
      continue;
    }

    const d = await move(dir);
    if (!d) { await sleep(3000); continue; }
    totalDiscovered++;

    const back = distToCheckpoint(shipPos.x, shipPos.y);
    const z = getZone(shipPos.x, shipPos.y);
    process.stdout.write(`\r  🔍 (${shipPos.x},${shipPos.y}) ⚡${energy} 🔙${back} z${z} → cible(${target.x},${target.y}) d:${target.dist} z~${target.zone} | cp:${checkpoints.size} ⚠${riskCells.size} 🗺${totalDiscovered}      `);

    await sleep(MOVE_DELAY);
  }
}

run().catch(e => { console.error("Fatal:", e); process.exit(1); });
