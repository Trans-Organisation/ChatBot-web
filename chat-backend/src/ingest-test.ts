import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import { PrismaService } from './prisma/prisma.service.js';
import { VectorService } from './vector/vector.service.js';

/**
 * Découpe un texte long en blocs (chunks) intelligents avec chevauchement (overlap).
 * Découpe en priorité par paragraphes (\n\n), puis par phrases si un paragraphe est trop long.
 */
function splitTextIntoChunks(text: string, maxChunkSize = 1200, overlap = 200): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const cleanedPara = paragraph.trim();
    if (!cleanedPara) continue;

    // Si l'ajout du paragraphe dépasse la taille max du chunk
    if ((currentChunk + '\n\n' + cleanedPara).length > maxChunkSize) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }

      // Si un paragraphe dépasse à lui seul la taille max, on le découpe par phrase
      if (cleanedPara.length > maxChunkSize) {
        const sentences = cleanedPara.split(/(?<=[.!?])\s+/);
        currentChunk = '';
        for (const sentence of sentences) {
          if ((currentChunk + ' ' + sentence).length > maxChunkSize) {
            if (currentChunk.trim()) chunks.push(currentChunk.trim());
            const overlapText = currentChunk.slice(-overlap);
            currentChunk = overlapText + ' ' + sentence;
          } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          }
        }
      } else {
        // Conservation de la fin du chunk précédent pour le chevauchement (overlap)
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + '\n\n' + cleanedPara;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + cleanedPara;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function runPdfIngestion() {
  console.log('📄 Lecture du fichier PDF local avec pdf-parse...');
  
  let filePath = path.resolve('data/trail/reglement-trail-2027.pdf');
  if (!fs.existsSync(filePath)) {
    filePath = path.resolve('chat-backend/data/trail/reglement-trail-2027.pdf');
  }
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Fichier introuvable à l'emplacement : ${filePath}`);
    return;
  }

  // 1. Lecture du buffer du fichier PDF
  const dataBuffer = fs.readFileSync(filePath);

  // 2. Extraction du texte brut avec pdf-parse
  const pdfData = await pdf(dataBuffer);
  console.log(`📊 PDF chargé avec succès (${pdfData.numpages} page(s)).`);

  const fullText = pdfData.text;
  if (!fullText || fullText.trim().length === 0) {
    console.error('❌ Aucun texte extrait du PDF. Le fichier est peut-être un scan ou une image.');
    return;
  }

  // 3. Découpage récursif du texte avec chevauchement (overlap)
  console.log('✂️ Découpage du texte en chunks intelligents (max 1200 char, overlap 200 char)...');
  const chunks = splitTextIntoChunks(fullText, 1200, 200);
  console.log(`📦 Total de chunks générés : ${chunks.length}`);

  // 4. Initialisation des services Prisma & Vector
  const prisma = new PrismaService();
  await prisma.$connect();
  const vectorService = new VectorService(prisma);

  // 5. Ingestion et création des embeddings dans PostgreSQL (pgvector)
  for (let index = 0; index < chunks.length; index++) {
    const chunkText = chunks[index];

    await vectorService.addDocumentChunk(chunkText, {
      source: 'reglement-trail-2027.pdf',
      method: 'pdf-parse',
      part: index + 1,
      totalParts: chunks.length,
    });
    console.log(`⏳ Chunk ${index + 1}/${chunks.length} inséré.`);
  }

  console.log('🎉 Ingestion du PDF terminée avec succès !');
  await prisma.$disconnect();
}

runPdfIngestion().catch((error) => {
  console.error('❌ Erreur lors de l\'ingestion du PDF :', error);
  process.exit(1);
});