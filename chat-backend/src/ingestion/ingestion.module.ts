import { Module } from '@nestjs/common';
import { VectorService } from '../vector/vector.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WebIngestionService } from './web-ingestion.service.js';
import { WebScraperService } from './web-scraper.service.js';

@Module({
  providers: [WebIngestionService, WebScraperService, VectorService, PrismaService],
  exports: [WebIngestionService, WebScraperService, VectorService, PrismaService],
})
export class IngestionModule {}
