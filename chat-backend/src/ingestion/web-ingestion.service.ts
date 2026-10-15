import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { VectorService } from '../vector/vector.service.js';
import { splitTextIntoChunks } from './text-chunker.js';
import { WebScraperService } from './web-scraper.service.js';

export interface WebIngestionResult {
  url: string;
  status: 'inserted' | 'unchanged' | 'failed';
  chunks: number;
  error?: string;
}

@Injectable()
export class WebIngestionService {
  private readonly logger = new Logger(WebIngestionService.name);

  constructor(
    @Inject(WebScraperService) private readonly scraper: WebScraperService,
    @Inject(VectorService) private readonly vectorService: VectorService,
  ) {}

  async ingestUrls(urls: string[]): Promise<WebIngestionResult[]> {
    const results: WebIngestionResult[] = [];
    const uniqueUrls = new Set(urls.map((value) => value.trim()).filter(Boolean));
    for (const url of uniqueUrls) {
      try {
        results.push(await this.ingestUrl(url));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Ingestion impossible pour ${url} : ${message}`);
        results.push({ url, status: 'failed', chunks: 0, error: message });
      }
    }
    return results;
  }

  async ingestUrl(url: string): Promise<WebIngestionResult> {
    const page = await this.scraper.scrapeUrl(url);
    const contentHash = createHash('sha256').update(page.content).digest('hex');
    const chunks = splitTextIntoChunks(page.content);
    const metadata = {
      source: 'web',
      method: 'cheerio',
      url: page.url,
      title: page.title,
      contentHash,
      ingestedAt: new Date().toISOString(),
    };

    const unchanged = await this.vectorService.hasWebSourceHash(url, contentHash);
    if (unchanged) {
      this.logger.log(`Page inchangée, ingestion ignorée : ${url}`);
      return { url, status: 'unchanged', chunks: 0 };
    }

    await this.vectorService.replaceWebSource(url, chunks, {
      ...metadata,
      part: 0,
      totalParts: chunks.length,
    });
    this.logger.log(`${chunks.length} chunks insérés pour ${url}`);
    return { url, status: 'inserted', chunks: chunks.length };
  }

  async ingestSitemap(sitemapUrl: string): Promise<WebIngestionResult[]> {
    this.logger.log(`Début de l'ingestion via le sitemap : ${sitemapUrl}`);
    const urls = await this.scraper.fetchSitemapUrls(sitemapUrl);
    this.logger.log(`${urls.length} URL(s) trouvée(s) dans le sitemap.`);
    return this.ingestUrls(urls);
  }
}
