import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
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

export interface WebIngestionTargets {
  sitemapUrl?: string;
  pageUrls: string[];
}

export function resolveWebIngestionTargets(extraUrls: string[] = []): WebIngestionTargets {
  const urls = [process.env.WEB_INGEST_URLS ?? '', ...extraUrls]
    .join(',')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  const configuredSitemapUrl = process.env.WEB_SITEMAP_URL?.trim();
  const detectedSitemapUrl = urls.find((url) => {
    try {
      const pathname = new URL(url).pathname.toLowerCase();
      return pathname.endsWith('.xml') && pathname.includes('sitemap');
    } catch {
      return false;
    }
  });
  const sitemapUrl = configuredSitemapUrl || detectedSitemapUrl;
  const pageUrls = urls.filter((url) => url !== detectedSitemapUrl);
  return { sitemapUrl, pageUrls };
}

@Injectable()
export class WebIngestionService implements OnModuleInit {
  private readonly logger = new Logger(WebIngestionService.name);

  constructor(
    @Inject(WebScraperService) private readonly scraper: WebScraperService,
    @Inject(VectorService) private readonly vectorService: VectorService,
  ) {}

  onModuleInit() {
    if (process.env.SKIP_AUTO_INGEST === 'true') return;

    const { sitemapUrl, pageUrls } = resolveWebIngestionTargets();
    if (!sitemapUrl && pageUrls.length === 0) {
      this.logger.log(
        'ℹ️ Aucune URL web configurée (WEB_SITEMAP_URL / WEB_INGEST_URLS). Auto-ingestion web ignorée.',
      );
      return;
    }

    // Exécution en arrière-plan pour ne pas bloquer le démarrage HTTP (ex. healthcheck Railway)
    void this.runAutoIngest(sitemapUrl, pageUrls);
  }

  private async runAutoIngest(sitemapUrl: string | undefined, pageUrls: string[]): Promise<void> {
    try {
      this.logger.log('🌐 Début de l\'auto-ingestion des pages web...');
      const results = sitemapUrl
        ? await this.ingestSitemap(sitemapUrl)
        : await this.ingestUrls(pageUrls);
      const inserted = results.filter((r) => r.status === 'inserted').length;
      const unchanged = results.filter((r) => r.status === 'unchanged').length;
      const failed = results.filter((r) => r.status === 'failed').length;
      this.logger.log(
        `🌐 Auto-ingestion web terminée : ${inserted} insérée(s), ${unchanged} inchangée(s), ${failed} en erreur.`,
      );
    } catch (error) {
      this.logger.error("Erreur lors de l'auto-ingestion web :", error);
    }
  }

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
