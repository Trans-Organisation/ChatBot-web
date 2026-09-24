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
      // 💡 Typer chunk résout l'erreur TS7006
      const contextText = relevantChunks.map((chunk: { content: string }) => chunk.content).join('\n---\n');

      const systemPrompt = {
        role: 'system' as const,
        content: `Tu es l'assistant officiel de l'événement sportif La Transju'. 
Sois accueillant, précis et dynamique.
Utilise prioritairement les informations suivantes pour répondre à la question de l'utilisateur :
${contextText ? contextText : 'Aucune information spécifique disponible dans la base de connaissances.'}

Si la réponse ne se trouve pas dans le texte fourni, réponds avec tes connaissances générales sur La Transju' en le précisant gentiment.`,
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
        messages: [systemPrompt, ...formattedHistory],
      });

      // 💡 Chaining optionnel pour éviter TS2532 (Object is possibly 'undefined')
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