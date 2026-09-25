import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Mistral } from '@mistralai/mistralai';
import { PrismaService } from './prisma/prisma.service.js';
import { VectorService } from './vector/vector.service.js';

async function runOcrIngestion() {
  console.log('📄 Recherche et lecture du fichier PDF...');
  
  const filePath = path.resolve('data/trail/reglement-trail-2027.pdf');
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Fichier introuvable à l'emplacement : ${filePath}`);
    return;
  }

  // 1. Conversion du PDF local en Base64 Data URI pour Mistral OCR
  const fileBuffer = fs.readFileSync(filePath);
  const base64Pdf = fileBuffer.toString('base64');
  const dataUri = `data:application/pdf;base64,${base64Pdf}`;

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is not defined.');
  }

  const client = new Mistral({ apiKey });

  console.log('🔍 Analyse du document et des tableaux via Mistral OCR...');
  
  // 2. Appel de l'API Mistral OCR (conserve les tableaux et la structure)
  const ocrResponse = await client.ocr.process({
    model: 'mistral-ocr-latest',
    document: {
      type: 'document_url',
      documentUrl: dataUri,
    },
  });

  // 3. Concaténation de tout le texte Markdown extrait page par page
  let fullText = '';
  for (const page of ocrResponse.pages) {
    fullText += page.markdown + '\n\n';
  }

  console.log('✅ Extraction OCR réussie. Découpage et vectorisation...');

  const prisma = new PrismaService();
  await prisma.$connect();
  const vectorService = new VectorService(prisma);

  // 4. Découpage sécurisé par blocs pour ne pas dépasser les limites d'embedding
  const CHUNK_SIZE = 1500;
  const chunks: string[] = [];
  for (let i = 0; i < fullText.length; i += CHUNK_SIZE) {
    chunks.push(fullText.substring(i, i + CHUNK_SIZE));
  }

  // 5. Insertion des blocs dans la base de données PostgreSQL
  for (let index = 0; index < chunks.length; index++) {
    const chunkText = chunks[index].trim();
    if (chunkText.length < 20) continue;

    await vectorService.addDocumentChunk(chunkText, {
      source: 'reglement-trail-2027.pdf',
      method: 'mistral-ocr',
      part: index + 1,
    });
    console.log(`⏳ Bloc ${index + 1}/${chunks.length} inséré.`);
  }

  console.log('🎉 Ingestion OCR terminée avec succès ! Les tableaux sont désormais exploitables.');
  await prisma.$disconnect();
}

runOcrIngestion().catch((error) => {
  console.error('❌ Erreur lors de l\'ingestion OCR :', error);
  process.exit(1);
});