import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mistral } from '@mistralai/mistralai';

@Injectable()
export class ChatService {
    private readonly mistral: Mistral;

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('MISTRAL_API_KEY');
        if (!apiKey) {
            throw new Error('MISTRAL_API_KEY is not defined in the environment variables.');
        }
        this.mistral = new Mistral({ apiKey });
    }

    async getAIreponse(userMessage: string): Promise<string> {
        try {
            const response = await this.mistral.chat.complete({
                model: 'mistral-small-latest',
                messages: [
                    {
                        role : 'system',
                        content : 'Tu es l’assistant virtuel d’un site web. Réponds de manière concise, polie et utile.'
                    },
                    { role : 'user', content : userMessage },
                ],
            });
            const choice = response.choices[0] as any;
            return choice?.message?.content ?? "Désolé, je n'ai pas pu générer de réponse.";
        } catch (error) {
            console.error('Erreur avec l’API Mistral :', error);
            throw new Error('Erreur lors de la communication avec l’IA.');
        }
    }
    
}
