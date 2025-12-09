// server.js - backend + static frontend op poort 3232

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3232;

// ====== PADEN & CONFIG ======
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = process.env.CONFIG_DIR || "/app/data";
const CONFIG_PATH = path.join(CONFIG_DIR, "containers.config.json");
const DIST_PATH = path.join(__dirname, "dist");

// ====== HELPERS: CONFIG LADEN/OPSLAAN ======

async function ensureConfigDir() {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

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
        token: "",
      },
      qbittorrent: {
        enabled: false,
        name: "qBittorrent",
        host: "",
        port: 8080,
        protocol: "http",
        basePath: "",
        username: "admin",
        password: "",
      },
      overseerr: {
        enabled: false,
        name: "Overseerr",
        host: "",
        port: 5055,
        protocol: "http",
        basePath: "",
        apiKey: "",
      },
    },
  };
}

async function loadConfig() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    const data = JSON.parse(raw);

    const defaults = getDefaultConfig();

    return {
      version: data.version ?? defaults.version,
      containers: Array.isArray(data.containers) ? data.containers : [],
      integrations: {
        ...defaults.integrations,
        ...(data.integrations || {}),
      },
    };
  } catch {
    // als bestand niet bestaat of corrupt is
    return getDefaultConfig();
  }
}

async function saveConfig(cfg) {
  await ensureConfigDir();
  const toSave = {
    version: cfg.version ?? 1,
    containers: Array.isArray(cfg.containers) ? cfg.containers : [],
    integrations: cfg.integrations || {},
  };
  await fs.writeFile(
    CONFIG_PATH,
    JSON.stringify(toSave, null, 2),
    "utf-8"
  );
}

// ====== HELPERS: URL PARSEN & STATUSMAPPING ======

function parseServiceUrl(urlString) {
  try {
    const u = new URL(urlString);
    return {
      protocol: u.protocol.replace(":", "") || "http",
      host: u.hostname,
      port: u.port ? Number(u.port) : (u.protocol === "https:" ? 443 : 80),
      basePath: u.pathname === "/" ? "" : u.pathname,
    };
  } catch {
    return null;
  }
}

// Overseerr: status mapping (request.status + media.status)
function mapOverseerrStatus(request) {
  const reqStatus = request.status; // 1..3
  const mediaStatus = request.media?.status ?? 1; // 1..5

  // AVAILABLE gaat voor alles
  if (mediaStatus === 5) {
    return { code: "available", label: "Available" };
  }

  // pending/requested
  if (reqStatus === 1) {
    return { code: "requested", label: "Requested" };
  }

  // approved maar nog niet beschikbaar
  if (reqStatus === 2) {
    if (mediaStatus === 2 || mediaStatus === 3 || mediaStatus === 4) {
      return { code: "approved", label: "Approved" };
    }
    return { code: "approved", label: "Approved" };
  }

  if (reqStatus === 3) {
    return { code: "declined", label: "Declined" };
  }

  return { code: "unknown", label: "Unknown" };
}

// ====== MIDDLEWARE ======

app.use(cors({ origin: "*" }));
app.use(express.json());

// ====== API: CONTAINER CONFIG ======

// Alle containers (ruwe config)
app.get("/api/containers", async (req, res) => {
  const cfg = await loadConfig();
  res.json(cfg.containers || []);
});

// Nieuwe container toevoegen
app.post("/api/containers", async (req, res) => {
  try {
    const { id, name, url, description, iconName, color, apiKey } = req.body;

    if (!name || !url) {
      return res
        .status(400)
        .json({ message: "Fields 'name' en 'url' zijn verplicht." });
    }

    const parsed = parseServiceUrl(url);
    if (!parsed) {
      return res
        .status(400)
        .json({ message: "Kon de URL niet parsen. Gebruik een geldige URL." });
    }

    const cfg = await loadConfig();
    const containers = cfg.containers || [];

    const newId =
      id ||
      `svc-${Math.random().toString(36).slice(2, 8)}-${Date.now()
        .toString(16)
        .slice(-6)}`;

    if (containers.some((c) => c.id === newId)) {
      return res
        .status(400)
        .json({ message: `Container met id '${newId}' bestaat al.` });
    }

    const newContainer = {
      id: newId,
      name,
      description: description || "",
      url,
      apiKey: apiKey || "",
      iconName: iconName || "Box",
      color: color || "from-blue-500 to-blue-600",
      protocol: parsed.protocol,
      host: parsed.host,
      port: parsed.port,
      basePath: parsed.basePath || "",
    };

    containers.push(newContainer);
    cfg.containers = containers;
    await saveConfig(cfg);

    res.status(201).json(newContainer);
  } catch (err) {
    console.error("POST /api/containers error:", err);
    res
      .status(500)
      .json({ message: "Kon container niet opslaan", error: err.message });
  }
});

