// server.js - ServerDashboard backend + static frontend op poort 3232

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import si from "systeminformation";
import crypto from "crypto";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3232;

// ============ PADEN & CONFIG ============

const CONFIG_DIR = process.env.CONFIG_DIR || "/app/data";
const CONFIG_PATH = path.join(CONFIG_DIR, "containers.config.json");
const USERS_PATH = path.join(CONFIG_DIR, "users.json");

const INTEGRATION_KEYS = ["plex", "qbittorrent", "overseerr"];
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_SERVERDASHBOARD_SECRET";

// globale state voor network-speed delta
let lastNetSample = null;

// ============ CONFIG HELPERS ============

function getDefaultConfig() {
  return {
    version: 1,
    containers: [],
    integrations: {
      plex: {
        enabled: false,
        name: "Plex",
        host: "",
        port: 32400,
        protocol: "http",
        basePath: "",
        serverUrl: "",
        token: "",
      },
      qbittorrent: {
        enabled: false,
        name: "qBittorrent",
        host: "",
        port: 8080,
        protocol: "http",
        basePath: "",
        serverUrl: "",
        username: "",
        password: "",
      },
      overseerr: {
        enabled: false,
        name: "Overseerr",
        host: "",
        port: 5055,
        protocol: "http",
        basePath: "",
        serverUrl: "",
        apiKey: "",
      },
    },
  };
}

function mergeWithDefaults(cfg) {
  const base = getDefaultConfig();
  const src = cfg || {};

  return {
    version: src.version || base.version,
    containers: Array.isArray(src.containers) ? src.containers : [],
    integrations: {
      plex: {
        ...base.integrations.plex,
        ...(src.integrations?.plex || {}),
      },
      qbittorrent: {
        ...base.integrations.qbittorrent,
        ...(src.integrations?.qbittorrent || {}),
      },
      overseerr: {
        ...base.integrations.overseerr,
        ...(src.integrations?.overseerr || {}),
      },
    },
  };
}

async function loadConfig() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return mergeWithDefaults(parsed);
  } catch {
    return getDefaultConfig();
  }
}

async function saveConfig(cfg) {
  const normalized = mergeWithDefaults(cfg);
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(
    CONFIG_PATH,
    JSON.stringify(normalized, null, 2),
    "utf-8"
  );
  return normalized;
}

// ============ USER / AUTH HELPERS ============

async function loadUsers() {
  try {
    const raw = await fs.readFile(USERS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.users) ? parsed.users : [];
  } catch {
    return [];
  }
}

async function saveUsers(users) {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  const payload = { version: 1, users };
  await fs.writeFile(USERS_PATH, JSON.stringify(payload, null, 2), "utf-8");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const testHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(testHash, "hex")
  );
}

function signToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role || "user",
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

function authFromRequest(req) {
  const header = req.headers["authorization"];
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch {
    return null;
  }
}

// ============ ALGEMENE HELPERS ============

function parseServiceUrl(serverUrl) {
  try {
    if (!serverUrl || typeof serverUrl !== "string") return null;
    let urlString = serverUrl.trim();
    if (!urlString) return null;

    if (!/^https?:\/\//i.test(urlString)) {
      urlString = "http://" + urlString;
    }

    const u = new URL(urlString);
    const protocol = u.protocol.replace(":", "") || "http";
    const host = u.hostname;
    const port = u.port
      ? Number(u.port)
      : protocol === "https"
      ? 443
      : 80;
    const basePath = u.pathname === "/" ? "" : u.pathname;

    if (!host || !port) return null;

    return { protocol, host, port, basePath };
  } catch {
    return null;
  }
}

function buildBaseUrl({ protocol, host, port, basePath }) {
  const p = protocol || "http";
  const bp = basePath || "";
  return `${p}://${host}:${port}${bp}`;
}

