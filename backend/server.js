// backend/server.js - ServerDashboard backend + static frontend op poort 3232

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import si from "systeminformation";
import crypto from "crypto";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3232;

// ============ PADEN / CONFIG ============

const CONFIG_DIR = process.env.CONFIG_DIR || "/app/data";
const CONFIG_PATH = path.join(CONFIG_DIR, "containers.config.json");
const USERS_PATH = path.join(CONFIG_DIR, "users.json");

const INTEGRATION_KEYS = ["plex", "qbittorrent", "overseerr"];

// ============ DEFAULT CONFIG ============

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
  await fs.writeFile(CONFIG_PATH, JSON.stringify(normalized, null, 2), "utf-8");
  return normalized;
}

// ============ USERS (AUTH) ============

function getEmptyUsers() {
  return {
    version: 1,
    users: [],
  };
}

async function loadUsers() {
  try {
    const raw = await fs.readFile(USERS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.users)) return getEmptyUsers();
    return parsed;
  } catch {
    return getEmptyUsers();
  }
}

async function saveUsers(data) {
  const normalized = {
    version: data.version || 1,
    users: Array.isArray(data.users) ? data.users : [],
  };
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(USERS_PATH, JSON.stringify(normalized, null, 2), "utf-8");
  return normalized;
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

// ============ HULPFUNCTIES ============

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
  const status = item.status;
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

// ============ SYSTEM STATS STATE ============

let lastNetSample = null; // { rxBytes, txBytes }
let lastNetTime = null;

// ============ MIDDLEWARE ============

app.use(cors({ origin: "*" }));
app.use(express.json());

// ============ AUTH ROUTES ============

app.get("/api/auth/has-users", async (req, res) => {
  try {
    const data = await loadUsers();
    res.json({ hasUsers: data.users.length > 0 });
  } catch (err) {
    console.error("GET /api/auth/has-users error:", err);
    res.status(500).json({ message: "Failed to check users" });
  }
});

function createUserObject({ email, name, password, role = "user" }) {
  const id =
    "usr-" +
    Math.random().toString(36).slice(2, 10) +
    "-" +
    Date.now().toString(16).slice(-6);

  return {
    id,
    email: String(email).toLowerCase(),
    name: name || email,
    passwordHash: hashPassword(password),
    role,
    createdAt: new Date().toISOString(),
  };
}

// eerste admin-account
async function handleRegisterFirst(req, res) {
  try {
    const { email, password, name } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email en wachtwoord zijn verplicht." });
    }

    const data = await loadUsers();
    if (data.users.length > 0) {
      return res
        .status(400)
        .json({ message: "Er bestaat al een gebruiker." });
    }

    const user = createUserObject({
      email,
      password,
      name: name || "Admin",
      role: "admin",
    });

    const next = {
      version: 1,
      users: [user],
    };

    await saveUsers(next);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("POST /api/auth/register-first error:", err);
    res.status(500).json({ message: "Failed to register first user" });
  }
}

app.post("/api/auth/register-first", handleRegisterFirst);
app.post("/api/auth/register-first-admin", handleRegisterFirst);
app.post("/api/auth/register-admin", handleRegisterFirst);
app.post("/api/auth/register", handleRegisterFirst);

// login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email en wachtwoord zijn verplicht." });
    }

    const data = await loadUsers();
    const user = data.users.find(
      (u) => u.email === String(email).toLowerCase()
    );

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ message: "Ongeldige inloggegevens." });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    res.status(500).json({ message: "Failed to login" });
  }
});

// admin voegt extra user toe
app.post("/api/auth/users", async (req, res) => {
  try {
    const { email, password, name, role = "user" } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email en wachtwoord zijn verplicht." });
    }

    const data = await loadUsers();

    if (data.users.length === 0) {
      return res.status(400).json({
        message:
          "Er is nog geen admin-account. Maak eerst een admin via het registratie-scherm.",
      });
    }

    const exists = data.users.find(
      (u) => u.email === String(email).toLowerCase()
    );
    if (exists) {
      return res.status(400).json({ message: "Dit e-mailadres bestaat al." });
    }

    const newUser = createUserObject({ email, password, name, role });
    const next = {
      ...data,
      users: [...data.users, newUser],
    };

    await saveUsers(next);

    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
    });
  } catch (err) {
    console.error("POST /api/auth/users error:", err);
    res.status(500).json({ message: "Failed to create user" });
  }
});

// ============ CONTAINERS API ============