// Container bijwerken
app.put("/api/containers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const cfg = await loadConfig();
    const containers = cfg.containers || [];
    const index = containers.findIndex((c) => c.id === id);

    if (index === -1) {
      return res
        .status(404)
        .json({ message: `Container '${id}' niet gevonden.` });
    }

    let updated = {
      ...containers[index],
      ...updates,
    };

    if (updates.url) {
      const parsed = parseServiceUrl(updates.url);
      if (!parsed) {
        return res
          .status(400)
          .json({ message: "Kon de nieuwe URL niet parsen." });
      }
      updated = {
        ...updated,
        protocol: parsed.protocol,
        host: parsed.host,
        port: parsed.port,
        basePath: parsed.basePath || "",
      };
    }

    containers[index] = updated;
    cfg.containers = containers;
    await saveConfig(cfg);

    res.json(updated);
  } catch (err) {
    console.error("PUT /api/containers/:id error:", err);
    res
      .status(500)
      .json({ message: "Kon container niet bijwerken", error: err.message });
  }
});

// Container verwijderen
app.delete("/api/containers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const cfg = await loadConfig();
    const containers = cfg.containers || [];

    const next = containers.filter((c) => c.id !== id);
    if (next.length === containers.length) {
      return res
        .status(404)
        .json({ message: `Container '${id}' niet gevonden.` });
    }

    cfg.containers = next;
    await saveConfig(cfg);

    res.status(204).send();
  } catch (err) {
    console.error("DELETE /api/containers/:id error:", err);
    res
      .status(500)
      .json({ message: "Kon container niet verwijderen", error: err.message });
  }
});