// qBittorrent login → cookie
async function qbittorrentLogin(baseUrl, username, password) {
  const body = new URLSearchParams({
    username: username || "",
    password: password || "",
  }).toString();

  const resp = await fetch(`${baseUrl}/api/v2/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `qBittorrent login failed (${resp.status}): ${text.slice(0, 200)}`
    );
  }

  const cookie = resp.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("qBittorrent login: no cookie returned");
  }

  return cookie;
}

// Overseerr helpers
async function fetchOverseerrJson(url, apiKey) {
  const resp = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Api-Key": apiKey,
    },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Overseerr request failed (${resp.status}): ${text.slice(0, 200)}`
    );
  }

  return resp.json();
}

function mapOverseerrStatus(item) {
  const status = item.status; // request-status
  const mediaStatus = item.media?.status ?? item.mediaInfo?.status;

  if (mediaStatus === 5) {
    return { code: "available", label: "Available" };
  }

  switch (status) {
    case 1:
      return { code: "requested", label: "Requested" };
    case 2:
      return { code: "approved", label: "Approved" };
    case 3:
      return { code: "declined", label: "Declined" };
    case 4:
      return { code: "failed", label: "Failed" };
    default:
      return { code: "unknown", label: "Unknown" };
  }
}

// ============ MIDDLEWARE ============

app.use(cors({ origin: "*" }));
app.use(express.json());

// ============ AUTH API ============

// Check of er al users zijn
app.get("/api/auth/has-users", async (req, res) => {
  const users = await loadUsers();
  res.json({ hasUsers: users.length > 0 });
});

// Register:
// - als er NOG GEEN users zijn → iedereen mag 1e admin aanmaken
// - als er al users zijn → alleen admin met geldige Bearer token
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "E-mail en wachtwoord zijn verplicht." });
    }

    const users = await loadUsers();
    const firstUser = users.length === 0;

    if (!firstUser) {
      const auth = authFromRequest(req);
      if (!auth) {
        return res
          .status(403)
          .json({ message: "Alleen admin kan nieuwe accounts aanmaken." });
      }

      const adminUser = users.find((u) => u.id === auth.id);
      if (!adminUser || adminUser.role !== "admin") {
        return res
          .status(403)
          .json({ message: "Alleen admin kan nieuwe accounts aanmaken." });
      }
    }

    const existing = users.find(
      (u) => u.email.toLowerCase() === String(email).toLowerCase()
    );
    if (existing) {
      return res
        .status(400)
        .json({ message: "Er bestaat al een account met dit e-mailadres." });
    }

    const id = `usr-${crypto.randomBytes(8).toString("hex")}`;
    const passwordHash = hashPassword(password);

    const user = {
      id,
      name: name || "",
      email,
      passwordHash,
      role: firstUser ? "admin" : "user",
      createdAt: new Date().toISOString(),
    };

    const nextUsers = [...users, user];
    await saveUsers(nextUsers);

    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };

    // 1e user -> log meteen in (gebruikt in eerste setup)
    if (firstUser) {
      const token = signToken(user);
      return res.status(201).json({ user: safeUser, token });
    }

    // admin die extra user maakt -> geeft alleen info terug
    return res.status(201).json({ user: safeUser });
  } catch (err) {
    console.error("POST /api/auth/register error:", err);
    res.status(500).json({
      message: "Kon account niet aanmaken",
      error: err.message,
    });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "E-mail en wachtwoord zijn verplicht." });
    }

    const users = await loadUsers();
    const user = users.find(
      (u) => u.email.toLowerCase() === String(email).toLowerCase()
    );
    if (!user) {
      return res.status(400).json({ message: "Onjuiste inloggegevens." });
    }

    const ok = verifyPassword(password, user.passwordHash);
    if (!ok) {
      return res.status(400).json({ message: "Onjuiste inloggegevens." });
    }

    const token = signToken(user);
    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };

    res.json({
      user: safeUser,
      token,
    });
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    res.status(500).json({
      message: "Kon niet inloggen",
      error: err.message,
    });
  }
});

