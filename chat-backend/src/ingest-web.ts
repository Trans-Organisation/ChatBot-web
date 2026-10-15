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

if (urls.length === 0) {
  console.error(
    '❌ Définissez WEB_INGEST_URLS ou passez une ou plusieurs URLs en arguments.',
  );
  process.exit(1);
}

const app = await NestFactory.createApplicationContext(AppModule);

try {
  const ingestion = app.get(WebIngestionService);
  const results = await ingestion.ingestUrls(urls);
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
