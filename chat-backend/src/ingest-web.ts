import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { WebIngestionService } from './ingestion/web-ingestion.service.js';

const urls = [process.env.WEB_INGEST_URLS ?? '', ...process.argv.slice(2)]
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

if (!sitemapUrl && pageUrls.length === 0) {
  console.error(
    '❌ Définissez WEB_SITEMAP_URL, WEB_INGEST_URLS ou passez une ou plusieurs URLs en arguments.',
  );
  process.exit(1);
}

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
