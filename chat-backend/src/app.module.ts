import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ChatController } from './chat/chat.controller.js';
import { ChatService } from './chat/chat.service.js';
import { IngestionModule } from './ingestion/ingestion.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), IngestionModule],
  controllers: [AppController, ChatController],
  providers: [
    AppService,
    ChatService,
  ],
})
export class AppModule {}
