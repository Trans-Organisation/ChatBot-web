import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { VectorService } from './vector/vector.service.js';

const app = await NestFactory.createApplicationContext(AppModule);

try {
  const vectorService = app.get(VectorService);
  console.log('📚 Tous les PDF présents dans les dossiers data sont traités.');
  await vectorService.ingestAllPdfs();
} catch (error) {
  console.error("❌ Erreur lors de l'ingestion des PDF :", error);
  process.exitCode = 1;
} finally {
  await app.close();
}
