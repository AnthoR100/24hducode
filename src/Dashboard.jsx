import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Ekod from "./assets/images/ekod.png";

// Musique
import musique1 from "./assets/audio/One_Piece_-_4th_Opening_-_Bon_Voyage.mp3";
import musique2 from "./assets/audio/One_Piece_-_Abertura_18_legendada.mp3";
import musique3 from "./assets/audio/One_Piece_-_OP_11_1080p_HD.mp3";
import musique4 from "./assets/audio/One_Piece_-_Opening_1_-_We_Are_Vostfr_Romaji.mp3";
import musique5 from "./assets/audio/One_Piece_OP8.mp3";
import musique6 from "./assets/audio/One_Piece_OP_3_-_To_the_Light_Japanese_HD.mp3";
import musique7 from "./assets/audio/One_Piece_OP_6_-_BRAND_NEW_WORLD_720p_HD.mp3";
import musique8 from "./assets/audio/One_Piece_OP_13_-_One_Day_4K-24FPS_Creditless.mp3";
import musique9 from "./assets/audio/One_Piece_OP_17_-_Wake_up_4K-24FPS_Creditless.mp3";
import musique10 from "./assets/audio/ONE_PIECE_OP_19_-_WE_CAN.mp3";
import musique11 from "./assets/audio/One_Piece_Opening_2.mp3";
import musique12 from "./assets/audio/One_Piece_opening_5_HD_1080p.mp3";
import musique13 from "./assets/audio/One_Piece_opening_7_HD_1080p.mp3";
import musique14 from "./assets/audio/One_piece_opening_9_Jungle_P.mp3";
import musique15 from "./assets/audio/One_Piece_Opening_10_We_Are_CreditlessHD.mp3";
import musique16 from "./assets/audio/One_Piece_opening_12_HD_1080p.mp3";
import musique17 from "./assets/audio/One_Piece_Opening_14_HD_1080p.mp3";
import musique18 from "./assets/audio/One_Piece_Opening_15_WE_GO_HD.mp3";
import musique19 from "./assets/audio/One_Piece_Opening_20_Hope_by_Namie_Amuro.mp3";
import musique20 from "./assets/audio/One_Piece_Opening_21_Super_Powers_by_V6.mp3";

const API = "/game";
const DB = "/db";
const CELL_SIZE = 28;
const COLORS = { SEA: "#0a1628", SAND: "#e8c872", ROCKS: "#5a5a6e", UNKNOWN: "#060d18", GRID: "rgba(40,80,120,0.15)" };
const DIRS = [
  { dir: "NW", label: "↖", r: 0, c: 0 }, { dir: "N", label: "↑", r: 0, c: 1 }, { dir: "NE", label: "↗", r: 0, c: 2 },
  { dir: "W", label: "←", r: 1, c: 0 }, { dir: null, label: "⚓", r: 1, c: 1 }, { dir: "E", label: "→", r: 1, c: 2 },
  { dir: "SW", label: "↙", r: 2, c: 0 }, { dir: "S", label: "↓", r: 2, c: 1 }, { dir: "SE", label: "↘", r: 2, c: 2 },
];

// Playlist
const playlist = [
  { title: "Opening 1", src: musique1 },
  { title: "Opening 2", src: musique2 },
  { title: "Opening 3", src: musique3 },
  { title: "Opening 4", src: musique4 },
  { title: "Opening 5", src: musique5 },
  { title: "Opening 6", src: musique6 },
  { title: "Opening 7", src: musique7},
  { title: "Opening 8", src: musique8 },
  { title: "Opening 9", src: musique9 },
  { title: "Opening 10", src: musique10 },
  { title: "Opening 11", src: musique11 },
  { title: "Opening 12", src: musique12},
  { title: "Opening 13", src: musique13 },
  { title: "Opening 14", src: musique14},
  { title: "Opening 15", src: musique15 },
  { title: "Opening 16", src: musique16 },
  { title: "Opening 17", src: musique17 },
  { title: "Opening 18", src: musique18 },
  { title: "Opening 19", src: musique19 },
  { title: "Opening 20", src: musique20 },

];

// ─── Timer hook ────────────────────────────────────────
function useTimer() {
  const [lastMove, setLastMove] = useState(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(i); }, []);
  const elapsed = lastMove ? Math.floor((now - lastMove) / 1000) : null;
  return { elapsed, setLastMove };
}

