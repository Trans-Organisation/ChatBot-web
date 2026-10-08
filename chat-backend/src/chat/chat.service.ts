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

      const DISTANCE_THRESHOLD = 0.45;
      const validChunks = relevantChunks.filter((chunk) => chunk.distance <= DISTANCE_THRESHOLD);
      
      console.log(`[RAG Debug] Chunks trouvés:`, relevantChunks.map(c => ({ distance: c.distance, preview: c.content.slice(0, 60) + '...' })));
      console.log(`[RAG Debug] Chunks valides (<= ${DISTANCE_THRESHOLD}):`, validChunks.length);

      if (validChunks.length === 0) {
        aiReply = "Désolé, je n'ai pas trouvé cette information dans les documents officiels de La Transju'. N'hésitez pas à poser votre question par e-mail à contact@latransju.com.";
      } else {
        const contextText = validChunks.map((chunk) => chunk.content).join('\n---\n');

      const systemPrompt = {
        role: 'system' as const,
        content: `Tu es l'assistant officiel de l'événement sportif La Transju'. 
RÈGLE ABSOLUE : Tu dois répondre STRICTEMENT et UNIQUEMENT à partir des extraits de documents officiels fournis dans le contexte ci-dessous. 
Si l'information demandée n'est pas présente ou complète dans le contexte, tu dois OBLIGATOIREMENT répondre mot pour mot :
"Désolé, je ne trouve pas cette information dans les documents officiels. Pour toute question, n'hésitez pas à contacter l'organisation par e-mail à : contact@latransju.com"

CONSIGNES STRICTES :
- N'invite JAMAIS à consulter le site internet.
- N'utilise JAMAIS tes connaissances générales.
- Si le contexte ne donne pas la réponse exacte, renvoie systématiquement vers l'e-mail contact@latransju.com.

Contexte officiel :
${contextText}`,
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