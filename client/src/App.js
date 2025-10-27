import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import "./App.css";

function App() {
  const [documentText, setDocumentText] = useState("");
  const [socket, setSocket] = useState(null);
  const [isLightMode, setIsLightMode] = useState(false);
  const debounceRef = useRef(null);

  // --- Connect WebSocket ---
  useEffect(() => {
    const socketURL =
      window.location.hostname === "localhost"
        ? "http://localhost:5000"
        : "https://collab-editor-edmo.onrender.com";

    const newSocket = io(socketURL, {
      transports: ["websocket"],
      reconnection: true,
    });

    setSocket(newSocket);

    newSocket.on("connect", () => console.log("🟢 Connected"));
    newSocket.on("init", (data) => setDocumentText(data));
    newSocket.on("update", (data) => setDocumentText(data));

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // --- Debounced text sync ---
  const handleChange = (e) => {
    const value = e.target.value;
    setDocumentText(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (socket) socket.emit("update", value);
    }, 200);
  };

  // --- Handle theme toggle ---
  const toggleMode = () => {
    setIsLightMode((prev) => !prev);
  };

  // --- Apply theme to body AFTER React updates ---
  useEffect(() => {
    if (typeof document !== "undefined" && document.body) {
      if (isLightMode) {
        document.body.classList.add("light-body");
      } else {
        document.body.classList.remove("light-body");
      }
    }
  }, [isLightMode]);

  return (
    <div className={`App ${isLightMode ? "light-mode" : ""}`}>
      <button className="mode-toggle" onClick={toggleMode}>
        {isLightMode ? "🌙 Dark Mode" : "☀️ Light Mode"}
      </button>

      <h1>Collaborative Editor</h1>

      <div className="editor-wrapper">
        <textarea
          value={documentText}
          onChange={handleChange}
          rows={20}
          cols={80}
          placeholder="Start typing and watch it sync..."
        />
      </div>

      <footer>
        <p>
          Built by <span>Harsh Kumar</span> & <span>Anuska Rai</span>
        </p>
      </footer>
    </div>
  );
}

export default App;
