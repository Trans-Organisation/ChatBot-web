import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';

export interface ScrapedPage {
  url: string;
  title: string;
  content: string;
}

export interface OfficialSearchResult extends ScrapedPage {
  score: number;
}

@Injectable()
export class WebScraperService {
  private readonly userAgent =
    process.env.WEB_INGEST_USER_AGENT ?? 'LaTransjuChatbot/1.0 (+https://www.latransju.com)';

  async scrapeUrl(url: string): Promise<ScrapedPage> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Number(process.env.WEB_INGEST_TIMEOUT_MS ?? 15000),
    );

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': this.userAgent,
        },
      });

      if (!response.ok) {
        throw new Error(`La page ${url} a répondu avec le statut HTTP ${response.status}.`);
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        throw new Error(`La ressource ${url} n'est pas une page HTML (${contentType || 'type inconnu'}).`);
      }

      const html = await response.text();
      return this.extractContent(url, html);
    } finally {
      clearTimeout(timeout);
    }
  }

  async searchOfficialUrls(urls: string[], query: string): Promise<OfficialSearchResult[]> {
    const terms = this.searchTerms(query);
    const results: OfficialSearchResult[] = [];

    for (const url of [...new Set(urls.map((value) => value.trim()).filter(Boolean))]) {
      try {
        const page = await this.scrapeUrl(url);
        const haystack = this.normalizeForSearch(
          `${page.title} ${page.url} ${page.content}`,
        );
        const score = terms.reduce((total, term) => {
          const occurrences = haystack.split(term).length - 1;
          return total + Math.min(occurrences, 5);
        }, 0);

        if (score > 0) results.push({ ...page, score });
      } catch {
        // Une page indisponible ne doit pas empêcher la recherche sur les autres pages officielles.
      }
    }

    return results.sort((left, right) => right.score - left.score).slice(0, 3);
  }

  private extractContent(url: string, html: string): ScrapedPage {
    const $ = cheerio.load(html);
    $('script, style, noscript, iframe, svg, canvas, nav, header, footer, form').remove();
    $('[aria-hidden="true"], [hidden], .cookie, .cookies, .consent, .social-share, .share').remove();

    const title =
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('h1').first().text().trim() ||
      $('title').first().text().trim() ||
      url;
    const main = $('main, article, [role="main"]').first();
    const root = main.length > 0 ? main : $('body');
    const content = root
      .find('h1, h2, h3, h4, p, li, blockquote, td, th')
      .toArray()
      .map((element) => $(element).text().replace(/\s+/g, ' ').trim())
      .filter((text) => text.length >= 2)
      .filter((text, index, values) => values.indexOf(text) === index)
      .join('\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!content) {
      throw new Error(`Aucun contenu textuel exploitable n'a été trouvé sur ${url}.`);
    }

    return { url, title, content };
  }

  private searchTerms(query: string): string[] {
    const stopWords = new Set([
      'avec', 'dans', 'des', 'est', 'les', 'pour', 'quel', 'quelle', 'quels',
      'quelles', 'sont', 'sur', 'tarifs', 'une', 'vous',
    ]);

    return [...new Set(
      this.normalizeForSearch(query)
        .split(/[^\p{L}\p{N}]+/u)
        .filter((term) => term.length >= 4 && !stopWords.has(term)),
    )];
  }

  private normalizeForSearch(value: string): string {
    return value
      .toLocaleLowerCase('fr-FR')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
  }
}
