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

async function loadConfig() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveConfig(services) {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(services, null, 2), "utf-8");
}

// ====== MIDDLEWARE ======

app.use(cors({ origin: "*" }));
app.use(express.json());

// ====== API routes (beheren containers + status) ======

// Alle containers (ruwe config)
app.get("/api/containers", async (req, res) => {
  res.json(await loadConfig());
});

// Nieuwe container toevoegen
app.post("/api/containers", async (req, res) => {
  const { id, name, host, port, ...rest } = req.body;

  if (!id || !name || !host || !port) {
    return res.status(400).json({
      message: "Fields 'id', 'name', 'host' en 'port' zijn verplicht.",
    });
  }

  const items = await loadConfig();

  if (items.some((x) => x.id === id)) {
    return res.status(400).json({ message: `Container '${id}' bestaat al.` });
  }

  const newItem = { id, name, host, port, ...rest };
  items.push(newItem);

  await saveConfig(items);
  res.status(201).json(newItem);
});

// Container bijwerken
app.put("/api/containers/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const items = await loadConfig();
  const index = items.findIndex((x) => x.id === id);

  if (index === -1) {
    return res.status(404).json({ message: `Container '${id}' niet gevonden.` });
  }

  const updated = { ...items[index], ...updates, id };
  items[index] = updated;

  await saveConfig(items);
  res.json(updated);
});

// Container verwijderen
app.delete("/api/containers/:id", async (req, res) => {
  const { id } = req.params;

  const items = await loadConfig();
  const next = items.filter((x) => x.id !== id);

  if (next.length === items.length) {
    return res.status(404).json({ message: `Container '${id}' niet gevonden.` });
  }

  await saveConfig(next);
  res.status(204).send();
});

// Status van alle containers (in één call)
app.get("/api/containers/status", async (req, res) => {
  const items = await loadConfig();

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
});

// ====== STATIC FRONTEND (Vite build) ======

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "dist");

app.use(express.static(distPath));

// SPA fallback: alle non-API routes naar index.html
app.get("/*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ message: "API route not found" });
  }

  res.sendFile(path.join(distPath, "index.html"));
});

// ====== START ======

app.listen(PORT, () => {
  console.log(`ServerConnect draait op http://localhost:${PORT}`);
});
