import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service.js';

@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) {}

    @Post()
    async sendMessage(@Body('message') message: string) {
        const reply = await this.chatService.getAIreponse(message);
        return { reply };
    }
}