// Wie ben ik? (voor future use)
app.get("/api/auth/me", async (req, res) => {
  try {
    const auth = authFromRequest(req);
    if (!auth) {
      return res.status(401).json({ message: "No session" });
    }
    const users = await loadUsers();
    const user = users.find((u) => u.id === auth.id);
    if (!user) {
      return res.status(401).json({ message: "No session" });
    }
    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.json({ user: safeUser });
  } catch (err) {
    res.status(500).json({ message: "Kon sessie niet ophalen", error: err.message });
  }
});

// ============ CONTAINERS API ============

// GET: alle containers (ruwe config)
app.get("/api/containers", async (req, res) => {
  const cfg = await loadConfig();
  res.json(cfg.containers);
});

// POST: nieuwe container toevoegen
app.post("/api/containers", async (req, res) => {
  try {
    const { name, description, url, iconName, color } = req.body || {};

    if (!name || !url) {
      return res.status(400).json({
        message: "Fields 'name' en 'url' zijn verplicht.",
      });
    }

    const parsed = parseServiceUrl(url);
    if (!parsed) {
      return res.status(400).json({
        message:
          "Kon de Service URL niet parsen. Gebruik iets als 'http://ip:port' of 'ip:port'.",
      });
    }

    const cfg = await loadConfig();
    const id = `svc-${Math.random().toString(36).slice(2, 10)}-${Date.now()
      .toString(16)
      .slice(-6)}`;

    const newContainer = {
      id,
      protocol: parsed.protocol,
      host: parsed.host,
      port: parsed.port,
      basePath: parsed.basePath || "",
      name,
      description: description || "",
      url,
      iconName: iconName || "Box",
      color: color || "from-slate-600 to-slate-800",
    };

    const next = {
      ...cfg,
      containers: [...cfg.containers, newContainer],
    };

    await saveConfig(next);
    res.status(201).json(newContainer);
  } catch (err) {
    console.error("POST /api/containers error:", err);
    res.status(500).json({
      message: "Kon container niet opslaan",
      error: err.message,
    });
  }
});

// PUT: container bijwerken
app.put("/api/containers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    const cfg = await loadConfig();
    const idx = cfg.containers.findIndex((c) => c.id === id);

    if (idx === -1) {
      return res.status(404).json({ message: `Container '${id}' niet gevonden.` });
    }

    let updated = { ...cfg.containers[idx], ...updates };

    if (typeof updates.url === "string" && updates.url.trim() !== "") {
      const parsed = parseServiceUrl(updates.url);
      if (!parsed) {
        return res.status(400).json({
          message:
            "Kon de nieuwe Service URL niet parsen. Laat 'url' weg of gebruik 'http://ip:port'.",
        });
      }
      updated = {
        ...updated,
        protocol: parsed.protocol,
        host: parsed.host,
        port: parsed.port,
        basePath: parsed.basePath || "",
      };
    }

    const nextContainers = [...cfg.containers];
    nextContainers[idx] = updated;

    await saveConfig({ ...cfg, containers: nextContainers });
    res.json(updated);
  } catch (err) {
    console.error("PUT /api/containers/:id error:", err);
    res.status(500).json({
      message: "Kon container niet bijwerken",
      error: err.message,
    });
  }
});

// DELETE: container verwijderen
app.delete("/api/containers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const cfg = await loadConfig();

    const next = cfg.containers.filter((c) => c.id !== id);

    if (next.length === cfg.containers.length) {
      return res
        .status(404)
        .json({ message: `Container '${id}' niet gevonden.` });
    }

    await saveConfig({ ...cfg, containers: next });
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /api/containers/:id error:", err);
    res.status(500).json({
      message: "Kon container niet verwijderen",
      error: err.message,
    });
  }
});

