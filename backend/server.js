// server.js - backend + static frontend op poort 3232

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

// App draait ALTIJD op 3232, tenzij user expliciet iets anders meegeeft
const PORT = process.env.PORT || 3232;

// ====== CONFIG OPSLAG ======

const CONFIG_DIR = process.env.CONFIG_DIR || "/app/data";
const CONFIG_PATH = path.join(CONFIG_DIR, "containers.config.json");

// default structuur voor NIEUWE installs
const DEFAULT_CONFIG = {
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
      token: ""
    },
    qbittorrent: {
      enabled: false,
      name: "qBittorrent",
      host: "",
      port: 8080,
      protocol: "http",
      basePath: "",
      username: "",
      password: ""
    },
    overseerr: {
      enabled: false,
      name: "Overseerr",
      host: "",
      port: 5055,
      protocol: "http",
      basePath: "",
      apiKey: ""
    }
  }
};

async function ensureConfigExists() {
  await fs.mkdir(CONFIG_DIR, { recursive: true });

  try {
    await fs.access(CONFIG_PATH);
    return;
  } catch {
    // bestaat niet → nieuw aanmaken
  }

  await fs.writeFile(
    CONFIG_PATH,
    JSON.stringify(DEFAULT_CONFIG, null, 2),
    "utf-8"
  );
  console.log("[config] Created new containers.config.json with defaults");
}

async function loadFullConfig() {
  await ensureConfigExists();

  const raw = await fs.readFile(CONFIG_PATH, "utf-8");
  const parsed = JSON.parse(raw);

  // backward compatible: als het nog een plain array is → in containers stoppen
  if (Array.isArray(parsed)) {
    return {
      version: 1,
      containers: parsed,
      integrations: DEFAULT_CONFIG.integrations
    };
  }

  // zorg dat containers / integrations altijd bestaan
  return {
    version: parsed.version ?? 1,
    containers: Array.isArray(parsed.containers) ? parsed.containers : [],
    integrations: parsed.integrations || DEFAULT_CONFIG.integrations
  };
}

async function saveFullConfig(config) {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  const normalized = {
    version: config.version ?? 1,
    containers: Array.isArray(config.containers) ? config.containers : [],
    integrations: config.integrations || DEFAULT_CONFIG.integrations
  };
  await fs.writeFile(
    CONFIG_PATH,
    JSON.stringify(normalized, null, 2),
    "utf-8"
  );
}

// helpers specifiek voor containers (bestaande API)
async function loadContainers() {
  const config = await loadFullConfig();
  return config.containers;
}

async function saveContainers(containers) {
  const config = await loadFullConfig();
  config.containers = containers;
  await saveFullConfig(config);
}

// ====== INTEGRATIONS HELPERS (plex / qbittorrent / overseerr) ======

const INTEGRATION_IDS = ["plex", "qbittorrent", "overseerr"];

function buildIntegrationDefaults(id) {
  if (id === "plex") {
    return {
      enabled: false,
      name: "Plex",
      host: "",
      port: 32400,
      protocol: "http",
      basePath: "",
      token: ""
    };
  }
  if (id === "qbittorrent") {
    return {
      enabled: false,
      name: "qBittorrent",
      host: "",
      port: 8080,
      protocol: "http",
      basePath: "",
      username: "",
      password: ""
    };
  }
  if (id === "overseerr") {
    return {
      enabled: false,
      name: "Overseerr",
      host: "",
      port: 5055,
      protocol: "http",
      basePath: "",
      apiKey: ""
    };
  }
  throw new Error(`Unknown integration id: ${id}`);
}

function buildBaseUrl(integ) {
  const basePath = integ.basePath || "";
  return `${integ.protocol}://${integ.host}:${integ.port}${basePath}`.replace(
    /\/+$/,
    ""
  );
}

async function getIntegrationConfig(id) {
  const config = await loadFullConfig();
  const all = config.integrations || {};
  const existing = all[id];

  return {
    config,
    all,
    integration: existing || buildIntegrationDefaults(id)
  };
}

async function saveIntegrationConfig(id, integration, config, all) {
  const merged = {
    ...(config || (await loadFullConfig()))
  };
  const integrations = { ...(all || merged.integrations || {}) };

  integrations[id] = integration;
  merged.integrations = integrations;

  await saveFullConfig(merged);
}

// ====== MIDDLEWARE ======

app.use(cors({ origin: "*" }));
app.use(express.json());

// ====== API routes (beheren containers + status) ======

// Alle containers (ruwe config)
app.get("/api/containers", async (req, res) => {
  const containers = await loadContainers();
  res.json(containers);
});

