const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.IO server
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for Render deployment
    methods: ["GET", "POST"]
  }
});

// Shared document (like before)
let document = "";

// When a new client connects
io.on("connection", (socket) => {
  console.log("🟢 New client connected:", socket.id);

  // Send current document to the new client
  socket.emit("init", document);

  // Handle incoming updates from clients
  socket.on("update", (data) => {
    document = data; // Store the latest version
    socket.broadcast.emit("update", data); // Broadcast to others
  });

  // Handle disconnects
  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server is listening on port ${PORT}`);
});
