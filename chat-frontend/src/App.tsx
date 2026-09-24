import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css';

interface Message {
  sender: 'utilisateur' | 'ai';
  content: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let storedSessionId = localStorage.getItem('chat_session_id');
    if (!storedSessionId) {
      storedSessionId = `transju_session_${Date.now()}`;
      localStorage.setItem('chat_session_id', storedSessionId);
    }
    setSessionId(storedSessionId);
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen]);

  const startNewSession = () => {
    const newSessionId = `transju_session_${Date.now()}`;
    localStorage.setItem('chat_session_id', newSessionId);
    setSessionId(newSessionId);
    setMessages([]);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');

    setMessages((prev) => [...prev, { sender: 'utilisateur', content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userMessage, sessionId }),
      });

      if (!response.ok) throw new Error('Erreur de communication avec le serveur');

      const data = await response.json();

      setMessages((prev) => [...prev, { sender: 'ai', content: data.reply }]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { sender: 'ai', content: "Désolé, une erreur est survenue lors de la communication avec le serveur." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="widget-wrapper">
      {isOpen && (
        <div className="chat-container">
          <header className="chat-header">
            <div className="chat-header-title">
              <img src="/transJu-logo.png" alt="Logo Transju" className="header-logo" />
              <h1>Assistant Transju</h1>
            </div>
            <div className="header-actions">
              <button onClick={startNewSession} className="icon-btn" title="Nouvelle session">
                🔄
              </button>
              <button onClick={() => setIsOpen(false)} className="icon-btn" title="Fermer">
                ✖
              </button>
            </div>
          </header>

          <div className="chat-messages">
            {messages.length === 0 && (
              <p className="welcome-message">
                **Bienvenue sur l'Assistant La Transju !**<br />
                Posez-moi vos questions sur les épreuves, les parcours ou votre préparation.
              </p>
            )}
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.sender}`}>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ))}
            {loading && <div className="message ai loading">L'assistant recherche les infos...</div>}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="chat-form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez votre question sur La Transju..."
              className="chat-input"
            />
            <button type="submit" disabled={loading} className="chat-button">
              Envoyer
            </button>
          </form>
        </div>
      )}

      <button className="chat-trigger-btn" onClick={() => setIsOpen(!isOpen)}>
        <img src="/transJu-logo.png" alt="Logo Transju" className="trigger-logo" />
        <span>Besoin d'aide ?</span>
      </button>
    </div>
  );
}

export default App;