// Nieuwe container toevoegen
app.post("/api/containers", async (req, res) => {
  const { id, name, host, port, ...rest } = req.body;

  if (!id || !name || !host || !port) {
    return res.status(400).json({
      message: "Fields 'id', 'name', 'host' en 'port' zijn verplicht."
    });
  }

  const items = await loadContainers();

  if (items.some((x) => x.id === id)) {
    return res.status(400).json({ message: `Container '${id}' bestaat al.` });
  }

  const newItem = { id, name, host, port, ...rest };
  items.push(newItem);

  await saveContainers(items);
  res.status(201).json(newItem);
});

// Container bijwerken
app.put("/api/containers/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const items = await loadContainers();
  const index = items.findIndex((x) => x.id === id);

  if (index === -1) {
    return res
      .status(404)
      .json({ message: `Container '${id}' niet gevonden.` });
  }

  const updated = { ...items[index], ...updates, id };
  items[index] = updated;

  await saveContainers(items);
  res.json(updated);
});

// Container verwijderen
app.delete("/api/containers/:id", async (req, res) => {
  const { id } = req.params;

  const items = await loadContainers();
  const next = items.filter((x) => x.id !== id);

  if (next.length === items.length) {
    return res
      .status(404)
      .json({ message: `Container '${id}' niet gevonden.` });
  }

  await saveContainers(next);
  res.status(204).send();
});

// Status van alle containers (in één call)
app.get("/api/containers/status", async (req, res) => {
  const items = await loadContainers();

  const checks = await Promise.all(
    items.map(async (svc) => {
      const protocol = svc.protocol || "http";
      const basePath = svc.basePath || "";
      const url = `${protocol}://${svc.host}:${svc.port}${basePath}`;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(url, {
          method: "HEAD",
          signal: controller.signal
        });

        clearTimeout(timeout);

        return {
          ...svc,
          url,
          online: response.ok,
          statusCode: response.status
        };
      } catch (err) {
        return {
          ...svc,
          url,
          online: false,
          statusCode: null,
          error: err.message
        };
      }
    })
  );

  res.json(checks);
});

// ====== INTEGRATION SETTINGS API ======

// GET /api/integrations/:id/settings
app.get("/api/integrations/:id/settings", async (req, res) => {
  try {
    const id = req.params.id;
    if (!INTEGRATION_IDS.includes(id)) {
      return res.status(400).json({ message: "Unknown integration id" });
    }

    const { integration } = await getIntegrationConfig(id);

    // Gevoelige velden strippen:
    if (id === "plex") {
      const { token, ...rest } = integration;
      return res.json({ id, ...rest, hasToken: !!token });
    }
    if (id === "qbittorrent") {
      const { username, password, ...rest } = integration;
      return res.json({ id, ...rest, hasCredentials: !!username });
    }
    if (id === "overseerr") {
      const { apiKey, ...rest } = integration;
      return res.json({ id, ...rest, hasApiKey: !!apiKey });
    }

    res.json({ id, ...integration });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load integration settings" });
  }
});