// Status van alle containers
app.get("/api/containers/status", async (req, res) => {
  try {
    const cfg = await loadConfig();
    const containers = cfg.containers || [];

    const checks = await Promise.all(
      containers.map(async (svc) => {
        const protocol = svc.protocol || "http";
        const basePath = svc.basePath || "";
        const url = `${protocol}://${svc.host}:${svc.port}${basePath}`;

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
    res
      .status(500)
      .json({ message: "Kon containerstatus niet ophalen", error: err.message });
  }
});

// ====== API: INTEGRATION SETTINGS (Plex, qBittorrent, Overseerr) ======

const INTEGRATION_KEYS = ["plex", "qbittorrent", "overseerr"];

// GET settings voor een integratie
app.get("/api/integrations/:id/settings", async (req, res) => {
  const { id } = req.params;
  if (!INTEGRATION_KEYS.includes(id)) {
    return res.status(404).json({ message: `Unknown integration '${id}'` });
  }

  const cfg = await loadConfig();
  const defaults = getDefaultConfig().integrations[id];

  const settings = {
    ...defaults,
    ...(cfg.integrations?.[id] || {}),
  };

  res.json(settings);
});

// UPDATE settings voor een integratie
app.post("/api/integrations/:id/settings", async (req, res) => {
  try {
    const { id } = req.params;
    if (!INTEGRATION_KEYS.includes(id)) {
      return res.status(404).json({ message: `Unknown integration '${id}'` });
    }

    const body = req.body || {};
    const cfg = await loadConfig();
    const defaults = getDefaultConfig().integrations[id];

    const current = cfg.integrations?.[id] || defaults;

    const updated = {
      ...current,
      ...body,
    };

    cfg.integrations = {
      ...(cfg.integrations || {}),
      [id]: updated,
    };

    await saveConfig(cfg);
    res.json(updated);
  } catch (err) {
    console.error("POST /api/integrations/:id/settings error:", err);
    res.status(500).json({
      message: "Kon integratie-instellingen niet opslaan",
      error: err.message,
    });
  }
});

// ====== API: PLEX (Now Playing) ======

app.get("/api/integrations/plex/now-playing", async (req, res) => {
  try {
    const cfg = await loadConfig();
    const plex = cfg.integrations?.plex;

    if (!plex || !plex.enabled) {
      return res
        .status(400)
        .json({ message: "Plex integration not configured or disabled" });
    }

    const { host, port, protocol = "http", basePath = "", token } = plex;

    if (!host || !port || !token) {
      return res
        .status(400)
        .json({ message: "Plex settings incomplete (host/port/token)" });
    }

    // Plex API: /status/sessions (XML)
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
        message: "Failed to fetch sessions from Plex",
        status: response.status,
        body: text.slice(0, 500),
      });
    }

    const xml = await response.text();

    // We doen een hele simpele "arme" XML parsing om titels te pakken
    const items = [];
    const videoRegex =
      /<Video\b([^>]*)>([\s\S]*?)<\/Video>/gim;

    let match;
    while ((match = videoRegex.exec(xml))) {
      const attrs = match[1];

      const titleMatch = attrs.match(/\btitle="([^"]*)"/);
      const grandparentTitleMatch = attrs.match(
        /\bgrandparentTitle="([^"]*)"/
      );
      const typeMatch = attrs.match(/\btype="([^"]*)"/);
      const userMatch = match[2].match(
        /<User[^>]*title="([^"]*)"[^>]*\/>/
      );
      const thumbMatch = attrs.match(/\bthumb="([^"]*)"/);

      items.push({
        title:
          (grandparentTitleMatch && grandparentTitleMatch[1]) ||
          (titleMatch && titleMatch[1]) ||
          "Unknown",
        user: userMatch ? userMatch[1] : "Unknown",
        type: typeMatch ? typeMatch[1] : "unknown",
        thumb: thumbMatch ? thumbMatch[1] : null,
      });
    }

    res.json({
      source: "plex",
      count: items.length,
      items,
    });
  } catch (err) {
    console.error("GET /api/integrations/plex/now-playing error:", err);
    res.status(500).json({
      message: "Error while talking to Plex",
      error: err.message,
    });
  }
});

// ====== API: QBittorrent (Downloads) ======

async function qbittorrentLogin(baseUrl, username, password) {
  const resp = await fetch(`${baseUrl}/api/v2/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `username=${encodeURIComponent(
      username
    )}&password=${encodeURIComponent(password)}`,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `qBittorrent login failed: ${resp.status} ${text.slice(0, 500)}`
    );
  }

  const cookie = resp.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("qBittorrent login failed: no cookie received");
  }

  return cookie;
}

app.get("/api/integrations/qbittorrent/downloads", async (req, res) => {
  try {
    const cfg = await loadConfig();
    const qb = cfg.integrations?.qbittorrent;

    if (!qb || !qb.enabled) {
      return res
        .status(400)
        .json({ message: "qBittorrent integration not configured or disabled" });
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
        message: "qBittorrent settings incomplete (host/port/username/password)",
      });
    }

    const baseUrl = `${protocol}://${host}:${port}${basePath || ""}`;
    const limit = Number(req.query.take || 5);

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
        message: "Failed to fetch torrents from qBittorrent",
        status: resp.status,
        body: text.slice(0, 500),
      });
    }

    const torrents = await resp.json();

    const downloading = torrents
      .filter((t) => !t.completed && t.state !== "pausedUP")
      .sort((a, b) => b.added_on - a.added_on)
      .slice(0, limit)
      .map((t) => {
        const progress = Math.round((t.progress || 0) * 100);
        const speedMBs = (t.dlspeed || 0) / (1024 * 1024);
        const etaSeconds = t.eta || 0;

        let eta;
        if (etaSeconds <= 0 || etaSeconds > 7 * 24 * 3600) {
          eta = "∞";
        } else if (etaSeconds < 60) {
          eta = `${etaSeconds}s`;
        } else if (etaSeconds < 3600) {
          eta = `${Math.round(etaSeconds / 60)}m`;
        } else {
          const h = Math.floor(etaSeconds / 3600);
          const m = Math.round((etaSeconds % 3600) / 60);
          eta = `${h}h ${m}m`;
        }

        return {
          name: t.name,
          progress,
          speed: `${speedMBs.toFixed(1)} MB/s`,
          eta,
          state: t.state,
        };
      });

    res.json({
      source: "qbittorrent",
      count: downloading.length,
      items: downloading,
    });
  } catch (err) {
    console.error(
      "GET /api/integrations/qbittorrent/downloads error:",
      err
    );
    res.status(500).json({
      message: "Error while talking to qBittorrent",
      error: err.message,
    });
  }
});

