import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function getDiff(oldText, newText) {
    let pos = 0;
    while (
        pos < oldText.length &&
        pos < newText.length &&
        oldText[pos] === newText[pos]
    ) {
        pos++;
    }
    // Deletion
    if (oldText.length > newText.length) {
        return { type: 'delete', position: pos, length: oldText.length - newText.length };
    }
    // Insertion
    if (newText.length > oldText.length) {
        return { type: 'insert', position: pos, text: newText.slice(pos) };
    }
    return null;
}

function App() {
    const [document, setDocument] = useState("");
    const [socket, setSocket] = useState(null);
    const debounceRef = useRef(null);
    const lastDocumentRef = useRef("");

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
                    lastDocumentRef.current = message.data;
                } else if (message.type === 'update') {
                    setDocument(message.data);
                    lastDocumentRef.current = message.data;
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

    useEffect(() => {
        lastDocumentRef.current = document;
    }, [document]);

    const handleChange = (e) => {
        const newDocument = e.target.value;
        setDocument(newDocument);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                const op = getDiff(lastDocumentRef.current, newDocument);
                if (op) {
                    socket.send(JSON.stringify(op));
                }
                lastDocumentRef.current = newDocument;
            }
        }, 200);
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