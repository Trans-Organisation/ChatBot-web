import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { VectorService } from '../vector/vector.service.js';
import { Mistral } from '@mistralai/mistralai';

@Injectable()
export class ChatService {
  private mistral: Mistral;

  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorService: VectorService,
  ) {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY is not defined in the environment variables.');
    }

    this.mistral = new Mistral({
      apiKey,
    });
  }

  async handleMessage(sessionId: string, content: string) {
    await this.prisma.message.create({
      data: {
        content,
        sender: 'utilisateur',
        sessionId,
      },
    });

    let aiReply = "Désolé, une erreur est survenue lors de la communication avec l'assistant.";

    try {
      const relevantChunks = await this.vectorService.searchSimilarChunks(content, 3);
      const contextText = relevantChunks.map((chunk: { content: string }) => chunk.content).join('\n---\n');

      // 🔒 Prompt strict pour interdire toute hallucination
      const systemPrompt = {
        role: 'system' as const,
        content: `Tu es l'assistant officiel de l'événement sportif La Transju'. 
RÈGLE ABSOLUE : Tu dois répondre STRICTEMENT et UNIQUEMENT à partir des extraits de documents officiels fournis dans le contexte ci-dessous. 
Si la réponse ne se trouve pas explicitement dans ce contexte, réponds textuellement que tu ne possèdes pas l'information dans les documents officiels et invite l'utilisateur à consulter le site de l'événement. 
N'utilise JAMAIS tes connaissances générales, n'invente jamais de faits, de lieux, de parcours ou de chiffres.

Contexte officiel :
${contextText ? contextText : 'Aucune information spécifique disponible dans la base de connaissances.'}`,
      };

      const dbMessages = await this.prisma.message.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
      });

      const formattedHistory = dbMessages.map((msg) => ({
        role: msg.sender === 'utilisateur' ? ('user' as const) : ('assistant' as const),
        content: msg.content,
      }));

      const response = await this.mistral.chat.complete({
        model: 'mistral-small-latest',
        temperature: 0.0, // 👈 0.0 pour empêcher l'IA d'improviser ou de deviner
        messages: [systemPrompt, ...formattedHistory],
      });

      if (response.choices && response.choices.length > 0) {
        const messageContent = response.choices[0]?.message?.content;
        if (typeof messageContent === 'string') {
          aiReply = messageContent;
        }
      }
    } catch (error) {
      console.error('Erreur lors du traitement du message dans ChatService :', error);
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