// POST: containers volgorde updaten (optioneel)
app.post("/api/containers/reorder", async (req, res) => {
  try {
    const { order } = req.body || {};
    if (!Array.isArray(order)) {
      return res.status(400).json({ message: "Body moet 'order: string[]' bevatten" });
    }

    const cfg = await loadConfig();
    const map = new Map(cfg.containers.map((c) => [c.id, c]));
    const reordered = [];

    for (const id of order) {
      const c = map.get(id);
      if (c) reordered.push(c);
    }

    // containers die niet in order staan achteraan plakken
    for (const c of cfg.containers) {
      if (!order.includes(c.id)) reordered.push(c);
    }

    cfg.containers = reordered;
    await saveConfig(cfg);
    res.json(cfg.containers);
  } catch (err) {
    console.error("POST /api/containers/reorder error:", err);
    res.status(500).json({
      message: "Kon containers niet herordenen",
      error: err.message,
    });
  }
});

// GET: status van alle containers
app.get("/api/containers/status", async (req, res) => {
  try {
    const cfg = await loadConfig();
    const items = cfg.containers;

    const checks = await Promise.all(
      items.map(async (svc) => {
        const protocol = svc.protocol || "http";

        let url;
        if (svc.host && svc.port) {
          url = `${protocol}://${svc.host}:${svc.port}${svc.basePath || ""}`;
        } else if (svc.url) {
          const parsed = parseServiceUrl(svc.url);
          if (!parsed) {
            return {
              ...svc,
              url: svc.url,
              online: false,
              statusCode: null,
              error: "Invalid URL",
            };
          }
          url = buildBaseUrl(parsed);
        } else {
          return {
            ...svc,
            url: null,
            online: false,
            statusCode: null,
            error: "No URL configured",
          };
        }

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);

          const response = await fetch(url, {
            method: "HEAD",
            signal: controller.signal,
          });

          clearTimeout(timeout);

          // Belangrijk: 401/403/302/404 => nog steeds "online"
          const online = response.status > 0 && response.status < 500;

          return {
            ...svc,
            url,
            online,
            statusCode: response.status,
          };
        } catch (err) {
          return {
            ...svc,
            url,
            online: false,
            statusCode: null,
            error: err.message,
          };
        }
      })
    );

    res.json(checks);
  } catch (err) {
    console.error("GET /api/containers/status error:", err);
    res.status(500).json({
      message: "Kon containerstatus niet ophalen",
      error: err.message,
    });
  }
});

// ============ SYSTEM STATS ============

app.get("/api/system/stats", async (req, res) => {
  try {
    const [load, mem, fsList, netList] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
    ]);

    const cpuUsage = Math.round(load.currentLoad || 0);

    const usedMem = mem.active || mem.used || 0;
    const ramUsedPct =
      mem.total > 0 ? Math.round((usedMem / mem.total) * 100) : 0;

    let storageTotal = 0;
    let storageUsed = 0;
    for (const fs of fsList) {
      if (!fs.size || fs.fsType === "tmpfs") continue;
      storageTotal += fs.size;
      storageUsed += fs.used;
    }
    const storageUsedPct =
      storageTotal > 0 ? Math.round((storageUsed / storageTotal) * 100) : 0;

    let netMbPerSec = 0;
    if (netList && netList.length > 0) {
      const n = netList[0];
      const now = Date.now();

      if (lastNetSample) {
        const dt = (now - lastNetSample.time) / 1000;
        const prevTotal = lastNetSample.rx + lastNetSample.tx;
        const currTotal = (n.rx_bytes || 0) + (n.tx_bytes || 0);
        const deltaBytes = currTotal - prevTotal;

        if (dt > 0 && deltaBytes >= 0) {
          netMbPerSec = deltaBytes / dt / 1024 / 1024;
        }
      }

      lastNetSample = {
        time: now,
        rx: n.rx_bytes || 0,
        tx: n.tx_bytes || 0,
      };
    }

    res.json({
      cpu: { usage: cpuUsage },
      memory: {
        usedPct: ramUsedPct,
        total: mem.total,
        used: usedMem,
      },
      storage: {
        usedPct: storageUsedPct,
        total: storageTotal,
        used: storageUsed,
      },
      network: {
        mbps: Number(netMbPerSec.toFixed(2)),
      },
    });
  } catch (err) {
    console.error("GET /api/system/stats error:", err);
    res.status(500).json({
      message: "Failed to read system stats",
      error: err.message,
    });
  }
});

