import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ChatController } from './chat/chat.controller.js';
import { ChatService } from './chat/chat.service.js';
import { VectorService } from './vector/vector.service.js';
import { PrismaService } from './prisma/prisma.service.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AppController, ChatController],
  providers: [
    AppService,
    ChatService,
    VectorService,
    PrismaService,
  ],
})
export class AppModule {}
