import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  Discipline,
  FILTERABLE_DISCIPLINES,
  normalizeDiscipline,
  resolveDiscipline,
} from '../ingestion/discipline.util.js';
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
    const discipline = resolveDiscipline(relativePath || fileName);
    const docPrefix = `[Document : ${fileName}]`;
    const existing = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM document_chunks
      WHERE (metadata->>'filePath' = ${relativePath} OR metadata->>'source' = ${fileName})
        AND content LIKE ${`${docPrefix}%`}
        AND discipline = ${discipline}
    `;

    if (Number(existing[0]?.count ?? 0) > 0) {
      this.logger.log(`ℹ️ Le PDF '${relativePath}' est déjà indexé. Ingestion ignorée.`);
      return 0;
    }

    // Supprime d'éventuels anciens chunks avant ré-indexation
    await this.prisma.$executeRaw`
      DELETE FROM document_chunks
      WHERE metadata->>'filePath' = ${relativePath}
         OR metadata->>'source' = ${fileName}
    `;

    this.logger.log(`📄 Début de l'ingestion : ${filePath} (discipline: ${discipline})`);
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf(dataBuffer);

    if (!pdfData.text || pdfData.text.trim().length === 0) {
      throw new Error(`Impossible d'extraire du texte du PDF : ${fileName}`);
    }

    const chunks = splitTextIntoChunks(pdfData.text, 1200, 200);
    this.logger.log(`✂️ ${chunks.length} chunks générés pour '${fileName}'.`);

    for (let i = 0; i < chunks.length; i++) {
      const enrichedChunk = `[Document : ${fileName}]\n${chunks[i]}`;
      await this.addDocumentChunk(
        enrichedChunk,
        {
          source: 'pdf',
          fileName,
          filePath: relativePath,
          discipline,
          method,
          part: i + 1,
          totalParts: chunks.length,
        },
        discipline,
      );
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

  async addDocumentChunk(
    content: string,
    metadata: Record<string, any> = {},
    discipline: Discipline = 'general',
  ) {
    const embedding = await this.generateEmbedding(content);
    const vectorString = `[${embedding.join(',')}]`;

    // Exécution de la requête SQL vectorielle
    await this.prisma.$executeRaw`
      INSERT INTO document_chunks (id, content, metadata, discipline, embedding, "createdAt")
      VALUES (gen_random_uuid(), ${content}, ${JSON.stringify(metadata)}::jsonb, ${discipline}, ${vectorString}::vector, NOW())
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

  async hasWebSourceHash(
    url: string,
    contentHash: string,
    discipline?: Discipline,
  ): Promise<boolean> {
    const existing = discipline
      ? await this.prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count
          FROM document_chunks
          WHERE metadata->>'source' = 'web'
            AND metadata->>'url' = ${url}
            AND metadata->>'contentHash' = ${contentHash}
            AND discipline = ${discipline}
        `
      : await this.prisma.$queryRaw<Array<{ count: bigint }>>`
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
    discipline: Discipline = 'general',
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
          INSERT INTO document_chunks (id, content, metadata, discipline, embedding, "createdAt")
          VALUES (
            gen_random_uuid(),
            ${chunk.content},
            ${JSON.stringify(chunk.metadata)}::jsonb,
            ${discipline},
            ${vectorString}::vector,
            NOW()
          )
        `;
      }
    });
  }

  async searchSimilarChunks(
    query: string,
    limit = 12,
    disciplineInput?: string,
    distanceThreshold = Number(process.env.RAG_DISTANCE_THRESHOLD ?? 0.55),
  ): Promise<
    Array<{
      content: string;
      metadata: any;
      discipline: string;
      distance: number;
      fromKeyword?: boolean;
    }>
  > {
    const queryEmbedding = await this.generateEmbedding(query);
    const vectorString = `[${queryEmbedding.join(',')}]`;
    const discipline = normalizeDiscipline(disciplineInput);

    if (FILTERABLE_DISCIPLINES.has(discipline)) {
      const filteredResults = await this.executeHybridSearch(
        query,
        vectorString,
        limit,
        discipline,
      );
      const pertinentCount = filteredResults.filter(
        (chunk) =>
          chunk.distance <= distanceThreshold ||
          (chunk.fromKeyword && chunk.distance <= 0.72),
      ).length;
      const bestDistance = filteredResults[0]?.distance ?? 1;

      if (pertinentCount >= 2 && bestDistance <= distanceThreshold) {
        return filteredResults;
      }

      this.logger.log(
        `🔄 Fallback RAG global (discipline=${discipline}, pertinentCount=${pertinentCount}, bestDistance=${bestDistance.toFixed(3)})`,
      );
    }

    return this.executeHybridSearch(query, vectorString, limit);
  }

  private async executeHybridSearch(
    query: string,
    vectorString: string,
    limit: number,
    filterDiscipline?: Discipline,
  ): Promise<
    Array<{
      content: string;
      metadata: any;
      discipline: string;
      distance: number;
      fromKeyword?: boolean;
    }>
  > {
    const vectorResults = filterDiscipline
      ? await this.prisma.$queryRaw<
          Array<{
            id: string;
            content: string;
            metadata: any;
            discipline: string;
            distance: number;
          }>
        >`
          SELECT id, content, metadata, discipline, (embedding <=> ${vectorString}::vector) as distance
          FROM document_chunks
          WHERE discipline IN (${filterDiscipline}, 'general')
          ORDER BY distance ASC
          LIMIT ${limit}
        `
      : await this.prisma.$queryRaw<
          Array<{
            id: string;
            content: string;
            metadata: any;
            discipline: string;
            distance: number;
          }>
        >`
          SELECT id, content, metadata, discipline, (embedding <=> ${vectorString}::vector) as distance
          FROM document_chunks
          ORDER BY distance ASC
          LIMIT ${limit}
        `;

    // Recherche lexicale complémentaire (hybride) pour garantir la remontée des documents
    // mentionnant explicitement l'épreuve ou les mots-clés de la question
    const stopWords = new Set([
      'avec', 'cette', 'dans', 'elle', 'elles', 'entre', 'etre', 'faire', 'faut',
      'mais', 'nous', 'plus', 'pour', 'quel', 'quelle', 'quelles', 'quels',
      'sans', 'sont', 'sous', 'tout', 'tous', 'toute', 'toutes', 'vous',
    ]);
    const normalizedQuery = query
      .toLocaleLowerCase('fr-FR')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
    const keywords = [
      ...new Set(
        normalizedQuery
          .replace(/[^\p{L}\p{N}\s]/gu, ' ')
          .split(/\s+/)
          .filter((term) => term.length >= 4 && !stopWords.has(term)),
      ),
    ].slice(0, 8);

    if (keywords.length === 0) {
      return vectorResults.map(({ content, metadata, discipline, distance }) => ({
        content,
        metadata,
        discipline,
        distance,
      }));
    }

    // Préfixe `:*` sur dictionnaire `simple` + suppression des accents via `translate`
    // pour que "batons" matche "Bâtons" et "materiel" matche "Matériel"
    const tsQueryString = keywords.map((term) => `${term}:*`).join(' | ');
    let keywordResults: Array<{
      id: string;
      content: string;
      metadata: any;
      discipline: string;
      distance: number;
    }> = [];
    try {
      keywordResults = filterDiscipline
        ? await this.prisma.$queryRaw<
            Array<{
              id: string;
              content: string;
              metadata: any;
              discipline: string;
              distance: number;
            }>
          >`
            SELECT id, content, metadata, discipline, (embedding <=> ${vectorString}::vector) as distance
            FROM document_chunks,
                 to_tsquery('simple', ${tsQueryString}) AS q
            WHERE discipline IN (${filterDiscipline}, 'general')
              AND to_tsvector(
                'simple',
                translate(
                  lower(
                    content || ' ' ||
                    coalesce(metadata->>'fileName', '') || ' ' ||
                    coalesce(metadata->>'title', '') || ' ' ||
                    coalesce(metadata->>'url', '')
                  ),
                  'àâäéèêëîïôöùûüÿç',
                  'aaaeeeeiioouuuyc'
                )
              ) @@ q
            ORDER BY ts_rank(
              to_tsvector(
                'simple',
                translate(
                  lower(
                    content || ' ' ||
                    coalesce(metadata->>'fileName', '') || ' ' ||
                    coalesce(metadata->>'title', '') || ' ' ||
                    coalesce(metadata->>'url', '')
                  ),
                  'àâäéèêëîïôöùûüÿç',
                  'aaaeeeeiioouuuyc'
                )
              ),
              q
            ) DESC, distance ASC
            LIMIT 8
          `
        : await this.prisma.$queryRaw<
            Array<{
              id: string;
              content: string;
              metadata: any;
              discipline: string;
              distance: number;
            }>
          >`
            SELECT id, content, metadata, discipline, (embedding <=> ${vectorString}::vector) as distance
            FROM document_chunks,
                 to_tsquery('simple', ${tsQueryString}) AS q
            WHERE to_tsvector(
              'simple',
              translate(
                lower(
                  content || ' ' ||
                  coalesce(metadata->>'fileName', '') || ' ' ||
                  coalesce(metadata->>'title', '') || ' ' ||
                  coalesce(metadata->>'url', '')
                ),
                'àâäéèêëîïôöùûüÿç',
                'aaaeeeeiioouuuyc'
              )
            ) @@ q
            ORDER BY ts_rank(
              to_tsvector(
                'simple',
                translate(
                  lower(
                    content || ' ' ||
                    coalesce(metadata->>'fileName', '') || ' ' ||
                    coalesce(metadata->>'title', '') || ' ' ||
                    coalesce(metadata->>'url', '')
                  ),
                  'àâäéèêëîïôöùûüÿç',
                  'aaaeeeeiioouuuyc'
                )
              ),
              q
            ) DESC, distance ASC
            LIMIT 8
          `;
    } catch {
      keywordResults = [];
    }

    const merged = new Map<
      string,
      {
        content: string;
        metadata: any;
        discipline: string;
        distance: number;
        fromKeyword?: boolean;
      }
    >();
    for (const row of vectorResults) {
      merged.set(row.id, {
        content: row.content,
        metadata: row.metadata,
        discipline: row.discipline,
        distance: row.distance,
      });
    }
    for (const row of keywordResults) {
      const existing = merged.get(row.id);
      if (!existing || row.distance < existing.distance) {
        merged.set(row.id, {
          content: row.content,
          metadata: row.metadata,
          discipline: row.discipline,
          distance: row.distance,
          fromKeyword: true,
        });
      } else {
        existing.fromKeyword = true;
      }
    }

    return [...merged.values()].sort((a, b) => a.distance - b.distance).slice(0, limit);
  }
}