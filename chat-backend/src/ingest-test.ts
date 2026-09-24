import 'dotenv/config';
import { PrismaService } from './prisma/prisma.service.js';
import { VectorService } from './vector/vector.service.js';

async function bootstrap() {
  console.log('🌱 Initialisation des services...');
  
  const prisma = new PrismaService();
  await prisma.$connect();
  
  const vectorService = new VectorService(prisma);

  console.log('🌱 Ingestion des connaissances de La Transju...');

  const sampleData = [
    "La Transju'Trails aura lieu le 1er et 2 juin 2024. Le départ du 82km se fait à Morez.",
    "Pour La Transju' Ski, le matos obligatoire comprend les skis, les bâtons et une couverture de survie.",
    "La course Reine de La Transju' Ski fait 70 km en style libre entre Lamoura et Mouthe.",
    "Le retrait des dossards pour La Transju' Cyclo s'effectue au Palais des Sports de Champagnole.",
  ];

  for (const text of sampleData) {
    await vectorService.addDocumentChunk(text, { source: 'test-manual' });
    console.log(`✅ Ajouté : "${text}"`);
  }

  console.log('🎉 Ingestion terminée avec succès !');
  await prisma.$disconnect();
}

bootstrap().catch((error) => {
  console.error("❌ Erreur lors de l'ingestion :", error);
  process.exit(1);
});