import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Mistral } from '@mistralai/mistralai';

@Injectable()
export class VectorService {
  private mistral: Mistral;

  constructor(private readonly prisma: PrismaService) {
    this.mistral = new Mistral({
      apiKey: process.env.MISTRAL_API_KEY,
    });
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