// ====== API: OVERSEERR (Requests met requested/approved/available + titels) ======

async function fetchOverseerrJson(url, apiKey) {
  const resp = await fetch(url, {
    headers: {
      "X-Api-Key": apiKey,
      Accept: "application/json",
    },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Overseerr request failed: ${resp.status} ${text.slice(0, 500)}`
    );
  }

  return resp.json();
}

app.get("/api/integrations/overseerr/requests", async (req, res) => {
  try {
    const cfg = await loadConfig();
    const ov = cfg.integrations?.overseerr;

    if (!ov || !ov.enabled) {
      return res.status(400).json({
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
        message: "Overseerr settings incomplete (host/port/apiKey)",
      });
    }

    const limit = Number(req.query.take || 10);
    const filter = req.query.filter || "all"; // jij kunt deze parameter gebruiken in je UI

    const baseUrl = `${protocol}://${host}:${port}${basePath || ""}/api/v1`;

    const listUrl = `${baseUrl}/request?take=${encodeURIComponent(
      limit
    )}&skip=0&sort=added&filter=${encodeURIComponent(filter)}`;

    const json = await fetchOverseerrJson(listUrl, apiKey);

    const results = Array.isArray(json.results) ? json.results : [];

    // Optioneel: titels verrijken via /movie/{id} of /tv/{id}
    // We doen dit alleen als we geen bruikbare titel in de request zelf hebben.
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
          const tv = await fetchOverseerrJson(`${baseUrl}/tv/${tmdbId}`, apiKey);
          return tv.name || tv.originalName || "Unknown series";
        }
      } catch (err) {
        console.warn("Could not fetch media details from Overseerr:", err);
      }

      return "Unknown";
    }

    // Promise.all voor titels
    const enriched = await Promise.all(
      results.map(async (item) => {
        const status = mapOverseerrStatus(item);

        // user info
        const requestedBy =
          item.requestedBy?.username ||
          item.requestedBy?.plexUsername ||
          item.requestedBy?.email ||
          "Unknown";

        const media = item.media || item.mediaInfo || {};
        const mediaType = media.mediaType || media.type || "unknown";

        const title = await enrichTitle(item);

        return {
          id: item.id,
          title,
          user: requestedBy,
          mediaType,
          statusCode: status.code, // 'requested' | 'approved' | 'available' | ...
          statusLabel: status.label,
          rawRequestStatus: item.status,
          rawMediaStatus: media.status,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      })
    );

    res.json({
      source: "overseerr",
      filter,
      total: json.pageInfo?.results ?? enriched.length,
      results: enriched,
    });
  } catch (err) {
    console.error("GET /api/integrations/overseerr/requests error:", err);
    res.status(500).json({
      message: "Error while talking to Overseerr",
      error: err.message,
    });
  }
});

// ====== STATIC FRONTEND (Vite build) ======

app.use(express.static(DIST_PATH));

// SPA fallback: alle non-API routes naar index.html
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ message: "API route not found" });
  }
  res.sendFile(path.join(DIST_PATH, "index.html"));
});

// ====== START ======

app.listen(PORT, () => {
  console.log(`ServerDashboard draait op http://localhost:${PORT}`);
});