// ============ INTEGRATIES SETTINGS ============

// GET instellingen
app.get("/api/integrations/:id/settings", async (req, res) => {
  try {
    const { id } = req.params;
    if (!INTEGRATION_KEYS.includes(id)) {
      return res.status(404).json({ message: `Unknown integration '${id}'` });
    }

    const cfg = await loadConfig();
    const defaults = getDefaultConfig().integrations[id];
    const cur = cfg.integrations?.[id] || defaults;

    let serverUrl = cur.serverUrl;
    if (!serverUrl && cur.host && cur.port) {
      serverUrl = buildBaseUrl(cur);
    }

    res.json({
      id,
      name: cur.name,
      enabled: !!cur.enabled,
      serverUrl: serverUrl || "",
      host: cur.host,
      port: cur.port,
      protocol: cur.protocol,
      basePath: cur.basePath,
      hasToken: !!cur.token,
    });
  } catch (err) {
    console.error("GET /api/integrations/:id/settings error:", err);
    res.status(500).json({
      message: "Kon integratie-instellingen niet laden",
      error: err.message,
    });
  }
});

// PUT/POST instellingen opslaan
async function handleSaveIntegrationSettings(req, res) {
  try {
    const { id } = req.params;
    if (!INTEGRATION_KEYS.includes(id)) {
      return res.status(404).json({ message: `Unknown integration '${id}'` });
    }

    const body = req.body || {};
    const cfg = await loadConfig();
    const defaults = getDefaultConfig().integrations[id];
    const current = cfg.integrations?.[id] || defaults;

    let updated = { ...current };

    if (body.serverUrl) {
      const parsed = parseServiceUrl(body.serverUrl);
      if (!parsed) {
        return res
          .status(400)
          .json({ message: "Invalid serverUrl, kon URL niet parsen" });
      }

      updated = {
        ...updated,
        serverUrl: body.serverUrl,
        protocol: parsed.protocol,
        host: parsed.host,
        port: parsed.port,
        basePath: parsed.basePath || "",
      };
    }

    if (typeof body.enabled === "boolean") {
      updated.enabled = body.enabled;
    }

    if (id === "plex" && typeof body.token === "string") {
      updated.token = body.token;
    }

    if (id === "qbittorrent") {
      if (typeof body.username === "string") {
        updated.username = body.username;
      }
      if (typeof body.password === "string") {
        updated.password = body.password;
      }
    }

    if (id === "overseerr" && typeof body.apiKey === "string") {
      updated.apiKey = body.apiKey;
    }

    cfg.integrations = {
      ...(cfg.integrations || {}),
      [id]: updated,
    };

    const saved = await saveConfig(cfg);
    res.json(saved.integrations[id]);
  } catch (err) {
    console.error("SAVE /api/integrations/:id/settings error:", err);
    res.status(500).json({
      message: "Kon integratie-instellingen niet opslaan",
      error: err.message,
    });
  }
}

app.put("/api/integrations/:id/settings", handleSaveIntegrationSettings);
app.post("/api/integrations/:id/settings", handleSaveIntegrationSettings);

// ============ PLEX NOW PLAYING ============