export default function Dashboard() {
  const [token, setToken] = useState(() => localStorage.getItem("3026-token") || "");
  const [tokenInput, setTokenInput] = useState(() => localStorage.getItem("3026-token") || "");

  // Auto-load token from .env via server
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/config");
        const data = await res.json();
        if (data.token && !token) {
          setToken(data.token);
          setTokenInput(data.token);
          localStorage.setItem("3026-token", data.token);
          addLog("🔑 Token chargé depuis .env", "success");
        }
      } catch {}
    })();
  }, []);
  const [cells, setCells] = useState(new Map());
  const [shipPos, setShipPos] = useState(null);
  const [energy, setEnergy] = useState(null);
  const [playerInfo, setPlayerInfo] = useState(null);
  const [dbStats, setDbStats] = useState(null);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [cameraStart, setCameraStart] = useState(null);
  const [autoCenter, setAutoCenter] = useState(true);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [rightTab, setRightTab] = useState("log");
  // Feature states
  const [taxes, setTaxes] = useState([]);
  const [nextShip, setNextShip] = useState(null);
  const [nextStorage, setNextStorage] = useState(null);
  const [offers, setOffers] = useState([]);
  const [thefts, setThefts] = useState([]);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState(null);
  // Offer form
  const [offerForm, setOfferForm] = useState({ resourceType: "BOISIUM", quantityIn: 100, pricePerResource: 1 });
  // Purchase form
  const [purchaseForm, setPurchaseForm] = useState({ offerId: "", quantity: 100 });
  // Theft form
  const [theftForm, setTheftForm] = useState({ resourceType: "BOISIUM", moneySpent: 300 });
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [autoPath, setAutoPath] = useState([]);
  const [isAutoMoving, setIsAutoMoving] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const autoMoveIntervalRef = useRef(null);
  const autoPathRef = useRef([]);
  const isAutoMovingRef = useRef(false);
  const { elapsed, setLastMove } = useTimer();
  const mapRef = useRef(null);
  const logRef = useRef(null);
  const audioRef = useRef(null);

  const addLog = useCallback((msg, type = "info") => {
    const time = new Date().toLocaleTimeString("fr-FR");
    setLog(p => [...p.slice(-300), { msg, type, time }]);
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

  // ─── API helpers ─────────────────────────────────────
  const api = useCallback(async (method, path, body = null) => {
    if (!token) { setError("Token manquant"); return null; }
    setLoading(true); setError(null);
    try {
      const opts = { method, headers: { "codinggame-id": token } };
      if (body) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
      const res = await fetch(`${API}${path}`, opts);
      if (res.status === 204) { setLoading(false); return { ok: true }; }
      const data = await res.json();
      if (!res.ok) { const m = data.message || data.codeError || `Erreur ${res.status}`; setError(m); addLog(`❌ ${path}: ${m}`, "error"); setLoading(false); return null; }
      return data;
    } catch (e) { setError(`Réseau: ${e.message}`); addLog(`❌ ${e.message}`, "error"); return null; }
    finally { setLoading(false); }
  }, [token, addLog]);

  // ─── DB helpers ──────────────────────────────────────
  const loadCellsFromDB = useCallback(async () => {
    try {
      const data = await (await fetch(`${DB}/cells`)).json();
      setCells(prev => {
        const next = new Map(prev);
        data.forEach(c => next.set(`${c.x},${c.y}`, { x: c.x, y: c.y, type: c.type, zone: c.zone, id: c.cell_id, ships: [] }));
        return next;
      });
      return data.length;
    } catch { return 0; }
  }, []);

  const loadDbStats = useCallback(async () => {
    try { setDbStats(await (await fetch(`${DB}/stats`)).json()); } catch {}
  }, []);

  useEffect(() => {
    (async () => { const n = await loadCellsFromDB(); await loadDbStats(); addLog(`🗄️ ${n} cellules chargées depuis la DB`, "success"); })();
  }, [loadCellsFromDB, loadDbStats, addLog]);

  useEffect(() => {
    if (!autoRefresh) return;
    const i = setInterval(async () => { await loadCellsFromDB(); await loadDbStats(); }, 10000);
    return () => clearInterval(i);
  }, [autoRefresh, loadCellsFromDB, loadDbStats]);

  // ─── Game actions ────────────────────────────────────
  const processDiscoveredCells = useCallback((disc, pos) => {
    setCells(prev => {
      const next = new Map(prev);
      if (disc) disc.forEach(c => next.set(`${c.x},${c.y}`, { x: c.x, y: c.y, type: c.type, zone: c.zone, id: c.id, ships: c.ships || [] }));
      if (pos) next.set(`${pos.x},${pos.y}`, { x: pos.x, y: pos.y, type: pos.type, zone: pos.zone, id: pos.id, ships: pos.ships || [] });
      return next;
    });
  }, []);

  const loadPlayerDetails = useCallback(async () => {
    const d = await api("GET", "/players/details");
    if (d) {
      setPlayerInfo(d);
      addLog(`📋 ${d.name} | OR:${d.money} | Îles:${d.discoveredIslands?.length || 0}`, "success");
      if (d.discoveredIslands?.length) {
        try { await fetch(`${DB}/islands`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ islands: d.discoveredIslands }) }); } catch {}
      }
    }
  }, [api, addLog]);

  const moveShip = useCallback(async (direction) => {
    if (loading) return null;

    const d = await api("POST", "/ship/move", { direction });

    if (d) {
      setLastMove(Date.now());
      processDiscoveredCells(d.discoveredCells, d.position);

      if (d.position) {
        setShipPos({ x: d.position.x, y: d.position.y });
        if (autoCenter) setCamera({ x: d.position.x, y: d.position.y });
      }

      setEnergy(d.energy);

      const sand = (d.discoveredCells || []).filter(c => c.type === "SAND");
      const ships = (d.discoveredCells || []).filter(c => c.ships?.length).flatMap(c => c.ships);

      let msg = `⛵ ${direction} → (${d.position?.x},${d.position?.y}) ⚡${d.energy}`;
      if (sand.length) msg += ` | 🏝 ÎLE: ${sand.map(c => `(${c.x},${c.y})`).join(" ")}`;
      if (ships.length) msg += ` | 🚢 ${ships.map(s => s.playerName || "?").join(",")}`;

      addLog(msg, sand.length ? "island" : "success");
      loadDbStats();

      return d;
    }

    return null;
  }, [api, processDiscoveredCells, addLog, autoCenter, loading, loadDbStats, setLastMove]);

  const DIR_VECTORS = useMemo(() => ([
    { dir: "NW", dx: -1, dy: -1 },
    { dir: "N", dx: 0, dy: -1 },
    { dir: "NE", dx: 1, dy: -1 },
    { dir: "W", dx: -1, dy: 0 },
    { dir: "E", dx: 1, dy: 0 },
    { dir: "SW", dx: -1, dy: 1 },
    { dir: "S", dx: 0, dy: 1 },
    { dir: "SE", dx: 1, dy: 1 },
  ]), []);

  const getCellKey = (x, y) => `${x},${y}`;

  const isWalkableCell = useCallback((cell) => {
    if (!cell) return false;
    return cell.type !== "ROCKS";
  }, []);

  const heuristic = useCallback((a, b) => {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return Math.max(dx, dy);
  }, []);

  const reconstructPath = useCallback((cameFrom, currentKey) => {
    const totalPath = [];
    let key = currentKey;

    while (cameFrom.has(key)) {
      const step = cameFrom.get(key);
      totalPath.unshift(step.dir);
      key = step.prevKey;
    }

    return totalPath;
  }, []);

  const findBestPath = useCallback((start, target) => {
    if (!start || !target) return null;
    if (start.x === target.x && start.y === target.y) return [];

    const startKey = getCellKey(start.x, start.y);
    const targetKey = getCellKey(target.x, target.y);

    const targetCell = cells.get(targetKey);
    if (!targetCell || !isWalkableCell(targetCell)) return null;

    const openSet = new Set([startKey]);
    const cameFrom = new Map();

    const gScore = new Map();
    gScore.set(startKey, 0);

    const fScore = new Map();
    fScore.set(startKey, heuristic(start, target));

    while (openSet.size > 0) {
      let currentKey = null;
      let bestF = Infinity;

      for (const key of openSet) {
        const score = fScore.get(key) ?? Infinity;
        if (score < bestF) {
          bestF = score;
          currentKey = key;
        }
      }

      if (!currentKey) break;

      if (currentKey === targetKey) {
        return reconstructPath(cameFrom, currentKey);
      }

      openSet.delete(currentKey);

      const [cx, cy] = currentKey.split(",").map(Number);

      for (const { dir, dx, dy } of DIR_VECTORS) {
        const nx = cx + dx;
        const ny = cy + dy;
        const neighborKey = getCellKey(nx, ny);
        const neighborCell = cells.get(neighborKey);

        if (!neighborCell || !isWalkableCell(neighborCell)) continue;

        const tentativeG = (gScore.get(currentKey) ?? Infinity) + 1;

        if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
          cameFrom.set(neighborKey, { prevKey: currentKey, dir });
          gScore.set(neighborKey, tentativeG);
          fScore.set(
              neighborKey,
              tentativeG + heuristic({ x: nx, y: ny }, target)
          );
          openSet.add(neighborKey);
        }
      }
    }

    return null;
  }, [cells, DIR_VECTORS, heuristic, isWalkableCell, reconstructPath]);

  const stopAutoMove = useCallback((reason = null) => {
    if (autoMoveIntervalRef.current) {
      clearInterval(autoMoveIntervalRef.current);
      autoMoveIntervalRef.current = null;
    }

    autoPathRef.current = [];
    isAutoMovingRef.current = false;
    setAutoPath([]);
    setIsAutoMoving(false);

    if (reason) addLog(reason, "info");
  }, [addLog]);

  const startAutoMoveToCell = useCallback((targetCell) => {
    if (!shipPos) {
      addLog("❌ Position du bateau inconnue", "error");
      return;
    }

    const path = findBestPath(shipPos, targetCell);

    if (!path) {
      addLog(`❌ Aucun chemin vers (${targetCell.x},${targetCell.y})`, "error");
      setSelectedTarget(null);
      return;
    }

    if (path.length === 0) {
      addLog("ℹ️ Tu es déjà sur cette case", "info");
      setSelectedTarget(targetCell);
      return;
    }

    stopAutoMove();

    setSelectedTarget(targetCell);
    setAutoPath(path);
    autoPathRef.current = [...path];
    setIsAutoMoving(true);
    isAutoMovingRef.current = true;

    addLog(
        `🎯 Trajet calculé vers (${targetCell.x},${targetCell.y}) | ${path.length} étape(s)`,
        "success"
    );
  }, [shipPos, findBestPath, stopAutoMove, addLog]);

  // ─── Taxes ───────────────────────────────────────────
  const loadTaxes = useCallback(async () => {
    const d = await api("GET", "/taxes");
    if (d) { setTaxes(d); addLog(`💸 ${d.length} taxes chargées`, "success"); }
  }, [api, addLog]);

  const payTax = useCallback(async (taxId) => {
    const d = await api("PUT", `/taxes/${taxId}`);
    if (d) { addLog(`✅ Taxe ${taxId.slice(0,8)} payée`, "success"); loadTaxes(); loadPlayerDetails(); }
  }, [api, addLog, loadTaxes, loadPlayerDetails]);

  // ─── Ship upgrade ────────────────────────────────────
  const loadNextShip = useCallback(async () => {
    const d = await api("GET", "/ship/next-level");
    if (d) { setNextShip(d); addLog("🚢 Prochain niveau chargé", "success"); }
  }, [api, addLog]);

  const upgradeShip = useCallback(async (level) => {
    const d = await api("PUT", "/ship/upgrade", { level });
    if (d) { addLog(`🚢 Bateau amélioré !`, "success"); loadNextShip(); loadPlayerDetails(); }
  }, [api, addLog, loadNextShip, loadPlayerDetails]);

  // ─── Storage upgrade ─────────────────────────────────
  const loadNextStorage = useCallback(async () => {
    const d = await api("GET", "/storage/next-level");
    if (d) { setNextStorage(d); addLog("📦 Prochain entrepôt chargé", "success"); }
  }, [api, addLog]);

  const upgradeStorage = useCallback(async () => {
    const d = await api("PUT", "/storage/upgrade");
    if (d) { addLog(`📦 Entrepôt amélioré: ${d.name}`, "success"); loadNextStorage(); loadPlayerDetails(); }
  }, [api, addLog, loadNextStorage, loadPlayerDetails]);

  // ─── Marketplace ─────────────────────────────────────
  const loadOffers = useCallback(async (silent = false) => {
    const d = await api("GET", "/marketplace/offers");
    if (d) { setOffers(d); if (!silent) addLog(`🏪 ${d.length} offres`, "success"); }
  }, [api, addLog]);

  const createOffer = useCallback(async () => {
    const d = await api("POST", "/marketplace/offers", offerForm);
    if (d) { addLog(`📤 Offre créée: ${d.quantityIn} ${d.resourceType}`, "success"); loadOffers(); loadPlayerDetails(); }
  }, [api, addLog, offerForm, loadOffers, loadPlayerDetails]);

  const buyOffer = useCallback(async () => {
    const d = await api("POST", "/marketplace/purchases", purchaseForm);
    if (d) { addLog(`📥 Achat OK: ${d.quantity} unités`, "success"); loadOffers(); loadPlayerDetails(); }
  }, [api, addLog, purchaseForm, loadOffers, loadPlayerDetails]);

  const deleteOffer = useCallback(async (id) => {
    const d = await api("DELETE", `/marketplace/offers/${id}`);
    if (d) { addLog(`🗑️ Offre supprimée`, "success"); loadOffers(); }
  }, [api, addLog, loadOffers]);

  // ─── Thefts ──────────────────────────────────────────
  const loadThefts = useCallback(async () => {
    const d = await api("GET", "/thefts");
    if (d) { setThefts(d); addLog(`🏴‍☠️ ${d.length} vols`, "success"); }
  }, [api, addLog]);

  // Auto-refresh marketplace when tab is active
  useEffect(() => {
    if (rightTab !== "market" || !token) return;
    loadOffers();
    const interval = setInterval(() => { loadOffers(true); }, 15000);
    return () => clearInterval(interval);
  }, [rightTab, token]);

  const launchTheft = useCallback(async () => {
    const d = await api("POST", "/thefts/player", theftForm);
    if (d) { addLog(`🏴‍☠️ Vol lancé: ${d.resourceType} | Chance: ${d.chance}`, "success"); loadThefts(); loadPlayerDetails(); }
  }, [api, addLog, theftForm, loadThefts, loadPlayerDetails]);

  // ─── Import ──────────────────────────────────────────
  const doImport = useCallback(async () => {
    setImportResult(null);
    try {
      let body;
      const trimmed = importText.trim();
      if (trimmed.startsWith("[")) {
        const parsed = JSON.parse(trimmed);
        if (parsed[0]?.discoveredCells) body = { logs: parsed };
        else body = { cells: parsed };
      } else if (trimmed.startsWith("{")) {
        const parsed = JSON.parse(trimmed);
        if (parsed.discoveredCells) body = { logs: [parsed] };
        else body = { cells: [parsed] };
      } else {
        body = { raw: trimmed };
      }
      const res = await fetch(`${DB}/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      setImportResult(data);
      addLog(`📥 Import: ${data.imported} cellules (total DB: ${data.totalInDb})`, "success");
      loadCellsFromDB(); loadDbStats();
    } catch (e) {
      setImportResult({ error: e.message });
      addLog(`❌ Import: ${e.message}`, "error");
    }
  }, [importText, addLog, loadCellsFromDB, loadDbStats]);

  // ─── Keyboard ────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const m = { ArrowUp: "N", ArrowDown: "S", ArrowLeft: "W", ArrowRight: "E", z: "N", q: "W", s: "S", d: "E", a: "NW", e: "NE", w: "SW", c: "SE" };
      if (m[e.key]) {
        e.preventDefault();
        stopAutoMove("⛔ Trajet auto annulé (commande manuelle)");
        moveShip(m[e.key]);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [moveShip, stopAutoMove]);

  useEffect(() => {
    if (!isAutoMoving || !token) return;

    if (autoMoveIntervalRef.current) {
      clearInterval(autoMoveIntervalRef.current);
    }

    autoMoveIntervalRef.current = setInterval(async () => {
      if (loading) return;

      const nextDir = autoPathRef.current[0];

      if (!nextDir) {
        stopAutoMove("✅ Destination atteinte");
        return;
      }

      const result = await moveShip(nextDir);

      if (!result) {
        stopAutoMove("❌ Déplacement automatique interrompu");
        return;
      }

      autoPathRef.current = autoPathRef.current.slice(1);
      setAutoPath([...autoPathRef.current]);

      if (autoPathRef.current.length === 0) {
        stopAutoMove("✅ Destination atteinte");
      }
    }, 1000);

    return () => {
      if (autoMoveIntervalRef.current) {
        clearInterval(autoMoveIntervalRef.current);
        autoMoveIntervalRef.current = null;
      }
    };
  }, [isAutoMoving, token, loading, moveShip, stopAutoMove]);

  // ─── Map ─────────────────────────────────────────────
  const cellsArray = useMemo(() => Array.from(cells.values()), [cells]);
  const handleMapMouseDown = (e) => { if (e.button !== 0) return; setIsDragging(true); setDragStart({ x: e.clientX, y: e.clientY }); setCameraStart({ ...camera }); };
  const handleMapMouseMove = (e) => { if (!isDragging || !dragStart || !cameraStart) return; setCamera({ x: cameraStart.x - (e.clientX - dragStart.x) / (CELL_SIZE * zoom), y: cameraStart.y - (e.clientY - dragStart.y) / (CELL_SIZE * zoom) }); setAutoCenter(false); };
  const handleMapMouseUp = () => { setIsDragging(false); setDragStart(null); setCameraStart(null); };
  const handleWheel = (e) => { e.preventDefault(); setZoom(z => Math.max(0.15, Math.min(5, z + (e.deltaY > 0 ? -0.15 : 0.15)))); };

  const stats = useMemo(() => {
    let sea = 0, sand = 0, rocks = 0; const zones = new Set();
    cellsArray.forEach(c => { if (c.type === "SEA") sea++; else if (c.type === "SAND") sand++; else if (c.type === "ROCKS") rocks++; zones.add(c.zone); });
    return { total: cellsArray.length, sea, sand, rocks, zones: zones.size };
  }, [cellsArray]);

  const renderMap = () => {
    if (!mapRef.current) return null;
    const rect = mapRef.current.getBoundingClientRect();
    const w = rect.width, h = rect.height, cs = CELL_SIZE * zoom, cx = w / 2, cy = h / 2;
    return cellsArray.map(cell => {
      const px = cx + (cell.x - camera.x) * cs;
      const py = cy + (cell.y - camera.y) * cs;
      if (px < -cs * 2 || px > w + cs * 2 || py < -cs * 2 || py > h + cs * 2) return null;
      const isShip = shipPos && cell.x === shipPos.x && cell.y === shipPos.y;
      const hasShips = cell.ships?.length > 0;
      const isTarget = selectedTarget && cell.x === selectedTarget.x && cell.y === selectedTarget.y;
      const isKnownIsland = cell.type === "SAND" && cell.islandState === "KNOWN";
      return (
        <div key={`${cell.x},${cell.y}`}
             onMouseEnter={() => setHoveredCell(cell)}
             onMouseLeave={() => setHoveredCell(null)}
             onClick={() => startAutoMoveToCell(cell)}
          style={{
            position: "absolute", left: px - cs / 2, top: py - cs / 2, width: cs - 1, height: cs - 1,
            backgroundColor: COLORS[cell.type] || COLORS.SEA, border: `1px solid ${COLORS.GRID}`,
            borderRadius: cell.type === "SAND" ? 3 : 0, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: cs * 0.45, zIndex: isShip ? 10 : 1,
            boxShadow: isShip
                ? "0 0 14px rgba(255,68,68,0.7)"
                : isTarget
                    ? "0 0 0 2px rgba(78,205,196,0.9), 0 0 18px rgba(78,205,196,0.5)"
                    : cell.type === "SAND"
                        ? "inset 0 0 10px rgba(232,200,114,0.3)"
                        : "none",
            cursor: "pointer",
          }}
        >{isShip ? (
            "🚢"
        ) : hasShips ? (
            "⛵"
        ) : cell.type === "SAND" && cs > 14 ? (
            isKnownIsland ? (
                <img
                    src={Ekod}
                    alt="île EKOD"
                    style={{ width: cs * 0.6, height: cs * 0.6, objectFit: "contain" }}
                />
            ) : (
                "🏝"
            )
        ) : (
            ""
        )}</div>
      );
    });
  };

  useEffect(() => {
    const audio = new Audio(playlist[currentTrackIndex].src);
    audioRef.current = audio;
    audio.volume = 0.5;

    const handleEnded = () => {
      setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
    };

    audio.addEventListener("ended", handleEnded);

    if (isPlaying) {
      audio.play().catch((err) => {
        console.error("Lecture impossible :", err);
      });
    }

    return () => {
      audio.pause();
      audio.removeEventListener("ended", handleEnded);
    };
  }, [currentTrackIndex]);

  const playMusic = async () => {
    try {
      await audioRef.current?.play();
      setIsPlaying(true);
    } catch (err) {
      console.error("Erreur play :", err);
    }
  };

  const pauseMusic = () => {
    audioRef.current?.pause();
  };

  const nextMusic = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
  };

  // ─── Right panel tabs ────────────────────────────────
  const tabs = [
    { id: "log", label: "📜 Log" },
    { id: "taxes", label: "💸 Taxes" },
    { id: "ship", label: "🚢 Bateau" },
    { id: "storage", label: "📦 Entrepôt" },
    { id: "market", label: "🏪 Marché" },
    { id: "thefts", label: "🏴‍☠️ Vols" },
    { id: "import", label: "📥 Import" },
  ];

  const renderRightPanel = () => {
    switch (rightTab) {
      case "log":
        return (
          <div ref={logRef} style={{ flex: 1, overflowY: "auto", padding: 10, fontSize: 10, lineHeight: 1.7 }}>
            {log.length === 0 && <div style={{ color: "#3a5a7a", textAlign: "center", marginTop: 30 }}>En attente...</div>}
            {log.map((e, i) => (
              <div key={i} style={{
                padding: "4px 8px", marginBottom: 2, borderRadius: 4, wordBreak: "break-word",
                background: e.type === "error" ? "rgba(255,68,68,0.08)" : e.type === "island" ? "rgba(232,200,114,0.1)" : "transparent",
                color: e.type === "error" ? "#ff8888" : e.type === "island" ? "#e8c872" : e.type === "success" ? "#8ab8a8" : "#5a6a7a",
                borderLeft: `3px solid ${e.type === "island" ? "#e8c872" : e.type === "error" ? "#ff4444" : "transparent"}`,
              }}><span style={{ color: "#2a4a5a", marginRight: 6 }}>{e.time}</span>{e.msg}</div>
            ))}
          </div>
        );

      case "taxes":
        return (
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            <button onClick={loadTaxes} style={actionBtn}>🔄 Charger les taxes</button>
            {taxes.length === 0 && <div style={emptyMsg}>Aucune taxe</div>}
            {taxes.map(t => (
              <div key={t.id} style={{ ...card, borderLeft: `3px solid ${t.state === "DUE" ? "#ff4444" : "#4ecdc4"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <b>{t.type}</b>
                  <span style={{ color: t.state === "DUE" ? "#ff4444" : "#4ecdc4" }}>{t.state}</span>
                </div>
                <div style={{ fontSize: 11, marginTop: 4 }}>💰 {t.amount} OR | ⏱ {t.remainingTime}s</div>
                {t.state === "DUE" && (
                  <button onClick={() => payTax(t.id)} style={{ ...actionBtn, marginTop: 6, background: "rgba(255,68,68,0.2)", color: "#ff8888" }}>
                    Payer cette taxe
                  </button>
                )}
              </div>
            ))}
          </div>
        );

      case "ship":
        return (
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            <button onClick={loadNextShip} style={actionBtn}>🔄 Voir prochain niveau</button>
            {nextShip ? (
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                  Niveau {nextShip.level?.id} — {nextShip.level?.name}
                </div>
                <div style={{ fontSize: 11, lineHeight: 2 }}>
                  <div>👁 Visibilité: {nextShip.level?.visibilityRange}</div>
                  <div>🏃 Mouvement max: {nextShip.level?.maxMovement}</div>
                  <div>⚡ Vitesse: {nextShip.level?.speed}</div>
                </div>
                {nextShip.costResources && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, color: "#5a7a9a", marginBottom: 4 }}>Coût:</div>
                    {Object.entries(nextShip.costResources).map(([k, v]) => (
                      <div key={k} style={{ fontSize: 11 }}>• {k}: {v}</div>
                    ))}
                  </div>
                )}
                <button onClick={() => upgradeShip(nextShip.level?.id)} style={{ ...actionBtn, marginTop: 10, background: "rgba(78,205,196,0.2)" }}>
                  ⬆️ Améliorer le bateau
                </button>
              </div>
            ) : <div style={emptyMsg}>Clique pour voir le prochain niveau</div>}
          </div>
        );

      case "storage":
        return (
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            <button onClick={loadNextStorage} style={actionBtn}>🔄 Voir prochain niveau</button>
            {nextStorage ? (
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                  Nv.{nextStorage.id} — {nextStorage.name}
                </div>
                {nextStorage.maxResources && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 10, color: "#5a7a9a", marginBottom: 4 }}>Capacité max:</div>
                    {Object.entries(nextStorage.maxResources).map(([k, v]) => (
                      <div key={k} style={{ fontSize: 11 }}>• {k}: {v}</div>
                    ))}
                  </div>
                )}
                {nextStorage.costResources && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, color: "#5a7a9a", marginBottom: 4 }}>Coût:</div>
                    {Object.entries(nextStorage.costResources).map(([k, v]) => (
                      <div key={k} style={{ fontSize: 11 }}>• {k}: {v}</div>
                    ))}
                  </div>
                )}
                <button onClick={upgradeStorage} style={{ ...actionBtn, marginTop: 10, background: "rgba(78,205,196,0.2)" }}>
                  ⬆️ Améliorer l'entrepôt
                </button>
              </div>
            ) : <div style={emptyMsg}>Clique pour voir le prochain niveau</div>}
          </div>
        );

      case "market":
        return (
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
              <button onClick={() => loadOffers()} style={actionBtn}>🔄 Charger les offres</button>
              <span style={{ fontSize: 9, color: "#4a6a5a" }}>🟢 Auto-refresh 15s</span>
              <span style={{ fontSize: 10, color: "#5a6a7a" }}>{offers.length} offre{offers.length > 1 ? "s" : ""}</span>
            </div>

            {/* Create offer */}
            <div style={{ ...card, marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#4ecdc4", marginBottom: 8 }}>📤 Créer une offre</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <select value={offerForm.resourceType} onChange={e => setOfferForm(p => ({ ...p, resourceType: e.target.value }))} style={inputStyle}>
                  <option value="BOISIUM">BOISIUM</option>
                  <option value="FERONIUM">FERONIUM</option>
                  <option value="CHARBONIUM">CHARBONIUM</option>
                </select>
                <input type="number" placeholder="Qté" value={offerForm.quantityIn} onChange={e => setOfferForm(p => ({ ...p, quantityIn: +e.target.value }))} style={{ ...inputStyle, width: 70 }} />
                <input type="number" placeholder="Prix/u" value={offerForm.pricePerResource} onChange={e => setOfferForm(p => ({ ...p, pricePerResource: +e.target.value }))} style={{ ...inputStyle, width: 70 }} />
                <button onClick={createOffer} style={actionBtn}>Vendre</button>
              </div>
            </div>

            {/* Buy offer */}
            <div style={{ ...card, marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#4ecdc4", marginBottom: 8 }}>📥 Acheter une offre</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <input placeholder="ID offre" value={purchaseForm.offerId} onChange={e => setPurchaseForm(p => ({ ...p, offerId: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
                <input type="number" placeholder="Qté" value={purchaseForm.quantity} onChange={e => setPurchaseForm(p => ({ ...p, quantity: +e.target.value }))} style={{ ...inputStyle, width: 70 }} />
                <button onClick={buyOffer} style={actionBtn}>Acheter</button>
              </div>
            </div>

            {/* Offers list */}
            {offers.length === 0 && <div style={emptyMsg}>Aucune offre</div>}
            {offers.map(o => (
              <div key={o.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <b>{o.resourceType}</b> × {o.quantityIn}
                    <span style={{ color: "#ffd700", marginLeft: 8 }}>{o.pricePerResource} OR/u</span>
                  </div>
                  <span style={{ fontSize: 10, color: "#5a6a7a" }}>{o.owner?.name}</span>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button onClick={() => { setPurchaseForm({ offerId: o.id, quantity: o.quantityIn }); }} style={{ ...actionBtn, fontSize: 10 }}>
                    📋 Copier ID
                  </button>
                  <button onClick={() => deleteOffer(o.id)} style={{ ...actionBtn, fontSize: 10, color: "#ff8888" }}>
                    🗑️ Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        );

      case "thefts":
        return (
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            <button onClick={loadThefts} style={actionBtn}>🔄 Charger les vols</button>

            <div style={{ ...card, marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#4ecdc4", marginBottom: 8 }}>🏴‍☠️ Lancer un vol</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <select value={theftForm.resourceType} onChange={e => setTheftForm(p => ({ ...p, resourceType: e.target.value }))} style={inputStyle}>
                  <option value="BOISIUM">BOISIUM</option>
                  <option value="FERONIUM">FERONIUM</option>
                  <option value="CHARBONIUM">CHARBONIUM</option>
                </select>
                <input type="number" placeholder="OR investi" value={theftForm.moneySpent} onChange={e => setTheftForm(p => ({ ...p, moneySpent: +e.target.value }))} style={{ ...inputStyle, width: 90 }} />
                <button onClick={launchTheft} style={{ ...actionBtn, background: "rgba(255,68,68,0.2)", color: "#ff8888" }}>
                  Attaquer
                </button>
              </div>
            </div>

            {thefts.length === 0 && <div style={emptyMsg}>Aucun vol</div>}
            {thefts.map(t => (
              <div key={t.id} style={{ ...card, borderLeft: `3px solid ${t.status === "PENDING" ? "#ffa500" : t.status === "SUCCESS" ? "#4ecdc4" : "#ff4444"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <b>{t.resourceType}</b>
                  <span style={{ color: t.status === "PENDING" ? "#ffa500" : t.status === "SUCCESS" ? "#4ecdc4" : "#ff4444" }}>{t.status}</span>
                </div>
                <div style={{ fontSize: 10, marginTop: 4, lineHeight: 1.8 }}>
                  <div>💰 {t.moneySpent} OR investis | 🎲 Chance: {t.chance}</div>
                  <div>📦 Tentative: {t.amountAttempted}</div>
                  <div>⏱ Résolution: {new Date(t.resolveAt).toLocaleTimeString("fr-FR")}</div>
                </div>
              </div>
            ))}
          </div>
        );

      case "import":
        return (
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            <div style={{ fontSize: 11, color: "#5a7a9a", marginBottom: 8, lineHeight: 1.6 }}>
              Colle ici tes données. Formats acceptés :<br />
              • <code>"x,y": "TYPE"</code> (ton format de logs)<br />
              • Réponse JSON de <code>/ship/move</code><br />
              • Tableau de cellules <code>[{`{x,y,type,zone}`},...]</code>
            </div>
            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder='Colle tes logs JSON ici...'
              style={{
                width: "100%", height: 200, background: "rgba(20,40,60,0.8)",
                border: "1px solid rgba(40,80,120,0.5)", borderRadius: 6, padding: 10,
                color: "#c8d8e8", fontSize: 10, fontFamily: "inherit", resize: "vertical", outline: "none",
              }}
            />
            <button onClick={doImport} style={{ ...actionBtn, marginTop: 8, width: "100%" }}>
              📥 Importer dans la DB
            </button>
            {importResult && (
              <div style={{ ...card, marginTop: 8, color: importResult.error ? "#ff8888" : "#4ecdc4" }}>
                {importResult.error
                  ? `❌ ${importResult.error}`
                  : `✅ ${importResult.imported} cellules importées (total: ${importResult.totalInDb})`}
              </div>
            )}
          </div>
        );

      default: return null;
    }
  };

  // ─── Render ──────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", background: "linear-gradient(135deg,#040810,#0a1628,#0d1f3c)", color: "#c8d8e8", width: "100vw", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "rgba(10,22,40,0.95)", borderBottom: "1px solid rgba(40,80,120,0.4)", padding: "8px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#4ecdc4", letterSpacing: 3 }}>⚓ 3026</div>
        <div style={{ flex: 1, display: "flex", gap: 8, alignItems: "center" }}>
          <input type="password" placeholder="codinggame-id..." value={tokenInput} onChange={e => setTokenInput(e.target.value)}
            style={{ flex: 1, maxWidth: 400, background: "rgba(20,40,60,0.8)", border: "1px solid rgba(40,80,120,0.5)", borderRadius: 6, padding: "6px 10px", color: "#c8d8e8", fontSize: 11, fontFamily: "inherit", outline: "none" }} />
          <button onClick={() => { setToken(tokenInput); localStorage.setItem("3026-token", tokenInput); addLog("🔑 Token OK", "success"); }}
            style={{ background: token && tokenInput === token ? "#1a5c45" : "#4ecdc4", color: token && tokenInput === token ? "#4ecdc4" : "#040810", border: "none", borderRadius: 6, padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
            {token && tokenInput === token ? "✓" : "OK"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={playMusic}>▶️ Play</button>
          <button onClick={pauseMusic}>⏸ Pause</button>
          <button onClick={nextMusic}>⏭ Suivant</button>
        </div>
        <button onClick={loadPlayerDetails} disabled={!token || loading} style={headerBtn}>📋 Profil</button>
        <button onClick={async () => { await loadCellsFromDB(); await loadDbStats(); addLog("🔄 Refresh DB", "success"); }} style={headerBtn}>🔄 DB</button>
        <label style={{ color: "#5a7a9a", fontSize: 10, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} /> Auto 10s
        </label>

        {/* Timer */}
        <div style={{
          background: elapsed !== null && elapsed < 3 ? "rgba(255,68,68,0.15)" : "rgba(20,40,60,0.6)",
          border: `1px solid ${elapsed !== null && elapsed < 3 ? "rgba(255,68,68,0.4)" : "rgba(40,80,120,0.4)"}`,
          borderRadius: 6, padding: "4px 12px", fontSize: 13, fontWeight: 700, minWidth: 80, textAlign: "center",
          color: elapsed !== null && elapsed < 3 ? "#ff8888" : "#4ecdc4",
        }}>
          {elapsed !== null ? `⏱ ${elapsed}s` : "⏱ —"}
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Left panel */}
        <div style={{ width: 220, background: "rgba(8,16,30,0.95)", borderRight: "1px solid rgba(40,80,120,0.3)", padding: 12, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, flexShrink: 0 }}>
          {playerInfo ? (<>
            <div>
              <div style={secTitle}>Équipe</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#e8f0f8" }}>{playerInfo.name}</div>
              <div style={{ fontSize: 11, color: "#6a8aaa" }}>🏠 {playerInfo.home?.name}</div>
              <div style={{ marginTop: 6, fontSize: 15, fontWeight: 700, color: "#ffd700" }}>💰 {playerInfo.money?.toFixed(0)} OR</div>
              <div style={{ fontSize: 10, color: "#6a8aaa" }}>📈 Quotient: {playerInfo.quotient}</div>
            </div>
            {playerInfo.resources && (
              <div>
                <div style={secTitle}>Ressources</div>
                {playerInfo.resources.map(r => {
                  const max = playerInfo.storage?.maxResources?.[r.type] || 999;
                  const pct = (r.quantity / max) * 100;
                  return (
                    <div key={r.type} style={{ marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
                        <span style={{ color: pct >= 100 ? "#ff4444" : "#8a9ab5" }}>{r.type}</span>
                        <span style={{ color: pct >= 100 ? "#ff4444" : "#c8d8e8", fontWeight: 700 }}>{r.quantity}/{max}</span>
                      </div>
                      <div style={{ height: 5, background: "rgba(40,80,120,0.3)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: 3, background: pct >= 100 ? "#ff4444" : pct > 80 ? "#ffa500" : "#4ecdc4" }} />
                      </div>
                    </div>
                  );
                })}
                <div style={{ fontSize: 9, color: "#4a5a6a" }}>📦 {playerInfo.storage?.name} (Nv.{playerInfo.storage?.levelId})</div>
              </div>
            )}
            {playerInfo.discoveredIslands && (
              <div>
                <div style={secTitle}>Îles ({playerInfo.discoveredIslands.length})</div>
                {playerInfo.discoveredIslands.map((d, i) => (
                  <div key={i} style={{ fontSize: 10, padding: "4px 6px", marginBottom: 3, background: "rgba(20,40,60,0.6)", borderRadius: 4, borderLeft: `3px solid ${d.islandState === "KNOWN" ? "#4ecdc4" : "#ffa500"}` }}>
                    🏝 {d.island.name} {d.island.bonusQuotient > 0 && <span style={{ color: "#4ecdc4" }}>+{d.island.bonusQuotient}</span>}
                  </div>
                ))}
              </div>
            )}
          </>) : <div style={{ color: "#3a5a7a", fontSize: 11, textAlign: "center", padding: 20 }}>Connecte-toi et<br />clique Profil</div>}

          <div>
            <div style={secTitle}>Base de données</div>
            <div style={{ fontSize: 10, lineHeight: 2 }}>
              <div>📊 <b>{dbStats?.totalCells || stats.total}</b> cellules</div>
              <div>🌊 {dbStats?.byType?.SEA || 0} | 🏖️ {dbStats?.byType?.SAND || 0} | 🪨 {dbStats?.byType?.ROCKS || 0}</div>
              <div>🗺️ {dbStats?.byZone?.length || 0} zones | 🧭 {dbStats?.totalMoves || 0} moves</div>
            </div>
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <div ref={mapRef} onMouseDown={handleMapMouseDown} onMouseMove={handleMapMouseMove} onMouseUp={handleMapMouseUp} onMouseLeave={handleMapMouseUp} onWheel={handleWheel}
            style={{ width: "100%", height: "100%", position: "relative", cursor: isDragging ? "grabbing" : "grab", userSelect: "none", background: `radial-gradient(ellipse at 30% 40%,rgba(10,30,60,0.4),transparent 60%),radial-gradient(ellipse at 70% 60%,rgba(5,20,45,0.4),transparent 60%),${COLORS.UNKNOWN}` }}>
            {renderMap()}
            {cellsArray.length === 0 && <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", color: "#3a5a7a" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🗺️</div><div style={{ fontSize: 14 }}>Aucune cellule</div>
            </div>}
          </div>

          {/* Overlays */}
          <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(8,16,30,0.92)", borderRadius: 8, padding: "6px 14px", border: "1px solid rgba(40,80,120,0.4)", fontSize: 12, display: "flex", gap: 14, alignItems: "center", zIndex:"1000" }}>
            {shipPos && <span style={{ fontWeight: 600 }}>📍 ({shipPos.x},{shipPos.y})</span>}
            {energy !== null && <span style={{ color: energy < 5 ? "#ff4444" : energy < 15 ? "#ffa500" : "#4ecdc4", fontWeight: 800, fontSize: 14 }}>⚡{energy}</span>}
            <button onClick={() => { if (shipPos) { setCamera({ ...shipPos }); setAutoCenter(true); } }} style={smallBtn}>🎯</button>
            <button onClick={() => setAutoCenter(v => !v)} style={{ ...smallBtn, color: autoCenter ? "#4ecdc4" : "#5a6a7a" }}>{autoCenter ? "🔒" : "🔓"}</button>
            <span style={{ fontSize: 9, color: "#4a5a6a" }}>×{zoom.toFixed(1)}</span>
          </div>

          {hoveredCell && <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(8,16,30,0.92)", borderRadius: 8, padding: "6px 12px", border: "1px solid rgba(40,80,120,0.4)", fontSize: 11, zIndex: "1000" }}>
            ({hoveredCell.x},{hoveredCell.y}) <b>{hoveredCell.type}</b> Z{hoveredCell.zone}
            {hoveredCell.ships?.length > 0 && <div style={{ color: "#ffa500" }}>🚢 {hoveredCell.ships.map(s => s.playerName || "?").join(",")}</div>}
          </div>}

          {error && <div onClick={() => setError(null)} style={{ position: "absolute", bottom: 180, right: 16, background: "rgba(80,10,10,0.92)", border: "1px solid rgba(255,68,68,0.5)", borderRadius: 8, padding: "8px 14px", fontSize: 11, color: "#ff8888", maxWidth: 320, cursor: "pointer" }}>
            ❌ {error}
          </div>}

          {/* Compass */}
          <div style={{ position: "absolute", bottom: 16, right: 16, display: "grid", gridTemplateColumns: "repeat(3,50px)", gridTemplateRows: "repeat(3,50px)", gap: 3, zIndex: "1000"}}>
            {DIRS.map(({ dir, label, r, c }) => (
              <button key={`${r}-${c}`} onClick={() => {
                if (!dir) return;
                stopAutoMove("⛔ Trajet auto annulé (commande manuelle)");
                moveShip(dir);
              }} disabled={!dir || loading || !token}
                style={{
                  gridRow: r + 1, gridColumn: c + 1,
                  background: !dir ? "rgba(78,205,196,0.12)" : "rgba(15,30,50,0.9)",
                  border: `1px solid ${!dir ? "rgba(78,205,196,0.3)" : "rgba(40,80,120,0.5)"}`,
                  borderRadius: 10, color: !dir ? "#4ecdc4" : "#c8d8e8", fontSize: 22,
                  cursor: dir && !loading && token ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: !token || loading ? 0.3 : 1, fontFamily: "inherit",
                }}>{label}</button>
            ))}
          </div>

          <div style={{ position: "absolute", bottom: 16, left: 12, fontSize: 9, color: "#3a5a7a", background: "rgba(8,16,30,0.85)", padding: "6px 10px", borderRadius: 6, lineHeight: 1.7 }}>
            ⌨️ ZQSD/flèches + A/E/W/C diag | 🖱️ molette/drag
          </div>
        </div>

        {/* Right panel */}
        <div style={{ width: 320, background: "rgba(8,16,30,0.95)", borderLeft: "1px solid rgba(40,80,120,0.3)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {/* Tabs */}
          <div style={{ display: "flex", flexWrap: "wrap", borderBottom: "1px solid rgba(40,80,120,0.3)", flexShrink: 0 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setRightTab(t.id)}
                style={{
                  background: rightTab === t.id ? "rgba(78,205,196,0.1)" : "transparent",
                  color: rightTab === t.id ? "#4ecdc4" : "#5a6a7a",
                  border: "none", borderBottom: rightTab === t.id ? "2px solid #4ecdc4" : "2px solid transparent",
                  padding: "8px 8px", fontSize: 10, cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                }}>{t.label}</button>
            ))}
          </div>
          {renderRightPanel()}
        </div>
      </div>

      {loading && <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, zIndex: 999, background: "linear-gradient(90deg,transparent,#4ecdc4,transparent)", animation: "ld .8s ease-in-out infinite" }} />}
      <style>{`
        @keyframes ld{0%{opacity:.3;transform:translateX(-50%)}50%{opacity:1;transform:translateX(0)}100%{opacity:.3;transform:translateX(50%)}}
        button:hover:not(:disabled){filter:brightness(1.25)}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(40,80,120,0.4);border-radius:3px}
      `}</style>
    </div>
  );
}

const secTitle = { fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "#4ecdc4", marginBottom: 6, fontWeight: 700 };
const headerBtn = { background: "rgba(78,205,196,0.15)", color: "#4ecdc4", border: "1px solid rgba(78,205,196,0.3)", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600 };
const smallBtn = { background: "none", border: "1px solid rgba(78,205,196,0.3)", borderRadius: 5, color: "#4ecdc4", cursor: "pointer", fontSize: 11, padding: "2px 8px", fontFamily: "inherit", fontWeight: 600 };
const actionBtn = { background: "rgba(78,205,196,0.15)", color: "#4ecdc4", border: "1px solid rgba(78,205,196,0.3)", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, display: "inline-block" };
const card = { background: "rgba(20,40,60,0.6)", borderRadius: 6, padding: "10px 12px", marginTop: 8, fontSize: 12 };
const emptyMsg = { color: "#3a5a7a", textAlign: "center", padding: 20, fontSize: 11 };
const inputStyle = { background: "rgba(20,40,60,0.8)", border: "1px solid rgba(40,80,120,0.5)", borderRadius: 4, padding: "5px 8px", color: "#c8d8e8", fontSize: 11, fontFamily: "inherit", outline: "none" };
