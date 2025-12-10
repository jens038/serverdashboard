// server.js - ServerDashboard backend + static frontend op poort 3232

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import si from "systeminformation";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3232;

// ============ PADEN & CONSTANTEN ============

const CONFIG_DIR = process.env.CONFIG_DIR || "/app/data";
const CONFIG_PATH = path.join(CONFIG_DIR, "containers.config.json");
const USERS_PATH = path.join(CONFIG_DIR, "users.json");

const INTEGRATION_KEYS = ["plex", "qbittorrent", "overseerr"];

const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_THIS_IN_PRODUCTION";
const AUTH_COOKIE_NAME = "sd_token";

// ============ DEFAULT CONFIGS ============

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

// ============ CONFIG LOAD/SAVE ============

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

// ============ USER STORAGE (LOCAL AUTH) ============

async function loadUsers() {
  try {
    const raw = await fs.readFile(USERS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
    };
  } catch {
    return { users: [] };
  }
}

async function saveUsers(data) {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(
    USERS_PATH,
    JSON.stringify(
      {
        users: Array.isArray(data.users) ? data.users : [],
      },
      null,
      2
    ),
    "utf-8"
  );
}

function publicUser(user) {
  if (!user) return null;
  const { id, email, name, createdAt } = user;
  return { id, email, name, createdAt };
}

// ============ HULPFUNCTIES URL/PARSING ============

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

// ============ MIDDLEWARE ============

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ============ AUTH HANDLERS ============

async function authStateHandler(req, res) {
  try {
    const { users } = await loadUsers();
    const token = req.cookies[AUTH_COOKIE_NAME];

    if (!users || users.length === 0) {
      return res.json({
        authenticated: false,
        setupRequired: true,
        user: null,
      });
    }

    if (!token) {
      return res.json({
        authenticated: false,
        setupRequired: false,
        user: null,
      });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = users.find((u) => u.id === decoded.sub);
      if (!user) {
        return res.json({
          authenticated: false,
          setupRequired: false,
          user: null,
        });
      }

      return res.json({
        authenticated: true,
        setupRequired: false,
        user: publicUser(user),
      });
    } catch {
      return res.json({
        authenticated: false,
        setupRequired: false,
        user: null,
      });
    }
  } catch (err) {
    console.error("authStateHandler error:", err);
    res.status(500).json({ message: "Auth state error" });
  }
}

async function registerHandler(req, res) {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email en wachtwoord zijn verplicht" });
    }

    const usersData = await loadUsers();

    if (usersData.users && usersData.users.length > 0) {
      return res
        .status(400)
        .json({ message: "Er bestaat al een account. Gebruik login." });
    }

    const hash = await bcrypt.hash(password, 10);
    const newUser = {
      id: `u-${Date.now().toString(16)}`,
      email: email.toLowerCase(),
      name: name || "Administrator",
      passwordHash: hash,
      createdAt: new Date().toISOString(),
    };

    const next = { users: [newUser] };
    await saveUsers(next);

    const token = jwt.sign({ sub: newUser.id }, JWT_SECRET, {
      expiresIn: "30d",
    });

    res
      .cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      })
      .json({ user: publicUser(newUser) });
  } catch (err) {
    console.error("registerHandler error:", err);
    res.status(500).json({ message: "Kon account niet aanmaken" });
  }
}

async function loginHandler(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email en wachtwoord zijn verplicht" });
    }

    const { users } = await loadUsers();
    if (!users || users.length === 0) {
      return res.status(400).json({
        message: "Er is nog geen account. Maak eerst een account aan.",
      });
    }

    const user = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
    if (!user) {
      return res
        .status(401)
        .json({ message: "Onjuiste login-gegevens (email of wachtwoord)" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res
        .status(401)
        .json({ message: "Onjuiste login-gegevens (email of wachtwoord)" });
    }

    const token = jwt.sign({ sub: user.id }, JWT_SECRET, {
      expiresIn: "30d",
    });

    res
      .cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      })
      .json({ user: publicUser(user) });
  } catch (err) {
    console.error("loginHandler error:", err);
    res.status(500).json({ message: "Kon niet inloggen" });
  }
}

function logoutHandler(req, res) {
  res
    .clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    })
    .json({ ok: true });
}

// ============ AUTH ROUTES (met aliassen) ============

// nieuwe stijl
// nieuwe stijl
app.get("/api/auth/state", authStateHandler);
app.get("/api/auth/me", authStateHandler);       // alias
app.get("/api/auth/user", authStateHandler);     // alias

app.post("/api/auth/register", registerHandler);
app.post("/api/auth/setup", registerHandler);    // alias

app.post("/api/auth/login", loginHandler);
app.post("/api/auth/logout", logoutHandler);

// korte / legacy paden (extra compat)
app.post("/api/register", registerHandler);
app.post("/api/setup", registerHandler);         // alias
app.post("/api/login", loginHandler);
app.post("/api/logout", logoutHandler);

// ============ SYSTEM STATS API ============

