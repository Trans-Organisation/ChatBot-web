import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { Mistral } from '@mistralai/mistralai';

@Injectable()
export class ChatService {
    private readonly mistral: Mistral;

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        const apiKey = this.configService.get<string>('MISTRAL_API_KEY');
        if (!apiKey) {
            throw new Error('MISTRAL_API_KEY is not defined in the environment variables.');
        }
        this.mistral = new Mistral({ apiKey });
    }

    async HandleMessage(sessionId: string, content: string) {
        await this.prisma.message.create({
            data: {
                content,
                sender: 'utilisateur',
                sessionId,
            },
        });

        let aiReply = "Désolé, une erreur est survenue lors de la communication avec l'IA.";

        try {
            const dbmessage = await this.prisma.message.findMany({
                where : { sessionId },
                orderBy : { createdAt: 'asc'},
            });

            const formatedmessage = dbmessage.map((msg) => ({
                role : msg.sender === 'utilisateur' ? ('user' as const) : ('assistant' as const),
                content : msg.content,
            }));

            const response = await this.mistral.chat.complete({
                model: 'mistral-small-latest',
                messages: formatedmessage,
            });
            
            if (response.choices && response.choices.length > 0) {
                const messageContent = response.choices[0]?.message?.content;
                if (typeof messageContent === 'string') {
                    aiReply = messageContent;
                }
            }
        } catch (error) {
            console.error('Erreur lors de l appel à Mistral AI :', error);
        }

        await this.prisma.message.create({
            data: {
                content: aiReply,
                sender: 'ai',
                sessionId,
            },
        });

        return {
            reply: aiReply,
        };
    }
}

