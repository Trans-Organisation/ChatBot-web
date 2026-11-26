import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import {
  resolveWebIngestionTargets,
  WebIngestionService,
} from './ingestion/web-ingestion.service.js';

const { sitemapUrl, pageUrls } = resolveWebIngestionTargets(process.argv.slice(2));

if (!sitemapUrl && pageUrls.length === 0) {
  console.error(
    '❌ Définissez WEB_SITEMAP_URL, WEB_INGEST_URLS ou passez une ou plusieurs URLs en arguments.',
  );
  process.exit(1);
}

process.env.SKIP_AUTO_INGEST ??= 'true';

const app = await NestFactory.createApplicationContext(AppModule);

try {
  const ingestion = app.get(WebIngestionService);
  const results = sitemapUrl
    ? await ingestion.ingestSitemap(sitemapUrl)
    : await ingestion.ingestUrls(pageUrls);
  console.table(results);
  if (results.some((result) => result.status === 'failed')) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error("❌ L'ingestion web a échoué :", error);
  process.exitCode = 1;
} finally {
  await app.close();
}