app.get("/api/integrations/plex/now-playing", async (req, res) => {
  try {
    const cfg = await loadConfig();
    const plex = cfg.integrations?.plex;

    if (!plex || !plex.enabled) {
      return res.status(400).json({
        online: false,
        message: "Plex integration not configured or disabled",
      });
    }

    const { host, port, protocol = "http", basePath = "", token } = plex;

    if (!host || !port || !token) {
      return res.status(400).json({
        online: false,
        message: "Plex settings incomplete (host/port/token)",
      });
    }

    const baseUrl = `${protocol}://${host}:${port}${basePath || ""}`;
    const url = `${baseUrl}/status/sessions?X-Plex-Token=${encodeURIComponent(
      token
    )}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/xml,text/xml",
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return res.status(502).json({
        online: false,
        message: "Failed to fetch sessions from Plex",
        statusCode: response.status,
        error: text.slice(0, 500),
      });
    }

    const xml = await response.text();

    const sessions = [];
    const videoRegex = /<Video\b([^>]*)>([\s\S]*?)<\/Video>/gim;

    let match;
    while ((match = videoRegex.exec(xml))) {
      const attrs = match[1];

      const titleMatch = attrs.match(/\btitle="([^"]*)"/);
      const grandparentTitleMatch = attrs.match(/\bgrandparentTitle="([^"]*)"/);
      const typeMatch = attrs.match(/\btype="([^"]*)"/);
      const userMatch = match[2].match(/<User[^>]*title="([^"]*)"[^>]*\/>/);
      const viewOffsetMatch = attrs.match(/\bviewOffset="([^"]*)"/);
      const durationMatch = attrs.match(/\bduration="([^"]*)"/);

      let progressPercent = 0;
      const viewOffset = viewOffsetMatch ? Number(viewOffsetMatch[1]) : 0;
      const duration = durationMatch ? Number(durationMatch[1]) : 0;
      if (duration > 0) {
        progressPercent = Math.round((viewOffset / duration) * 100);
      }

      sessions.push({
        title: titleMatch ? titleMatch[1] : null,
        grandparentTitle: grandparentTitleMatch ? grandparentTitleMatch[1] : null,
        user: userMatch ? userMatch[1] : null,
        type: typeMatch ? typeMatch[1] : null,
        progressPercent,
      });
    }

    res.json({
      online: true,
      sessions,
    });
  } catch (err) {
    console.error("GET /api/integrations/plex/now-playing error:", err);
    res.status(500).json({
      online: false,
      message: "Error while talking to Plex",
      error: err.message,
    });
  }
});

// ============ QBITTORRENT DOWNLOADS ============

app.get("/api/integrations/qbittorrent/downloads", async (req, res) => {
  try {
    const cfg = await loadConfig();
    const qb = cfg.integrations?.qbittorrent;

    if (!qb || !qb.enabled) {
      return res.status(400).json({
        online: false,
        message: "qBittorrent integration not configured or disabled",
      });
    }

    const {
      host,
      port,
      protocol = "http",
      basePath = "",
      username,
      password,
    } = qb;

    if (!host || !port || !username || !password) {
      return res.status(400).json({
        online: false,
        message:
          "qBittorrent settings incomplete (host/port/username/password)",
      });
    }

    // TIP: gebruik hier een interne URL (bv. http://192.168.0.14:8080),
    // NIET het publieke subdomein, anders kan Host header / TLS in de weg zitten.
    const baseUrl = `${protocol}://${host}:${port}${basePath || ""}`;
    const limit = Number(req.query.take || 10);

    const cookie = await qbittorrentLogin(baseUrl, username, password);

    const resp = await fetch(`${baseUrl}/api/v2/torrents/info`, {
      headers: {
        Cookie: cookie,
        Accept: "application/json",
      },
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return res.status(502).json({
        online: false,
        message: "Failed to fetch torrents from qBittorrent",
        statusCode: resp.status,
        error: text.slice(0, 500),
      });
    }

    const torrents = await resp.json();

    const downloads = torrents
      .filter((t) => !t.completed && t.state !== "pausedUP")
      .sort((a, b) => b.added_on - a.added_on)
      .slice(0, limit)
      .map((t) => ({
        name: t.name,
        downloadSpeed: t.dlspeed,
        eta: t.eta,
        progressPercent: Math.round((t.progress || 0) * 100),
        state: t.state,
      }));

    res.json({
      online: true,
      downloads,
    });
  } catch (err) {
    console.error("GET /api/integrations/qbittorrent/downloads error:", err);
    res.status(500).json({
      online: false,
      message: "Error while talking to qBittorrent",
      error: err.message,
    });
  }
});

// ============ OVERSEERR REQUESTS ============

app.get("/api/integrations/overseerr/requests", async (req, res) => {
  try {
    const cfg = await loadConfig();
    const ov = cfg.integrations?.overseerr;

    if (!ov || !ov.enabled) {
      return res.status(400).json({
        online: false,
        message: "Overseerr integration not configured or disabled",
      });
    }

    const {
      host,
      port,
      protocol = "http",
      basePath = "",
      apiKey,
    } = ov;

    if (!host || !port || !apiKey) {
      return res.status(400).json({
        online: false,
        message: "Overseerr settings incomplete (host/port/apiKey)",
      });
    }

    const limit = Number(req.query.take || 10);
    const filter = req.query.filter || "all";

    const baseUrl = `${protocol}://${host}:${port}${basePath || ""}/api/v1`;
    const listUrl = `${baseUrl}/request?take=${encodeURIComponent(
      limit
    )}&skip=0&sort=added&filter=${encodeURIComponent(filter)}`;

    const json = await fetchOverseerrJson(listUrl, apiKey);
    const results = Array.isArray(json.results) ? json.results : [];

    async function enrichTitle(item) {
      const media = item.media || item.mediaInfo || {};
      const mediaType = media.mediaType || media.type;
      const tmdbId = media.tmdbId || media.tmdbid || media.tmdbID;

      let title =
        media.title ||
        media.name ||
        item.title ||
        item.mediaInfo?.title ||
        null;

      if (!mediaType || !tmdbId || title) {
        return title || "Unknown";
      }

      try {
        if (mediaType === "movie") {
          const movie = await fetchOverseerrJson(
            `${baseUrl}/movie/${tmdbId}`,
            apiKey
          );
          return movie.title || movie.originalTitle || "Unknown movie";
        } else if (mediaType === "tv") {
          const tv = await fetchOverseerrJson(
            `${baseUrl}/tv/${tmdbId}`,
            apiKey
          );
          return tv.name || tv.originalName || "Unknown series";
        }
      } catch {
        // detail error negeren
      }

      return "Unknown";
    }

    const mapped = await Promise.all(
      results.map(async (item) => {
        const statusInfo = mapOverseerrStatus(item);
        const media = item.media || item.mediaInfo || {};

        const requestedBy =
          item.requestedBy?.username ||
          item.requestedBy?.plexUsername ||
          item.requestedBy?.email ||
          "Unknown";

        const title = await enrichTitle(item);

        return {
          id: item.id,
          title,
          requestedBy,
          requestedAt: item.createdAt,
          status: statusInfo.code,
          mediaType: media.mediaType || media.type || "unknown",
        };
      })
    );

    res.json({
      online: true,
      requests: mapped,
    });
  } catch (err) {
    console.error("GET /api/integrations/overseerr/requests error:", err);
    res.status(500).json({
      online: false,
      message: "Error while talking to Overseerr",
      error: err.message,
    });
  }
});

// ============ STATIC FRONTEND ============

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "dist");

app.use(express.static(distPath));

// SPA fallback: alle non-API routes naar index.html
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ message: "API route not found" });
  }
  res.sendFile(path.join(distPath, "index.html"));
});

// ============ START ============

app.listen(PORT, () => {
  console.log(`ServerDashboard draait op http://localhost:${PORT}`);
});