app.get("/api/system/stats", async (req, res) => {
  try {
    const cpu = await si.currentLoad().catch((err) => {
      console.warn("systeminformation currentLoad error:", err.message);
      return null;
    });

    const mem = await si.mem().catch((err) => {
      console.warn("systeminformation mem error:", err.message);
      return null;
    });

    const fsInfo = await si.fsSize().catch((err) => {
      console.warn("systeminformation fsSize error:", err.message);
      return [];
    });

    const net = await si.networkStats().catch((err) => {
      console.warn("systeminformation networkStats error:", err.message);
      return [];
    });

    const cpuLoad = cpu ? Math.round(cpu.currentLoad || 0) : 0;
    const ramUsedPercent =
      mem && mem.total
        ? Math.round((mem.active / mem.total) * 100)
        : 0;

    const totalDisk = fsInfo.reduce((sum, d) => sum + (d.size || 0), 0);
    const usedDisk = fsInfo.reduce((sum, d) => sum + (d.used || 0), 0);
    const storageUsedPercent =
      totalDisk > 0 ? Math.round((usedDisk / totalDisk) * 100) : 0;

    const net0 = net[0] || {};
    const networkMbps = Math.round(
      (((net0.tx_sec || 0) + (net0.rx_sec || 0)) / 125000) || 0
    );

    res.json({
      cpu: cpuLoad,
      ram: ramUsedPercent,
      network: networkMbps,
      storage: storageUsedPercent,
    });
  } catch (err) {
    console.error("GET /api/system/stats fatal error:", err);
    res.json({
      cpu: 0,
      ram: 0,
      network: 0,
      storage: 0,
    });
  }
});

// ============ CONTAINERS API ============

app.get("/api/containers", async (req, res) => {
  const cfg = await loadConfig();
  res.json(cfg.containers);
});

app.post("/api/containers", async (req, res) => {
  try {
    const { name, description, url, iconName, color, apiKey } = req.body || {};

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
      apiKey: apiKey || "",
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

          return {
            ...svc,
            url,
            online: response.ok,
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

app.post("/api/integrations/:id/settings", async (req, res) => {
  return handleIntegrationSettingsUpdate(req, res);
});

app.put("/api/integrations/:id/settings", async (req, res) => {
  return handleIntegrationSettingsUpdate(req, res);
});

async function handleIntegrationSettingsUpdate(req, res) {
  try {
    const { id } = req.params;
    if (!INTEGRATION_KEYS.includes(id)) {
      return res.status(404).json({ message: `Unknown integration '${id}` });
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

    if (id === "plex" && typeof body.token === "string" && body.token.trim()) {
      updated.token = body.token.trim();
    }

    if (id === "qbittorrent") {
      if (typeof body.username === "string" && body.username.trim()) {
        updated.username = body.username.trim();
      }
      if (typeof body.password === "string" && body.password.trim()) {
        updated.password = body.password.trim();
      }
    }

    if (
      id === "overseerr" &&
      typeof body.apiKey === "string" &&
      body.apiKey.trim()
    ) {
      updated.apiKey = body.apiKey.trim();
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

      sessions.push({
        title: titleMatch ? titleMatch[1] : null,
        grandparentTitle: grandparentTitleMatch ? grandparentTitleMatch[1] : null,
        user: userMatch ? userMatch[1] : null,
        type: typeMatch ? typeMatch[1] : null,
        progressPercent: 0,
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

    let cookie;
    try {
      cookie = await qbittorrentLogin(baseUrl, username, password);
    } catch (loginErr) {
      console.error("qBittorrent login error:", loginErr);
      return res.status(502).json({
        online: false,
        message: "Login to qBittorrent failed",
        error: loginErr.message,
      });
    }

    const resp = await fetch(`${baseUrl}/api/v2/torrents/info`, {
      headers: {
        Cookie: cookie,
        Accept: "application/json",
      },
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error(
        "qBittorrent torrents/info error:",
        resp.status,
        text.slice(0, 200)
      );
      return res.status(502).json({
        online: false,
        message: "Failed to fetch torrents from qBittorrent",
        statusCode: resp.status,
        error: text.slice(0, 200),
      });
    }

    const torrents = await resp.json();

    const downloads = torrents
      .filter((t) => !t.completed && t.state !== "pausedUP")
      .sort((a, b) => b.added_on - a.added_on)
      .slice(0, limit)
      .map((t) => ({
        name: t.name,
        downloadSpeed: t.dlspeed || 0,
        eta: t.eta || 0,
        progressPercent: Math.round((t.progress || 0) * 100),
        state: t.state,
      }));

    return res.json({
      online: true,
      downloads,
    });
  } catch (err) {
    console.error("GET /api/integrations/qbittorrent/downloads error:", err);
    return res.status(500).json({
      online: false,
      message: "Unexpected error while talking to qBittorrent",
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

app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ message: "API route not found" });
  }
  res.sendFile(path.join(distPath, "index.html"));
  
  app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    console.log("[API]", req.method, req.path);
  }
  next();
});

});

// ============ START ============

app.listen(PORT, () => {
  console.log(`ServerDashboard draait op http://localhost:${PORT}`);
});

