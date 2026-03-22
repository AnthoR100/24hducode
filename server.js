import express from "express";
import Database from "better-sqlite3";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

// Load .env
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach(line => {
    const [key, ...val] = line.split("=");
    if (key && val.length) process.env[key.trim()] = val.join("=").trim();
  });
}

const isProd = process.argv.includes("--prod");
const PORT = process.env.PORT || 4000;
const GAME_API = process.env.GAME_API || "http://ec2-15-237-116-133.eu-west-3.compute.amazonaws.com:8443";

// ─── Database ──────────────────────────────────────────
const db = new Database(join(__dirname, "3026.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS cells (
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    type TEXT NOT NULL,
    zone INTEGER,
    cell_id TEXT,
    discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (x, y)
  );
  CREATE TABLE IF NOT EXISTS ships_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    direction TEXT,
    energy INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS islands (
    name TEXT PRIMARY KEY,
    bonus_quotient INTEGER DEFAULT 0,
    state TEXT,
    discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_cells_type ON cells(type);
  CREATE INDEX IF NOT EXISTS idx_cells_zone ON cells(zone);
`);

// Migration: add validated column if missing
try { db.exec(`ALTER TABLE cells ADD COLUMN validated INTEGER DEFAULT 0`); } catch (e) { /* already exists */ }

const insertCell = db.prepare(`INSERT INTO cells (x, y, type, zone, cell_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT(x,y) DO UPDATE SET type=excluded.type, zone=excluded.zone, cell_id=COALESCE(excluded.cell_id, cells.cell_id)`);
const validateCells = db.prepare(`UPDATE cells SET validated = 1 WHERE x = ? AND y = ? AND type = 'SAND'`);
const insertShipLog = db.prepare(`INSERT INTO ships_log (x, y, direction, energy) VALUES (?, ?, ?, ?)`);
const insertIsland = db.prepare(`INSERT OR REPLACE INTO islands (name, bonus_quotient, state) VALUES (?, ?, ?)`);

const insertManyCells = db.transaction((cells) => {
  for (const c of cells) insertCell.run(c.x, c.y, c.type, c.zone, c.id || c.cell_id || null);
});

// ─── Express ───────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

if (isProd) {
  const distPath = join(__dirname, "dist");
  if (fs.existsSync(distPath)) app.use(express.static(distPath));
}

// ─── Config endpoint (serves .env token to frontend) ───
app.get("/config", (req, res) => {
  res.json({
    token: process.env.CODINGGAME_ID || "",
  });
});

// ─── DB endpoints ──────────────────────────────────────
app.get("/db/cells", (req, res) => {
  res.json(db.prepare("SELECT * FROM cells").all());
});

app.get("/db/stats", (req, res) => {
  const total = db.prepare("SELECT COUNT(*) as count FROM cells").get();
  const byType = db.prepare("SELECT type, COUNT(*) as count FROM cells GROUP BY type").all();
  const byZone = db.prepare("SELECT zone, COUNT(*) as count FROM cells GROUP BY zone ORDER BY zone").all();
  const totalMoves = db.prepare("SELECT COUNT(*) as count FROM ships_log").get();
  const islands = db.prepare("SELECT * FROM islands").all();
  const validatedSand = db.prepare("SELECT COUNT(*) as count FROM cells WHERE type='SAND' AND validated=1").get();
  const unseenSand = db.prepare("SELECT COUNT(*) as count FROM cells WHERE type='SAND' AND validated=0").get();
  res.json({
    totalCells: total.count,
    byType: Object.fromEntries(byType.map(r => [r.type, r.count])),
    byZone,
    totalMoves: totalMoves.count,
    islands,
    validatedSand: validatedSand.count,
    unseenSand: unseenSand.count,
  });
});

app.get("/db/history", (req, res) => {
  const limit = parseInt(req.query.limit) || 200;
  res.json(db.prepare("SELECT * FROM ships_log ORDER BY id DESC LIMIT ?").all(limit).reverse());
});

app.post("/db/islands", (req, res) => {
  const { islands } = req.body;
  if (!islands) return res.status(400).json({ error: "missing islands" });
  db.transaction(() => { for (const d of islands) insertIsland.run(d.island.name, d.island.bonusQuotient, d.islandState); })();
  res.json({ ok: true, count: islands.length });
});

app.post("/db/validate", (req, res) => {
  const { cells: cellsToValidate } = req.body;
  if (!cellsToValidate || !Array.isArray(cellsToValidate)) return res.status(400).json({ error: "missing cells array" });
  db.transaction(() => { for (const c of cellsToValidate) validateCells.run(c.x, c.y); })();
  res.json({ ok: true, validated: cellsToValidate.length });
});

// ─── Import: accept raw logs or cell arrays ────────────
app.post("/db/import", (req, res) => {
  const { cells: rawCells, logs } = req.body;
  let imported = 0;

  // Direct cell array: [{x, y, type, zone, id?}, ...]
  if (rawCells && Array.isArray(rawCells)) {
    insertManyCells(rawCells);
    imported = rawCells.length;
  }

  // Logs: array of ship/move responses [{discoveredCells:[...], position:{...}, energy:N}, ...]
  if (logs && Array.isArray(logs)) {
    const allCells = [];
    for (const log of logs) {
      if (log.discoveredCells) allCells.push(...log.discoveredCells);
      if (log.position) allCells.push(log.position);
    }
    if (allCells.length > 0) {
      insertManyCells(allCells);
      imported += allCells.length;
    }
  }

  // Raw text log parsing
  if (req.body.raw && typeof req.body.raw === "string") {
    try {
      const raw = req.body.raw;
      const cells = [];

      // Format 1: "x,y": "TYPE" (custom log format)
      const coordRegex = /"(-?\d+),(-?\d+)"\s*:\s*"(SEA|SAND|ROCKS)"/g;
      let match;
      while ((match = coordRegex.exec(raw)) !== null) {
        cells.push({ x: parseInt(match[1]), y: parseInt(match[2]), type: match[3], zone: 0, id: null });
      }

      // Format 2: JSON objects with x, y, type, zone fields
      if (cells.length === 0) {
        const cellRegex = /\{[^{}]*"x"\s*:\s*(-?\d+)[^{}]*"y"\s*:\s*(-?\d+)[^{}]*"type"\s*:\s*"(SEA|SAND|ROCKS)"[^{}]*"zone"\s*:\s*(\d+)[^{}]*\}/g;
        while ((match = cellRegex.exec(raw)) !== null) {
          cells.push({ x: parseInt(match[1]), y: parseInt(match[2]), type: match[3], zone: parseInt(match[4]), id: null });
        }
      }

      if (cells.length > 0) {
        insertManyCells(cells);
        imported += cells.length;
      }
    } catch (e) {
      console.error("Raw parse error:", e.message);
    }
  }

  const total = db.prepare("SELECT COUNT(*) as c FROM cells").get().c;
  res.json({ ok: true, imported, totalInDb: total });
});

// ─── Proxy all game API calls ──────────────────────────
app.all("/game/*", async (req, res) => {
  const gamePath = req.params[0];
  const queryString = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
  const url = `${GAME_API}/${gamePath}${queryString}`;

  try {
    const headers = {};
    const passHeaders = ["codinggame-id", "codinggame-signupcode"];
    passHeaders.forEach(h => { if (req.headers[h]) headers[h] = req.headers[h]; });
    // Fallback to .env token
    if (!headers["codinggame-id"] && process.env.CODINGGAME_ID) {
      headers["codinggame-id"] = process.env.CODINGGAME_ID;
    }

    const fetchOpts = { method: req.method, headers };

    // Only set Content-Type and body for methods that have a body
    if (!["GET", "HEAD", "DELETE"].includes(req.method)) {
      headers["Content-Type"] = "application/json";
      if (req.body && Object.keys(req.body).length > 0) {
        fetchOpts.body = JSON.stringify(req.body);
      }
    }

    console.log(`→ ${req.method} ${url}${fetchOpts.body ? ` body=${fetchOpts.body}` : ""}`);
    const gameRes = await fetch(url, fetchOpts);

    // Handle empty responses (204 No Content etc.)
    const ct = gameRes.headers.get("content-type") || "";
    const text = await gameRes.text();

    let data;
    if (!text || text.trim() === "") {
      data = { ok: true };
    } else if (ct.includes("json") || text.trim().startsWith("{") || text.trim().startsWith("[")) {
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
    } else {
      data = { raw: text };
    }

    console.log(`← ${gameRes.status} ${gamePath}${gameRes.ok ? "" : " ⚠ " + text.slice(0, 200)}`);

    // Auto-persist cells from ship/move
    if (gamePath === "ship/move" && gameRes.ok && data) {
      try {
        const toSave = [];
        if (data.discoveredCells) toSave.push(...data.discoveredCells);
        if (data.position) toSave.push(data.position);
        if (toSave.length > 0) insertManyCells(toSave);
        if (data.position) insertShipLog.run(data.position.x, data.position.y, req.body?.direction || null, data.energy ?? null);
      } catch (e) { console.error("DB save:", e.message); }
    }

    res.status(gameRes.status).json(data);
  } catch (err) {
    console.error(`✗ Proxy [${req.method} ${url}]:`, err.message);
    res.status(502).json({ error: "Proxy error", message: err.message });
  }
});

if (isProd) app.get("*", (req, res) => res.sendFile(join(__dirname, "dist", "index.html")));

app.listen(PORT, () => {
  const c = db.prepare("SELECT COUNT(*) as c FROM cells").get().c;
  console.log(`\n  ⚓ 3026 Dashboard — http://localhost:${PORT}`);
  console.log(`  📦 ${c} cellules en base | 🎮 Proxy → ${GAME_API}\n`);
});
