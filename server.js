// server.js - production-ready for Render + Vercel
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs/promises");
const fssync = require("fs");
const path = require("path");
const crypto = require("crypto");

// -----------------------------
// Config: FRONTEND_URL (set on Render)
// -----------------------------
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000"; // set to https://collab-editor-wheat.vercel.app in Render env

// -----------------------------
// Constants + storage dir
// -----------------------------
const savedDir = path.join(__dirname, "savedfiles");
if (!fssync.existsSync(savedDir)) fssync.mkdirSync(savedDir, { recursive: true });

// NOTE: Render's filesystem is ephemeral on free/standard services — savedfiles will not persist across restarts.
// For persistent storage use a DB or S3/persistent disk in production.

// -----------------------------
// Express setup
// -----------------------------
const app = express();

// Use a restricted CORS origin for production (safer than "*")
app.use(
  cors({
    origin: FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

app.use(express.json({ limit: "1mb" })); // prevent huge payloads

// -----------------------------
// HTTP server + Socket.IO
// -----------------------------
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
  },
});

// -----------------------------
// In-memory collaboration state (demo)
// -----------------------------
let document = "";
let users = {};
let currentlyTyping = null;

// -----------------------------
// Helpers: filename sanitization, safe resolve, ETag
// -----------------------------
const FILENAME_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
function sanitizeName(name) {
  if (!FILENAME_REGEX.test(name)) return null;
  return name;
}
function filePathFromId(id) {
  const base = path.basename(id);
  if (!base.endsWith(".txt")) return null;
  const abs = path.join(savedDir, base);
  const resolved = path.resolve(abs);
  if (!resolved.startsWith(path.resolve(savedDir) + path.sep)) return null;
  return resolved;
}
function filePathFromName(name) {
  const clean = sanitizeName(name);
  if (!clean) return null;
  return path.join(savedDir, `${clean}.txt`);
}
async function computeETag(content) {
  const hash = crypto.createHash("sha1").update(content).digest("hex");
  return `"${hash}"`;
}

// -----------------------------
// File API Endpoints
// -----------------------------

// List all files (name + id)
app.get("/files", async (req, res) => {
  try {
    const entries = await fs.readdir(savedDir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && e.name.endsWith(".txt"))
      .map((e) => {
        const name = e.name.replace(/\.txt$/, "");
        return { name, id: e.name };
      });
    res.json(files);
  } catch (e) {
    res.status(500).json({ error: "List failed" });
  }
});

// Get a file's content (+ ETag + If-None-Match)
app.get("/files/:id", async (req, res) => {
  try {
    const p = filePathFromId(req.params.id);
    if (!p || !fssync.existsSync(p)) return res.status(404).json({ error: "Not found" });
    const content = await fs.readFile(p, "utf8");
    const etag = await computeETag(content);
    if (req.headers["if-none-match"] === etag) return res.status(304).end();
    res.set("ETag", etag);
    res.json({ name: req.params.id.replace(/\.txt$/, ""), content });
  } catch {
    res.status(500).json({ error: "Read failed" });
  }
});

// Create a new file (no overwrite)
app.post("/files", async (req, res) => {
  try {
    const { name, content = "" } = req.body || {};
    const p = filePathFromName(name);
    if (!p) return res.status(400).json({ error: "Invalid name" });
    const id = path.basename(p);
    // flag 'wx' ensures atomic fail-if-exists
    await fs.writeFile(p, content, { encoding: "utf8", flag: "wx", mode: 0o644 });
    res.status(201).json({ name, content, id });
  } catch (e) {
    if (e && e.code === "EEXIST") return res.status(409).json({ error: "Already exists" });
    res.status(500).json({ error: "Create failed" });
  }
});

// Update an existing file (If-Match support)
app.put("/files/:id", async (req, res) => {
  try {
    const p = filePathFromId(req.params.id);
    if (!p || !fssync.existsSync(p)) return res.status(404).json({ error: "Not found" });
    const { content = "" } = req.body || {};
    // Optional optimistic concurrency via If-Match
    const current = await fs.readFile(p, "utf8");
    const currentEtag = await computeETag(current);
    const ifMatch = req.headers["if-match"];
    if (ifMatch && ifMatch !== currentEtag) {
      return res.status(412).json({ error: "Precondition Failed" });
    }
    // Atomic write: write tmp then rename
    const tmp = p + "." + crypto.randomUUID() + ".tmp";
    await fs.writeFile(tmp, content, { encoding: "utf8", flag: "w", mode: 0o644 });
    await fs.rename(tmp, p);
    const newTag = await computeETag(content);
    res.set("ETag", newTag);
    res.json({ name: req.params.id.replace(/\.txt$/, ""), content, id: req.params.id });
  } catch {
    res.status(500).json({ error: "Update failed" });
  }
});

// Delete a file
app.delete("/files/:id", async (req, res) => {
  try {
    const p = filePathFromId(req.params.id);
    if (!p || !fssync.existsSync(p)) return res.json({ success: true });
    await fs.unlink(p);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Delete failed" });
  }
});

// -----------------------------
// WebSocket Collaboration
// -----------------------------
io.on("connection", (socket) => {
  // Send current document to new client
  socket.emit("init", document);

  // Set display name for user
  socket.on("set_name", (name) => {
    const clean = String(name || "").slice(0, 40);
    users[socket.id] = { name: clean || "Guest" };
    io.emit("users", Object.values(users).map((u) => u.name));
  });

  // Blind overwrite update (demo). In production use OT/CRDT.
  socket.on("update", (data) => {
    document = String(data || "");
    socket.broadcast.emit("update", document);
  });

  socket.on("start_typing", () => {
    currentlyTyping = socket.id;
    io.emit("typing", users[socket.id]?.name || "Someone");
  });

  socket.on("stop_typing", () => {
    if (currentlyTyping === socket.id) {
      currentlyTyping = null;
      io.emit("typing", null);
    }
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    if (currentlyTyping === socket.id) {
      currentlyTyping = null;
      io.emit("typing", null);
    }
    io.emit("users", Object.values(users).map((u) => u.name));
  });
});

// -----------------------------
// Health check root
// -----------------------------
app.get("/", (req, res) => {
  res.send("✅ Collaborative Editor Backend is running!");
});

// -----------------------------
// Start server
// -----------------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT} (FRONTEND_URL=${FRONTEND_URL})`));
