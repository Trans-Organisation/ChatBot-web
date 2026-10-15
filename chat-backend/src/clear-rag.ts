import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { VectorService } from './vector/vector.service.js';

const scopeArgument = process.argv.find((argument) => argument.startsWith('--scope='));
const scope = scopeArgument?.slice('--scope='.length);

if (scope !== 'web' && scope !== 'pdf' && scope !== 'all') {
  console.error(
    '❌ Précisez un périmètre : --scope=web, --scope=pdf ou --scope=all.',
  );
  process.exit(1);
}

process.env.SKIP_AUTO_INGEST = 'true';
const app = await NestFactory.createApplicationContext(AppModule);

try {
  const vectorService = app.get(VectorService);
  const deleted = await vectorService.clearRag(scope);
  console.log(`✅ ${deleted} chunks supprimés du RAG (périmètre : ${scope}).`);
} catch (error) {
  console.error('❌ Impossible de vider le RAG :', error);
  process.exitCode = 1;
} finally {
  await app.close();
}
