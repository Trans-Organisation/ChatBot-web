import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Chatbot Backend API is running! 🚀 (Front-end is available at http://localhost:5173)';
  }
}
