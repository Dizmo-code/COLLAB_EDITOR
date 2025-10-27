import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './App.css';

function App() {
  const [document, setDocument] = useState("");
  const [socket, setSocket] = useState(null);
  const debounceRef = useRef(null);

  const toolbarOptions = useMemo(() => [
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered'}, { list: 'bullet' }],
    ['clean'],
  ], []);

  useEffect(() => {
    const newSocket = new WebSocket('wss://collab-editor-edmo.onrender.com');
    setSocket(newSocket);

    newSocket.onopen = () => {
      console.log('WebSocket connection established');
    };

    newSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'init' || message.type === 'update') {
          setDocument(message.data); // Now holds HTML
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    newSocket.onclose = () => {
      console.log('WebSocket connection closed');
    };

    newSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      newSocket.close();
    };
  }, []);

  // Debounced handler for editor changes
  const handleChange = (content) => {
    setDocument(content);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'update', data: content })); // HTML content
      }
    }, 200);
  };

  return (
    <div className="App">
      <h1>Collaborative Editor</h1>
      <div className="editor-wrapper">
        <ReactQuill
          value={document}
          onChange={handleChange}
          modules={{ toolbar: toolbarOptions }}
          theme="snow"
        />
      </div>
      <footer>
        Built by <span>Harsh Kumar</span> & <span>Anuska Rai</span>
      </footer>
    </div>
  );
}

export default App;
