const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// The shared document content (string)
let document = "";

wss.on("connection", (ws) => {
  console.log("🟢 New client connected!");

  // Send current document to new client
  ws.send(JSON.stringify({ type: "init", data: document }));

  ws.on("message", (message) => {
    try {
      const parsedMessage = JSON.parse(message);

      // Accept document update from client
      if (parsedMessage.type === "update") {
        document = parsedMessage.data;
        broadcastDocument();
      }
      // Optionally handle initial sync or other simple types here

    } catch (error) {
      console.error("❗ Error parsing message:", error);
    }
  });

  ws.on("close", () => {
    console.log("🔴 Client disconnected!");
  });
});

/**
 * Broadcast the current document to all connected clients
 */
function broadcastDocument() {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "update", data: document }));
    }
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server is listening on port ${PORT}`);
});
