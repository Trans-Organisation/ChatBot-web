# 1. Utiliser une image officielle Node.js légère
FROM node:20-alpine

# 2. Définir le dossier de travail dans le conteneur
WORKDIR /usr/src/app

# 3. Copier les fichiers de gestion des paquets
COPY package*.json ./

# 4. Installer les dépendances
RUN npm install

# 5. Copier le reste du code source de l'application
COPY . .

# 6. Générer le client Prisma et compiler l'application Nest.js
RUN npx prisma generate
RUN npm run build

# 7. Exposer le port sur lequel tourne l'application
EXPOSE 3000

# 8. Commande pour lancer l'application en mode production
CMD ["node", "dist/main"]