// PUT /api/integrations/:id/settings
app.put("/api/integrations/:id/settings", async (req, res) => {
  try {
    const id = req.params.id;
    if (!INTEGRATION_IDS.includes(id)) {
      return res.status(400).json({ message: "Unknown integration id" });
    }

    const body = req.body || {};
    const { config, all, integration: current } = await getIntegrationConfig(id);

    // basisvelden (geldig voor alle drie)
    const updated = {
      ...current,
      enabled: body.enabled ?? current.enabled ?? true,
      name: body.name ?? current.name,
      host: body.host ?? current.host ?? "",
      port:
        body.port ??
        current.port ??
        (id === "plex" ? 32400 : id === "qbittorrent" ? 8080 : 5055),
      protocol: body.protocol ?? current.protocol ?? "http",
      basePath: body.basePath ?? current.basePath ?? ""
    };

    // secrets per service
    if (id === "plex" && typeof body.token === "string") {
      updated.token = body.token;
    }

    if (id === "qbittorrent") {
      if (typeof body.username === "string") updated.username = body.username;
      if (typeof body.password === "string") updated.password = body.password;
    }

    if (id === "overseerr" && typeof body.apiKey === "string") {
      updated.apiKey = body.apiKey;
    }

    await saveIntegrationConfig(id, updated, config, all);

    // terug zonder secrets
    if (id === "plex") {
      const { token, ...rest } = updated;
      return res.json({ id, ...rest, hasToken: !!token });
    }
    if (id === "qbittorrent") {
      const { username, password, ...rest } = updated;
      return res.json({ id, ...rest, hasCredentials: !!username });
    }
    if (id === "overseerr") {
      const { apiKey, ...rest } = updated;
      return res.json({ id, ...rest, hasApiKey: !!apiKey });
    }

    res.json({ id, ...updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save integration settings" });
  }
});

// ====== PLEX: NOW PLAYING ======

// GET /api/integrations/plex/now-playing
app.get("/api/integrations/plex/now-playing", async (req, res) => {
  try {
    const { integration: plex } = await getIntegrationConfig("plex");

    if (!plex.enabled) {
      return res.status(400).json({ online: false, message: "Plex not enabled" });
    }
    if (!plex.host || !plex.port || !plex.token) {
      return res
        .status(400)
        .json({ online: false, message: "Plex not fully configured" });
    }

    const baseUrl = buildBaseUrl(plex);
    const url = `${baseUrl}/status/sessions?X-Plex-Token=${encodeURIComponent(
      plex.token
    )}`;

    const start = Date.now();
    const response = await fetch(url, {
      headers: {
        // veel servers kunnen JSON leveren; anders moet je XML parsen
        Accept: "application/json"
      }
    });
    const latencyMs = Date.now() - start;

    if (!response.ok) {
      return res.status(502).json({
        online: false,
        statusCode: response.status,
        latencyMs
      });
    }

    const data = await response.json().catch(() => null);

    const sessions =
      data?.MediaContainer?.Metadata?.map((item) => ({
        id: item.ratingKey,
        title: item.title,
        grandparentTitle: item.grandparentTitle,
        type: item.type,
        user: item.User?.title,
        progressPercent:
          item.viewOffset && item.duration
            ? Math.round((item.viewOffset / item.duration) * 100)
            : null
      })) ?? [];

    res.json({
      online: true,
      latencyMs,
      sessions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      online: false,
      message: "Failed to fetch Plex sessions"
    });
  }
});

// ====== QBITTORRENT: DOWNLOADS ======

async function qbitLogin(qb) {
  const baseUrl = buildBaseUrl(qb);
  const resp = await fetch(`${baseUrl}/api/v2/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      username: qb.username || "",
      password: qb.password || ""
    })
  });

  if (!resp.ok) {
    throw new Error(`qBittorrent login failed (${resp.status})`);
  }

  const cookie = resp.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("qBittorrent returned no cookie");
  }

  return { baseUrl, cookie };
}

// GET /api/integrations/qbittorrent/downloads
app.get("/api/integrations/qbittorrent/downloads", async (req, res) => {
  try {
    const { integration: qb } = await getIntegrationConfig("qbittorrent");

    if (!qb.enabled) {
      return res
        .status(400)
        .json({ online: false, message: "qBittorrent not enabled" });
    }
    if (!qb.host || !qb.port || !qb.username || !qb.password) {
      return res
        .status(400)
        .json({ online: false, message: "qBittorrent not fully configured" });
    }

    const { baseUrl, cookie } = await qbitLogin(qb);

    const start = Date.now();
    const resp = await fetch(
      `${baseUrl}/api/v2/torrents/info?filter=downloading`,
      {
        headers: {
          Cookie: cookie
        }
      }
    );
    const latencyMs = Date.now() - start;

    if (!resp.ok) {
      return res.status(502).json({
        online: false,
        statusCode: resp.status,
        latencyMs
      });
    }

    const torrents = await resp.json();

    const downloads = torrents.map((t) => ({
      name: t.name,
      progressPercent: Math.round((t.progress || 0) * 100),
      downloadSpeed: t.dlspeed, // bytes/s
      eta: t.eta, // seconden
      size: t.size
    }));

    res.json({
      online: true,
      latencyMs,
      downloads
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      online: false,
      message: "Failed to fetch qBittorrent downloads"
    });
  }
});

// ====== OVERSEERR: REQUESTS ======

// GET /api/integrations/overseerr/requests
app.get("/api/integrations/overseerr/requests", async (req, res) => {
  try {
    const { integration: ovs } = await getIntegrationConfig("overseerr");

    if (!ovs.enabled) {
      return res
        .status(400)
        .json({ online: false, message: "Overseerr not enabled" });
    }
    if (!ovs.host || !ovs.port || !ovs.apiKey) {
      return res
        .status(400)
        .json({ online: false, message: "Overseerr not fully configured" });
    }

    const baseUrl = buildBaseUrl(ovs);
    const url = `${baseUrl}/api/v1/request?take=10&skip=0&sort=added`;

    const resp = await fetch(url, {
      headers: {
        "X-Api-Key": ovs.apiKey
      }
    });

    if (!resp.ok) {
      return res
        .status(502)
        .json({ online: false, statusCode: resp.status });
    }

    const data = await resp.json().catch(() => null);

    const items =
      data?.results?.map((r) => ({
        id: r.id,
        title: r.mediaInfo?.title ?? r.media?.title,
        type: r.type,
        status: r.status,
        requestedBy: r.requestedBy?.displayName,
        requestedAt: r.createdAt
      })) ?? [];

    res.json({
      online: true,
      requests: items
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      online: false,
      message: "Failed to fetch Overseerr requests"
    });
  }
});

// ====== STATIC FRONTEND (Vite build) ======

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

// ====== START ======

app.listen(PORT, () => {
  console.log(`ServerConnect draait op http://localhost:${PORT}`);
});
