import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { VectorService } from '../vector/vector.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  controllers: [ChatController],
  providers: [
    ChatService,
    VectorService,
    PrismaService,
  ],
})
export class ChatModule {}
