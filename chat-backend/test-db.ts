import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Connexion à PostgreSQL...');

  // Créer un message de test
  const msg = await prisma.message.create({
    data: {
      content: 'Message de test',
      sender: 'utilisateur',
      sessionId: 'session_001',
    },
  });
  console.log(' Message créé en BDD :', msg);

  // Compter le nombre de messages
  const count = await prisma.message.count();
  console.log(` Nombre total de messages : ${count}`);
}

main()
  .catch((err) => console.error(' Erreur de connexion BDD :', err))
  .finally(async () => await prisma.$disconnect());
