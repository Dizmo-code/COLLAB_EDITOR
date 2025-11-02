import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import "./App.css";

function App() {
  const [documentText, setDocumentText] = useState("");
  const [socket, setSocket] = useState(null);
  const [isLightMode, setIsLightMode] = useState(false);
  const [name, setName] = useState("");
  const [inputName, setInputName] = useState("");
  const [users, setUsers] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);

  // ETag and debounce refs
  const currentETagRef = useRef(null);
  const updateDebounceRef = useRef(null);
  const typingTimeout = useRef(null);

  // Resolve backend base URL (use env var or fallback URLs)
  const BACKEND_URL =
    process.env.REACT_APP_BACKEND_URL ||
    (window.location.hostname === "localhost"
      ? "http://localhost:5000"
      : "https://collab-editor-edmo.onrender.com");

  // Socket connection and listeners
  useEffect(() => {
    const s = io(BACKEND_URL, { transports: ["websocket"], reconnection: true });
    setSocket(s);

    const onConnect = () => console.log("🟢 Connected");
    const onInit = (data) => setDocumentText(data);
    const onUpdate = (data) => setDocumentText(data);
    const onUsers = (userList) => setUsers(userList);
    const onTyping = (user) => setTypingUser(user);

    s.on("connect", onConnect);
    s.on("init", onInit);
    s.on("update", onUpdate);
    s.on("users", onUsers);
    s.on("typing", onTyping);

    return () => {
      s.off("connect", onConnect);
      s.off("init", onInit);
      s.off("update", onUpdate);
      s.off("users", onUsers);
      s.off("typing", onTyping);
      s.disconnect();
    };
  }, [BACKEND_URL]);

  // List files
  const fetchFiles = useCallback(() => {
    fetch(`${BACKEND_URL}/files`, { headers: { Accept: "application/json" } })
      .then((res) => res.json())
      .then(setFiles)
      .catch(() => setFiles([]));
  }, [BACKEND_URL]);
  useEffect(fetchFiles, [fetchFiles]);

  // Load selected file with ETag/304 support
  useEffect(() => {
    if (!selectedFile) return;
    const controller = new AbortController();
    const headers = {};
    if (currentETagRef.current) headers["If-None-Match"] = currentETagRef.current;

    fetch(`${BACKEND_URL}/files/${encodeURIComponent(selectedFile)}`, {
      method: "GET",
      headers,
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 304) return;
        if (!res.ok) throw new Error("Fetch failed");
        const etag = res.headers.get("ETag");
        if (etag) currentETagRef.current = etag;
        const body = await res.json();
        setDocumentText(body.content || "");
      })
      .catch(() => {});

    return () => controller.abort();
  }, [selectedFile, BACKEND_URL]);

  // Create new file
  const handleSaveNew = () => {
    const fileName = window.prompt("Enter file name:");
    if (!fileName) return;
    fetch(`${BACKEND_URL}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ name: fileName, content: documentText }),
    }).then(async (res) => {
      if (res.status === 201) {
        await fetchFiles();
        const created = await res.json().catch(() => null);
        if (created?.id) setSelectedFile(created.id);
      } else if (res.status === 409) {
        window.alert("File already exists.");
      } else {
        window.alert("Create failed.");
      }
    });
  };

  // Save current file with If-Match optimistic concurrency
  const saveCurrentFile = async () => {
    if (!selectedFile) return handleSaveNew();
    const headers = { "Content-Type": "application/json", Accept: "application/json" };
    if (currentETagRef.current) headers["If-Match"] = currentETagRef.current;

    const res = await fetch(`${BACKEND_URL}/files/${encodeURIComponent(selectedFile)}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ content: documentText }),
    });

    if (res.status === 412) {
      window.alert("File changed on server. Reloading latest copy.");
      currentETagRef.current = null;
      setSelectedFile((id) => id); // retrigger fetch
      return;
    }
    if (!res.ok) {
      window.alert("Save failed.");
      return;
    }
    const etag = res.headers.get("ETag");
    if (etag) currentETagRef.current = etag;
  };

  // Name submit
  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (socket && inputName.trim()) {
      const clean = inputName.trim().slice(0, 20);
      setName(clean);
      socket.emit("set_name", clean);
    }
  };

  // Typing indicator logic
  const startTyping = useCallback(() => {
    if (!socket) return;
    socket.emit("start_typing");
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("stop_typing");
    }, 1000);
  }, [socket]);

  // Debounced content sync
  const sendUpdate = useCallback(
    (value) => {
      if (!socket) return;
      socket.emit("update", value);
    },
    [socket]
  );

  // Handle textarea changes
  const handleChange = (e) => {
    const value = e.target.value;
    setDocumentText(value);
    startTyping();
    if (updateDebounceRef.current) clearTimeout(updateDebounceRef.current);
    updateDebounceRef.current = setTimeout(() => sendUpdate(value), 250);
  };

  // Theme toggle (adds/removes class on body)
  const toggleMode = () => setIsLightMode((v) => !v);
  useEffect(() => {
    if (typeof document !== "undefined" && document.body) {
      document.body.classList.toggle("light-body", isLightMode);
    }
  }, [isLightMode]);

  // Show name entry if no name set yet
  if (!name) {
    return (
      <div className="name-gate">
        <form onSubmit={handleNameSubmit} className="name-card name-card--xl">
          <h2 className="name-title">Enter Your Name</h2>
          <p className="name-sub">Pick any display name. You can change it later.</p>
          <div className="name-form">
            <label htmlFor="name-input" className="sr-only">Your name</label>
            <input
              id="name-input"
              type="text"
              value={inputName}
              maxLength={20}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="e.g., Harsh"
              required
              autoFocus
            />
            <button type="submit" className="primary-btn">Join</button>
          </div>
        </form>
      </div>
    );
  }

  // Sidebar with files and actions
  const sidebar = (
    <div className="sidebar">
      <div className="sidebar-header">Files</div>
      <div className="sidebar-actions">
        <button className="save-btn" onClick={handleSaveNew}>+ Save New</button>
        <button className="save-btn" onClick={saveCurrentFile}>💾 Save</button>
      </div>
      <ul>
        {files.map((f) => (
          <li
            key={f.id}
            className={selectedFile === f.id ? "active" : ""}
            onClick={() => {
              currentETagRef.current = null;
              setSelectedFile(f.id);
            }}
          >
            {f.name}
          </li>
        ))}
      </ul>
    </div>
  );

  // Main UI with sidebar and editor
  return (
    <div className="main-layout">
      {sidebar}
      <div className={`content ${isLightMode ? "light-mode" : ""}`}>
        <button className="mode-toggle" onClick={toggleMode}>
          {isLightMode ? "🌙 Dark Mode" : "☀ Light Mode"}
        </button>
        <h1>Collaborative Editor</h1>
        <div className="users-line">
          Users: <span className="users-list">{users.join(", ")}</span>
        </div>
        <div className="editor-wrapper">
          <textarea
            value={documentText}
            onChange={handleChange}
            placeholder="Start typing and watch it sync..."
          />
        </div>
        <div className="typing-indicator">
          {typingUser && typingUser !== name && <span>✏ {typingUser} is typing...</span>}
          {typingUser === name && <span>✏ You are typing...</span>}
        </div>
        <footer>
          <p>
            Built by <span>Harsh Kumar</span> & <span>Anuska Rai</span>
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
