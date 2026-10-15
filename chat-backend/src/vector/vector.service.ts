import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
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

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    this.mistral = new Mistral({
      apiKey: process.env.MISTRAL_API_KEY,
    });
  }

  async onModuleInit() {
    if (process.env.SKIP_AUTO_INGEST === 'true') return;

    try {
      await this.ingestAllPdfs();
    } catch (error) {
      this.logger.error('Erreur lors de l\'auto-ingestion des PDF :', error);
    }
  }

  async ingestAllPdfs(): Promise<void> {
    const files = this.findPdfFiles();
    if (files.length === 0) {
      this.logger.warn('⚠️ Aucun fichier PDF trouvé dans les dossiers scannés.');
      return;
    }

    for (const filePath of files) {
      try {
        await this.ingestPdfFile(filePath, 'auto-ingest-pdf');
      } catch (error) {
        this.logger.error(`Erreur d'ingestion du PDF '${filePath}' :`, error);
      }
    }
  }

  async ingestPdfFile(filePath: string, method = 'pdf-parse'): Promise<number> {
    const fileName = path.basename(filePath);
    const relativePath = path.relative(process.cwd(), filePath);
    const existing = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM document_chunks
      WHERE metadata->>'filePath' = ${relativePath}
         OR metadata->>'source' = ${fileName}
    `;

    if (Number(existing[0]?.count ?? 0) > 0) {
      this.logger.log(`ℹ️ Le PDF '${relativePath}' est déjà indexé. Ingestion ignorée.`);
      return 0;
    }

    this.logger.log(`📄 Début de l'ingestion : ${filePath}`);
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf(dataBuffer);

    if (!pdfData.text || pdfData.text.trim().length === 0) {
      throw new Error(`Impossible d'extraire du texte du PDF : ${fileName}`);
    }

    const chunks = splitTextIntoChunks(pdfData.text, 1200, 200);
    this.logger.log(`✂️ ${chunks.length} chunks générés pour '${fileName}'.`);

    for (let i = 0; i < chunks.length; i++) {
      await this.addDocumentChunk(chunks[i], {
        source: 'pdf',
        fileName,
        filePath: relativePath,
        method,
        part: i + 1,
        totalParts: chunks.length,
      });
    }

    this.logger.log(`🎉 '${fileName}' indexé (${chunks.length} chunks).`);
    return chunks.length;
  }

  private findPdfFiles(): string[] {
    const roots = [
      path.join(process.cwd(), 'data'),
      path.join(process.cwd(), 'chat-backend', 'data'),
      path.join(process.cwd(), '..', 'data'),
    ];
    const files = new Set<string>();

    const visit = (directory: string) => {
      if (!fs.existsSync(directory)) return;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(entryPath);
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
          files.add(path.resolve(entryPath));
        }
      }
    };

    for (const root of roots) visit(root);
    return [...files].sort();
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

  async clearRag(scope: 'web' | 'pdf' | 'all'): Promise<number> {
    let deleted: Array<{ count: bigint }>;

    if (scope === 'web') {
      deleted = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        WITH deleted AS (
          DELETE FROM document_chunks
          WHERE metadata->>'source' = 'web'
          RETURNING id
        )
        SELECT COUNT(*) AS count FROM deleted
      `;
    } else if (scope === 'pdf') {
      deleted = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        WITH deleted AS (
          DELETE FROM document_chunks
          WHERE metadata->>'source' = 'pdf'
             OR metadata->>'source' = 'reglement-trail-2027.pdf'
          RETURNING id
        )
        SELECT COUNT(*) AS count FROM deleted
      `;
    } else {
      deleted = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        WITH deleted AS (
          DELETE FROM document_chunks
          RETURNING id
        )
        SELECT COUNT(*) AS count FROM deleted
      `;
    }

    return Number(deleted[0]?.count ?? 0);
  }

  async hasWebSourceHash(url: string, contentHash: string): Promise<boolean> {
    const existing = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM document_chunks
      WHERE metadata->>'source' = 'web'
        AND metadata->>'url' = ${url}
        AND metadata->>'contentHash' = ${contentHash}
    `;
    return Number(existing[0]?.count ?? 0) > 0;
  }

  async replaceWebSource(
    url: string,
    chunks: string[],
    metadata: Record<string, any>,
  ): Promise<void> {
    const embeddedChunks: Array<{
      content: string;
      embedding: number[];
      metadata: Record<string, any>;
    }> = [];
    for (let index = 0; index < chunks.length; index++) {
      embeddedChunks.push({
        content: chunks[index],
        embedding: await this.generateEmbedding(chunks[index]),
        metadata: { ...metadata, part: index + 1 },
      });
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        DELETE FROM document_chunks
        WHERE metadata->>'source' = 'web' AND metadata->>'url' = ${url}
      `;

      for (const chunk of embeddedChunks) {
        const vectorString = `[${chunk.embedding.join(',')}]`;
        await transaction.$executeRaw`
          INSERT INTO document_chunks (id, content, metadata, embedding, "createdAt")
          VALUES (
            gen_random_uuid(),
            ${chunk.content},
            ${JSON.stringify(chunk.metadata)}::jsonb,
            ${vectorString}::vector,
            NOW()
          )
        `;
      }
    });
  }

  async searchSimilarChunks(query: string, limit = 8): Promise<Array<{ content: string; metadata: any; distance: number }>> {
  const queryEmbedding = await this.generateEmbedding(query);
  const vectorString = `[${queryEmbedding.join(',')}]`;
  const results = await this.prisma.$queryRaw<Array<{ content: string; metadata: any; distance: number }>>`
    SELECT content, metadata, (embedding <=> ${vectorString}::vector) as distance
    FROM document_chunks
    ORDER BY distance ASC
    LIMIT ${limit}
  `;
  return results;
}
}