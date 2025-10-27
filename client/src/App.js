import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [document, setDocument] = useState('');
  const [socket, setSocket] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const newSocket = new window.WebSocket('wss://collab-editor-edmo.onrender.com');
    setSocket(newSocket);

    newSocket.onopen = () => {
      console.log('WebSocket connected');
    };

    newSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'init' || message.type === 'update') {
          setDocument(message.data);
        }
      } catch (err) {
        // ignore error
      }
    };

    newSocket.onclose = () => {
      console.log('WebSocket closed');
    };

    newSocket.onerror = (err) => {
      console.log('WebSocket error', err);
    };

    return () => {
      newSocket.close();
    };
  }, []);

  const handleChange = (e) => {
    const value = e.target.value;
    setDocument(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (socket && socket.readyState === 1) {
        socket.send(JSON.stringify({ type: 'update', data: value }));
      }
    }, 200); // adjust delay as needed
  };

  return (
    <div className="App">
      <h1>Collaborative Editor</h1>
      <textarea
        value={document}
        onChange={handleChange}
        rows={20}
        cols={80}
      />
      <footer>
        Built by <span>Harsh Kumar</span> & <span>Anuska Rai</span>
      </footer>
    </div>
  );
}

export default App;
