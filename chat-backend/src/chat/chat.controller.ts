import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service.js';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async handleChat(@Body() body: { sessionId: string; content: string }) {
    // 💡 'handleMessage' en minuscules
    return this.chatService.handleMessage(body.sessionId, body.content);
  }
}
