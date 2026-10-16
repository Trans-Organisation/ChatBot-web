import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { VectorService } from '../vector/vector.service.js';
import { WebScraperService } from '../ingestion/web-scraper.service.js';
import { Mistral } from '@mistralai/mistralai';

@Injectable()
export class ChatService {
  private mistral: Mistral;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(VectorService) private readonly vectorService: VectorService,
    @Inject(WebScraperService) private readonly webScraper: WebScraperService,
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

    let aiReply = this.getFallbackResponse(content, 'error');

    try {
      const language = this.detectLanguage(content);
      const languageName = language === 'en' ? 'English' : language === 'es' ? 'Spanish' : 'French';
      const officialUrls = (process.env.WEB_INGEST_URLS ?? '').split(',');
      const officialPages = await this.webScraper.searchOfficialUrls(officialUrls, content);
      const relevantChunks = await this.vectorService.searchSimilarChunks(content, 8);

      const DISTANCE_THRESHOLD = Number(process.env.RAG_DISTANCE_THRESHOLD ?? 0.55);
      const validChunks = relevantChunks.filter((chunk) => chunk.distance <= DISTANCE_THRESHOLD);
      
      console.log(`[RAG Debug] Chunks trouvés:`, relevantChunks.map(c => ({
        distance: c.distance,
        source: c.metadata?.source,
        url: c.metadata?.url,
        preview: c.content.slice(0, 60) + '...',
      })));
      console.log(`[RAG Debug] Chunks valides (<= ${DISTANCE_THRESHOLD}):`, validChunks.length);
      console.log(`[RAG Debug] Pages officielles en direct:`, officialPages.map((page) => ({
        score: page.score,
        url: page.url,
      })));

      if (officialPages.length === 0 && validChunks.length === 0) {
        aiReply = this.getFallbackResponse(content, 'not-found');
      } else {
        const liveContext = officialPages
          .map((page, index) =>
            `[Page officielle en direct ${index + 1} | ${page.title} | ${page.url}]\n${page.content.slice(0, 6000)}`,
          )
          .join('\n---\n');
        const vectorContext = validChunks
          .map((chunk, index) => {
            const source = chunk.metadata?.url ?? chunk.metadata?.source ?? 'document officiel';
            const title = chunk.metadata?.title ?? '';
            return `[Extrait indexé ${index + 1} | ${title} | ${source}]\n${chunk.content}`;
          })
          .join('\n---\n');
        const contextText = [liveContext, vectorContext].filter(Boolean).join('\n---\n');

      const systemPrompt = {
        role: 'system' as const,
        content: `Tu es l'assistant officiel de l'événement sportif La Transju'.
LANGUE DE RÉPONSE OBLIGATOIRE : ${languageName}.
Réponds entièrement dans cette langue, même si le contexte ou l'historique est dans une autre langue.
N'utilise jamais le français si LANGUE DE RÉPONSE vaut English ou Spanish.
Réponds de façon directe et utile, sans traduire les noms propres, URLs, devises ou nombres.
Tu dois répondre uniquement à partir du contexte officiel fourni dans le dernier message utilisateur.
Si l'information demandée n'est pas présente ou complète dans le contexte, réponds dans la langue de la question avec l'équivalent de :
"Désolé, je ne trouve pas cette information dans les documents officiels. Pour toute question, n'hésitez pas à contacter l'organisation par e-mail à : contact@latransju.com"
Ne renvoie pas la réponse de secours si le contexte contient la réponse, même si elle se trouve dans un tableau ou une liste.`,
      };

      const dbMessages = await this.prisma.message.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
      });

      const formattedHistory = dbMessages.slice(0, -1).slice(-10).map((msg) => ({
        role: msg.sender === 'utilisateur' ? ('user' as const) : ('assistant' as const),
        content: msg.content,
      }));

      const response = await this.mistral.chat.complete({
        model: 'mistral-small-latest',
        temperature: 0.0, // 👈 0.0 pour empêcher l'IA d'improviser ou de deviner
        messages: [
          systemPrompt,
          ...formattedHistory,
          {
            role: 'user' as const,
            content: `LANGUE DE RÉPONSE : ${languageName}\nQuestion : ${content}\n\nContexte officiel à utiliser :\n${contextText}`,
          },
        ],
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

  private getFallbackResponse(
    question: string,
    type: 'not-found' | 'error',
  ): string {
    const language = this.detectLanguage(question);

    if (type === 'error') {
      return language === 'en'
        ? 'Sorry, an error occurred while communicating with the assistant.'
        : language === 'es'
          ? 'Lo siento, se produjo un error al comunicarse con el asistente.'
          : "Désolé, une erreur est survenue lors de la communication avec l'assistant.";
    }

    return language === 'en'
      ? "Sorry, I couldn't find this information in La Transju' official documents. For any questions, please contact the organization by email at contact@latransju.com."
      : language === 'es'
        ? "Lo siento, no encuentro esta información en los documentos oficiales de La Transju'. Para cualquier pregunta, contacte con la organización por correo electrónico: contact@latransju.com."
        : "Désolé, je ne trouve pas cette information dans les documents officiels. Pour toute question, n'hésitez pas à contacter l'organisation par e-mail à : contact@latransju.com.";
  }

  private detectLanguage(question: string): 'fr' | 'en' | 'es' {
    const normalized = question
      .toLocaleLowerCase('fr-FR')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
    const scores = {
      fr: this.countLanguageMatches(normalized, [
        'quel', 'quelle', 'quels', 'quelles', 'sont', 'dans', 'pour', 'avec',
        'tarif', 'prix', 'combien', 'comment', 'ou', 'inscription',
      ]),
      en: this.countLanguageMatches(normalized, [
        'what', 'which', 'where', 'when', 'how', 'much', 'are', 'the',
        'price', 'prices', 'registration', 'fee',
      ]),
      es: this.countLanguageMatches(normalized, [
        'que', 'cual', 'cuales', 'donde', 'cuando', 'como', 'cuanto',
        'son', 'precio', 'precios', 'inscripción',
      ]),
    };

    if (scores.en > scores.fr && scores.en >= scores.es) return 'en';
    if (scores.es > scores.fr && scores.es > scores.en) return 'es';
    return 'fr';
  }

  private countLanguageMatches(text: string, terms: string[]): number {
    return terms.reduce(
      (score, term) => score + (new RegExp(`\\b${term}\\b`, 'u').test(text) ? 1 : 0),
      0,
    );
  }
}