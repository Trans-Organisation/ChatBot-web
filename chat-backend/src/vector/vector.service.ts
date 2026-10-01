import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Mistral } from '@mistralai/mistralai';
import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';

function splitTextIntoChunks(text: string, maxChunkSize = 1200, overlap = 200): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const cleanedPara = paragraph.trim();
    if (!cleanedPara) continue;

    if ((currentChunk + '\n\n' + cleanedPara).length > maxChunkSize) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }

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

@Injectable()
export class VectorService implements OnModuleInit {
  private readonly logger = new Logger(VectorService.name);
  private mistral: Mistral;

  constructor(private readonly prisma: PrismaService) {
    this.mistral = new Mistral({
      apiKey: process.env.MISTRAL_API_KEY,
    });
  }

  async onModuleInit() {
    try {
      await this.autoIngestPdf();
    } catch (error) {
      this.logger.error('Erreur lors de l\'auto-ingestion du PDF :', error);
    }
  }

  private async autoIngestPdf() {
    const pdfFileName = 'reglement-trail-2027.pdf';
    
    // Recherche dynamique du fichier PDF en local et dans le conteneur Docker
    const possiblePaths = [
      path.join(process.cwd(), 'data', 'trail', pdfFileName),
      path.join(process.cwd(), 'chat-backend', 'data', 'trail', pdfFileName),
      path.join(process.cwd(), '..', 'data', 'trail', pdfFileName),
    ];

    const filePath = possiblePaths.find((p) => fs.existsSync(p));

    if (!filePath) {
      this.logger.warn(`⚠️ Fichier ${pdfFileName} introuvable dans les dossiers scannés.`);
      return;
    }

    // Vérification de la présence des chunks en BDD (dédoublonnage)
    const existing = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM document_chunks WHERE metadata->>'source' = ${pdfFileName}
    `;

    const existingCount = Number(existing[0]?.count || 0);

    if (existingCount > 0) {
      this.logger.log(`ℹ️ Le document '${pdfFileName}' est déjà indexé en BDD (${existingCount} chunks existants). Ingestion ignorée.`);
      return;
    }

    this.logger.log(`📄 Début de l'ingestion automatique de : ${filePath}`);
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf(dataBuffer);

    if (!pdfData.text || pdfData.text.trim().length === 0) {
      this.logger.error(`❌ Impossible d'extraire du texte du PDF : ${pdfFileName}`);
      return;
    }

    const chunks = splitTextIntoChunks(pdfData.text, 1200, 200);
    this.logger.log(`✂️ Découpage effectué : ${chunks.length} chunks générés.`);

    for (let i = 0; i < chunks.length; i++) {
      await this.addDocumentChunk(chunks[i], {
        source: pdfFileName,
        method: 'auto-ingest-pdf',
        part: i + 1,
        totalParts: chunks.length,
      });
    }

    this.logger.log(`🎉 Ingestion automatique terminée avec succès pour '${pdfFileName}' (${chunks.length} chunks insérés).`);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.mistral.embeddings.create({
      model: 'mistral-embed',
      inputs: [text],
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding) {
      throw new Error("Impossible de générer l'embedding depuis l'API Mistral.");
    }

    return embedding;
  }

  async addDocumentChunk(content: string, metadata: Record<string, any> = {}) {
    const embedding = await this.generateEmbedding(content);
    const vectorString = `[${embedding.join(',')}]`;

    // Exécution de la requête SQL vectorielle
    await this.prisma.$executeRaw`
      INSERT INTO document_chunks (id, content, metadata, embedding, "createdAt")
      VALUES (gen_random_uuid(), ${content}, ${JSON.stringify(metadata)}::jsonb, ${vectorString}::vector, NOW())
    `;
  }

  async searchSimilarChunks(query: string, limit = 3): Promise<Array<{ content: string; metadata: any }>> {
    const queryEmbedding = await this.generateEmbedding(query);
    const vectorString = `[${queryEmbedding.join(',')}]`;

    const results = await this.prisma.$queryRaw<Array<{ content: string; metadata: any }>>`
      SELECT content, metadata, (embedding <=> ${vectorString}::vector) as distance
      FROM document_chunks
      ORDER BY distance ASC
      LIMIT ${limit}
    `;

    return results;
  }
}