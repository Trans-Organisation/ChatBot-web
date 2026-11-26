import { useState, useEffect, useRef, type CSSProperties } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css';
import { getDisciplineTheme } from './theme/disciplines';
import transJuLogo from './assets/transJu-logo.png';

interface Message {
  sender: 'utilisateur' | 'ai';
  content: string;
}

interface AppProps {
  discipline?: string;
}

const QUICK_REPLIES_BY_DISCIPLINE: Record<string, string[]> = {
  trail: [
    "Quel est le matériel obligatoire en trail ?",
    "Retrait des dossards Transju' Trails : où et quand ?",
    "Quelles sont les barrières horaires du trail ?",
    "Quels sont les parcours et dénivelés ?",
  ],
  cyclo: [
    "Quels sont les parcours de La Transju' Cyclo ?",
    "Retrait des dossards Cyclo : où et quand ?",
    "Quelles sont les dates et horaires de départ ?",
    "Quel équipement est obligatoire à vélo ?",
  ],
  nordique: [
    "Quel est le matériel obligatoire en ski de fond ?",
    "Retrait des dossards Transju' : où et quand ?",
    "Quelles sont les distances en style classique et skating ?",
    "Quelles sont les barrières horaires ?",
  ],
  jeunes: [
    "Quelles sont les catégories d'âge pour La Transju' Jeunes ?",
    "Horaires et lieu de départ Transju' Jeunes",
    "Comment inscrire mon enfant ?",
    "Quel matériel faut-il prévoir ?",
  ],
  general: [
    "Quel est le matériel obligatoire ?",
    "Retrait des dossards : où et quand ?",
    "Quelles sont les dates des épreuves ?",
    "Quels sont les parcours proposés ?",
    "Infos sur La Transju' Cyclo",
    "Infos sur La Transju' Ski",
  ],
};

const DISCIPLINE_LABELS: Record<string, string> = {
  trail: "La Transju' Trails",
  cyclo: "La Transju' Cyclo",
  nordique: "La Transju' (Ski de fond)",
  jeunes: "La Transju' Jeunes",
};

function App({ discipline = 'general' }: AppProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const theme = getDisciplineTheme(discipline);
  const normalizedDiscipline = theme.key;
  const quickReplies = QUICK_REPLIES_BY_DISCIPLINE[normalizedDiscipline] || QUICK_REPLIES_BY_DISCIPLINE.general;
  const disciplineLabel = DISCIPLINE_LABELS[normalizedDiscipline];

  const themeStyle = {
    '--tj-primary': theme.primary,
    '--tj-accent': theme.accent,
    '--tj-accent-hover': theme.accentHover,
    '--tj-accent-text': theme.accentText,
    '--tj-header-border': theme.headerBorder,
  } as CSSProperties;

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

  const sendPromptMessage = async (textToSend: string) => {
    const trimmedMessage = textToSend.trim();
    if (!trimmedMessage || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { sender: 'utilisateur', content: trimmedMessage }]);
    setLoading(true);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmedMessage,
          sessionId,
          discipline: normalizedDiscipline,
        }),
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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    sendPromptMessage(input);
  };

  return (
    <div className="widget-wrapper" data-discipline={normalizedDiscipline} style={themeStyle}>
      {isOpen && (
        <div className={`chat-container ${isExpanded ? 'expanded' : ''}`}>
          <header className="chat-header">
            <div className="chat-header-title">
              <img
                src={transJuLogo}
                alt="Logo Transju"
                className="header-logo"
                onClick={startNewSession}
                title="Recommencer une nouvelle conversation"
              />
              <div className="header-title-group">
                <h1>Assistant Transju</h1>
                {theme.shortTag && (
                  <span className="discipline-badge">{theme.shortTag}</span>
                )}
              </div>
            </div>
            <div className="header-actions">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="icon-btn"
                title={isExpanded ? "Réduire la fenêtre" : "Agrandir la fenêtre"}
              >
                {isExpanded ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="10" y1="14" x2="3" y2="21" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                )}
              </button>
              <button onClick={() => setIsOpen(false)} className="icon-btn" title="Fermer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </header>

          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="welcome-message">
                <strong>
                  Bienvenue sur l'Assistant {disciplineLabel || "La Transju'"} !
                </strong>
                <br />
                Posez vos questions ou choisissez une question fréquente ci-dessous.
              </div>
            )}
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.sender}`}>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ))}
            {loading && <div className="message ai loading">L'assistant recherche les infos...</div>}
            <div ref={messagesEndRef} />
          </div>

          <div className="quick-replies-bar">
            {quickReplies.map((question, index) => (
              <button
                key={index}
                onClick={() => sendPromptMessage(question)}
                className="quick-reply-chip"
                disabled={loading}
              >
                {question}
              </button>
            ))}
          </div>

          <form onSubmit={sendMessage} className="chat-form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                disciplineLabel
                  ? `Posez votre question sur ${disciplineLabel}...`
                  : "Posez votre question sur La Transju..."
              }
              className="chat-input"
            />
            <button type="submit" disabled={loading} className="chat-button">
              Envoyer
            </button>
          </form>
        </div>
      )}

      <button className="chat-trigger-btn" onClick={() => setIsOpen(!isOpen)}>
        <img src={transJuLogo} alt="Logo Transju" className="trigger-logo" />
        <span>Besoin d'aide ?</span>
      </button>
    </div>
  );
}

export default App;