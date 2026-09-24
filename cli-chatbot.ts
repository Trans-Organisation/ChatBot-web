import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Génération d'un sessionId unique pour cette session de terminal
const sessionId = `cli_session_${Date.now()}`;
const API_URL = 'http://localhost:3000/chat';

console.log('🤖 Bienvenue dans le Chatbot CLI ! (Tapez "exit" pour quitter)');
console.log(`📌 Session ID actuel : ${sessionId}\n`);

const askQuestion = () => {
  rl.question('\nVous : ', async (input) => {
    const trimmedInput = input.trim();

    if (trimmedInput.toLowerCase() === 'exit') {
      console.log('Au revoir ! 👋');
      rl.close();
      process.exit(0);
    }

    if (!trimmedInput) {
      askQuestion();
      return;
    }

    try {
      console.log("⏳ L'IA réfléchit...");
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmedInput, sessionId }),
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const data = (await response.json()) as { reply: string };
      console.log(`\n🤖 Mistral : ${data.reply}`);
    } catch (error) {
      console.error('❌ Erreur de communication avec le serveur (Vérifiez que NestJS tourne sur le port 3000) :', error);
    }

    // On relance la question pour continuer la conversation
    askQuestion();
  });
};

askQuestion();