import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
    const [document, setDocument] = useState("");
    const [socket, setSocket] = useState(null);
    const debounceRef = useRef(null);

    useEffect(() => {
        const newSocket = new WebSocket('wss://collab-editor-edmo.onrender.com');
        setSocket(newSocket);

        newSocket.onopen = () => {
            console.log('WebSocket connection established');
        };

        newSocket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'init') {
                    setDocument(message.data);
                } else if (message.type === 'update') {
                    setDocument(message.data);
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

    // Debounced handleChange
    const handleChange = (e) => {
        const newDocument = e.target.value;
        setDocument(newDocument);

        // Debounce sending updates to WebSocket
        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'update', data: newDocument }));
            }
        }, 200); // 200 ms debounce - change as needed
    };

    return (
        <div className="App">
            <h1>Collaborative Editor</h1>
            <textarea
                value={document}
                onChange={handleChange}
                rows="20"
                cols="80"
            />
             <footer>
            Built by <span>Harsh Kumar</span> & <span>Anuska Rai</span>
        </footer>
        </div>
    );
}

export default App;
