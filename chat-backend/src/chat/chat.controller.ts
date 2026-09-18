import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service.js';

@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) {}

    @Post()
    async sendMessage(@Body() body: { content: string; sessionId: string }) {
        return this.chatService.HandleMessage(body.sessionId, body.content);
    }
}