app.get("/api/containers", async (req, res) => {
  const cfg = await loadConfig();
  res.json(cfg.containers);
});

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
    const id =
      "svc-" +
      Math.random().toString(36).slice(2, 10) +
      "-" +
      Date.now().toString(16).slice(-6);

    const newContainer = {
      id,
      protocol: parsed.protocol,
      host: parsed.host,
      port: parsed.port,
      basePath: parsed.basePath || "",
      name,
      description: description || "",
      url, // we bewaren wat de user invult; frontend fixt protocol bij het klikken
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

app.put("/api/containers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    const cfg = await loadConfig();
    const idx = cfg.containers.findIndex((c) => c.id === id);

    if (idx === -1) {
      return res
        .status(404)
        .json({ message: `Container '${id}' niet gevonden.` });
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

// POST: containers volgorde opslaan
app.post("/api/containers/reorder", async (req, res) => {
  try {
    const { orderedIds } = req.body || {};
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ message: "orderedIds must be an array" });
    }

    const cfg = await loadConfig();

    // Maak map voor quick lookup
    const byId = new Map(cfg.containers.map((c) => [c.id, c]));

    // Bouw nieuwe lijst op basis van orderedIds
    const reordered = [];
    for (const id of orderedIds) {
      const item = byId.get(id);
      if (item) reordered.push(item);
      byId.delete(id);
    }

    // Voeg containers toe die niet in orderedIds zaten (veiligheidsnet)
    for (const [, item] of byId) {
      reordered.push(item);
    }

    const saved = await saveConfig({ ...cfg, containers: reordered });
    res.json(saved.containers);
  } catch (err) {
    console.error("POST /api/containers/reorder error:", err);
    res.status(500).json({ message: "Failed to reorder containers", error: err.message });
  }
});


// status van containers
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

          const online = response.status < 500;

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

// ============ INTEGRATIES SETTINGS API ============

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

async function handleIntegrationSettingsUpdate(req, res) {
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
    console.error("UPDATE /api/integrations/:id/settings error:", err);
    res.status(500).json({
      message: "Kon integratie-instellingen niet opslaan",
      error: err.message,
    });
  }
}

app.put("/api/integrations/:id/settings", handleIntegrationSettingsUpdate);
app.post("/api/integrations/:id/settings", handleIntegrationSettingsUpdate);

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

      const viewOffset = viewOffsetMatch
        ? Number(viewOffsetMatch[1])
        : 0;
      const duration = durationMatch ? Number(durationMatch[1]) : 0;

      const progressPercent =
        duration > 0 ? Math.round((viewOffset / duration) * 100) : 0;

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
      .filter((t) => {
        if (typeof t.progress === "number") return t.progress < 1;
        const state = (t.state || "").toLowerCase();
        return state.includes("dl");
      })
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

    const { host, port, protocol = "http", basePath = "", apiKey } = ov;

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
        // negeren
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

// ============ SYSTEM STATS ============

app.get("/api/system/stats", async (req, res) => {
  try {
    const [load, mem, fsList, netList] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
    ]);

    // 🔧 juiste propertynaam
    const cpuPercent = load.currentLoad || 0;

    const totalMem = mem.total || 0;
    const usedMem = totalMem - (mem.available || 0);
    const ramPercent = totalMem ? (usedMem / totalMem) * 100 : 0;

    const rootFs =
      fsList.find((f) => f.mount === "/" || f.mount === "") || fsList[0];
    let storagePercent = 0;
    if (rootFs) {
      const used = rootFs.used || 0;
      const size = rootFs.size || 0;
      storagePercent = size ? (used / size) * 100 : 0;
    }

    const now = Date.now();
    const net = netList[0] || { rx_bytes: 0, tx_bytes: 0 };

    let rxPerSec = 0;
    let txPerSec = 0;
    if (lastNetSample && lastNetTime) {
      const dtSec = (now - lastNetTime) / 1000;
      if (dtSec > 0) {
        rxPerSec = Math.max(
          0,
          (net.rx_bytes - lastNetSample.rxBytes) / dtSec
        );
        txPerSec = Math.max(
          0,
          (net.tx_bytes - lastNetSample.txBytes) / dtSec
        );
      }
    }
    lastNetSample = { rxBytes: net.rx_bytes || 0, txBytes: net.tx_bytes || 0 };
    lastNetTime = now;

    res.json({
      cpu: {
        percent: Number(cpuPercent.toFixed(1)),
      },
      ram: {
        percent: Number(ramPercent.toFixed(1)),
        usedBytes: usedMem,
        totalBytes: totalMem,
      },
      storage: {
        percent: Number(storagePercent.toFixed(1)),
      },
      network: {
        rxBytesPerSec: Math.round(rxPerSec),
        txBytesPerSec: Math.round(txPerSec),
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

// ============ STATIC FRONTEND ============

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "dist");

app.use(express.static(distPath));

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

