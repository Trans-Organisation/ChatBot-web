import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service.js';
import { ChatRequestDto } from './dto/chat-request.dto.js';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async handleChat(@Body() body: ChatRequestDto) {
    return this.chatService.handleMessage(
      body.sessionId,
      body.content,
      body.discipline ?? 'general',
    );
  }
}
