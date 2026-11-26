# ChatBot-web — La TransJu'

Ce dépôt contient le code du chatbot RAG (*Retrieval-Augmented Generation*) destiné au site web de **La TransJu'**.  
Il s'appuie sur **Mistral AI** pour la génération de réponses et les embeddings, **NestJS** côté backend, **React + Vite** côté frontend, et **PostgreSQL (`pgvector`)** avec **Prisma** pour le stockage vectoriel et l'historique des conversations.

---

## 📁 Structure du projet

```text
Chat-Bot/
├── chat-backend/        # API NestJS, logique RAG, intégration Mistral AI & Prisma
├── chat-frontend/       # Interface web du chatbot (React + Vite)
├── data/                # Documents PDF sources pour la base de connaissances
├── cli-chatbot.ts       # Client terminal (CLI) pour tester le chatbot
├── docker-compose.yml   # Orchestration PostgreSQL + Backend + Frontend
└── package.json         # Scripts racine (lancement Docker)
```

---

## ✅ Prérequis

- **Avec Docker (recommandé)** :
  - [Docker](https://www.docker.com/) et Docker Compose
  - Une clé API **Mistral AI** (`MISTRAL_API_KEY`)
- **En local sans Docker** :
  - [Node.js](https://nodejs.org/) v20+ et `npm`
  - Une instance **PostgreSQL** avec l'extension [`pgvector`](https://github.com/pgvector/pgvector) activée
  - Une clé API **Mistral AI** (`MISTRAL_API_KEY`)

---

## ⚙️ Configuration

Créez un fichier `.env` à la racine du projet (utilisé par `docker-compose.yml`) :

```env
# Obligatoire : clé API Mistral AI
MISTRAL_API_KEY=votre_cle_api_mistral

# Optionnel : seuil de distance cosinus pour la recherche RAG (défaut : 0.55)
RAG_DISTANCE_THRESHOLD=0.55

# Optionnel : ingestion de pages web (le sitemap est prioritaire sur WEB_INGEST_URLS)
WEB_SITEMAP_URL=https://www.latransju.com/sitemap.xml
# WEB_INGEST_URLS=https://www.latransju.com/actualites,https://www.latransju.com/tarifs
```

> **Note (lancement hors Docker)** : si vous lancez les services manuellement sans Docker, renseignez également `DATABASE_URL` et `MISTRAL_API_KEY` dans `chat-backend/.env`, ainsi que `VITE_API_URL` dans `chat-frontend/.env` si le backend n'est pas sur `http://localhost:3000`.

---

## 🚀 Lancer le chatbot

### Option 1 : Avec Docker Compose (recommandé)

Depuis la racine du projet :

```bash
npm run dev
```
*(Équivalent à `docker compose up --build`.)*

Une fois les conteneurs démarrés :
- **Interface web (Frontend)** : http://localhost:5173
- **API Backend** : http://localhost:3000
- **PostgreSQL** : `localhost:5432`

Pour arrêter les conteneurs :

```bash
docker compose down
```

*(Ajoutez `-v` si vous souhaitez également supprimer le volume de la base de données.)*

---

### Option 2 : En développement local (sans Docker)

1. **Démarrer PostgreSQL** (avec `pgvector` activé) et vérifier `DATABASE_URL` dans `chat-backend/.env`.
2. **Lancer le backend** :
   ```bash
   cd chat-backend
   npm install
   npx prisma generate
   npx prisma db push
   npm run start:dev
   ```
3. **Lancer le frontend** (dans un autre terminal) :
   ```bash
   cd chat-frontend
   npm install
   npm run dev
   ```
4. Ouvrez http://localhost:5173 dans votre navigateur.

---

## 💬 Utiliser le chatbot

### 1. Via l'interface web
Ouvrez **http://localhost:5173** dans votre navigateur, puis saisissez directement votre question dans la fenêtre de discussion.

### 2. Via le client terminal (CLI)
Un script CLI est disponible à la racine pour tester rapidement le backend (qui doit tourner sur `http://localhost:3000`) :

```bash
npx tsx cli-chatbot.ts
```

Tapez votre message puis appuyez sur `Entrée`. Tapez `exit` pour quitter.

### 3. Via l'API HTTP
Vous pouvez interroger directement l'endpoint `POST /chat` :

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test-session-1", "content": "Quels sont les tarifs de La TransJu ?"}'
```

---

## 📚 Gestion de la base de connaissances (RAG)

Le chatbot s'appuie sur les documents indexés dans PostgreSQL (`pgvector`).

### Ingestion des PDF
Placez vos fichiers `.pdf` dans `data/` ou `chat-backend/data/`.  
L'auto-ingestion s'exécute au démarrage du backend. Pour la lancer manuellement :

```bash
# Avec Docker
docker exec chat-backend-1 npm run ingest

# En local (depuis chat-backend/)
npm run ingest
```

### Ingestion des pages web
Configurez `WEB_SITEMAP_URL` ou `WEB_INGEST_URLS` dans `.env`, puis exécutez :

```bash
# Avec Docker
docker exec chat-backend-1 npm run ingest:web

# Ou en passant des URLs directement
docker exec chat-backend-1 npm run ingest:web -- https://www.latransju.com/actualites
```

### Vider la base RAG
Précisez le périmètre souhaité (`web`, `pdf` ou `all`) :

```bash
docker exec chat-backend-1 npm run clear:rag -- --scope=web
docker exec chat-backend-1 npm run clear:rag -- --scope=pdf
docker exec chat-backend-1 npm run clear:rag -- --scope=all
```

Pour plus de détails sur le fonctionnement de l'ingestion, consultez [chat-backend/README.md](./chat-backend/README.md).

---

## 🧪 Tests et qualité (Backend)

Depuis le dossier `chat-backend/` :

```bash
npm test          # Tests unitaires (Vitest)
npm run test:e2e  # Tests end-to-end
npm run lint      # Vérification du code (oxlint)
```
