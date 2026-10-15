<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Ingestion des pages web

Le backend peut aspirer des pages HTML officielles, extraire leur contenu principal,
le découper en blocs d'environ 1 500 caractères et les indexer dans PostgreSQL/pgvector.
Les pages inchangées sont ignorées grâce à une empreinte SHA-256 ; lorsqu'une page
change, ses anciens chunks sont remplacés dans une transaction.

Définissez les URLs séparées par des virgules ainsi que les variables habituelles
(`DATABASE_URL` et `MISTRAL_API_KEY`) :

```bash
export WEB_INGEST_URLS="https://www.latransju.com/actualites,https://www.latransju.com/tarifs"
npm run ingest:web
```

Avec Docker Compose, ajoutez `WEB_INGEST_URLS=...` dans le fichier `.env` situé à
la racine du projet, puis recréez le backend :

```bash
WEB_INGEST_URLS="https://www.latransju.com/actualites,https://www.latransju.com/tarifs"
docker compose up -d --build chat-backend
docker exec chat-backend-1 npm run ingest:web
```

Pour ingérer automatiquement toutes les pages référencées par un sitemap,
utilisez plutôt `WEB_SITEMAP_URL` :

```env
WEB_SITEMAP_URL=https://www.latransju.com/sitemap.xml
```

Si `WEB_SITEMAP_URL` est défini, il est prioritaire sur `WEB_INGEST_URLS`.
Le scraper suit récursivement les sous-sitemaps d'un `sitemap_index.xml`.
Par compatibilité, une URL dont le chemin contient `sitemap` et se termine par
`.xml` est également détectée automatiquement si elle est placée dans
`WEB_INGEST_URLS`.

Il est aussi possible de passer les URLs directement à la commande :

```bash
docker exec chat-backend-1 npm run ingest:web -- \
  https://www.latransju.com/actualites \
  https://www.latransju.com/tarifs
```

Chaque URL est traitée indépendamment : une URL en erreur ne supprime pas les
chunks déjà ingérés des autres pages. Le tableau final indique `failed` et le
détail de l'erreur ; la commande se termine toutefois avec un code de sortie 1
pour signaler qu'une correction de configuration est nécessaire.

Les options `WEB_INGEST_TIMEOUT_MS` (15 000 ms par défaut) et
`WEB_INGEST_USER_AGENT` permettent de personnaliser les requêtes. Le scraper repose
sur Cheerio et cible `main`, `article` ou `[role="main"]` après suppression des
menus, pieds de page, scripts, styles et éléments de consentement.

## Ingestion de tous les PDF

L'ingestion PDF parcourt récursivement les dossiers `data/` détectés dans le
conteneur et le projet. Chaque fichier `.pdf` est extrait, découpé puis vectorisé.
Les fichiers déjà présents en base sont ignorés grâce à leur chemin relatif.

Pour lancer manuellement l'ingestion :

```bash
npm run ingest
```

Avec Docker :

```bash
docker exec chat-backend-1 npm run ingest
```

L'auto-ingestion au démarrage du backend utilise le même mécanisme.

## Vider le RAG

La commande exige un périmètre explicite :

```bash
# Supprimer uniquement les chunks issus des pages web
docker exec chat-backend-1 npm run clear:rag -- --scope=web

# Supprimer uniquement les chunks PDF
docker exec chat-backend-1 npm run clear:rag -- --scope=pdf

# Supprimer tous les chunks (web, PDF et autres sources)
docker exec chat-backend-1 npm run clear:rag -- --scope=all
```

La commande affiche le nombre de chunks supprimés. Le périmètre `all` est
irréversible : relancez ensuite l'ingestion PDF et web si vous souhaitez
reconstituer la base vectorielle.

Le chatbot recherche jusqu'à 8 chunks par question. `RAG_DISTANCE_THRESHOLD`
contrôle la distance cosinus maximale acceptée (valeur par défaut : `0.55`) :
une valeur plus basse est plus stricte, une valeur plus haute récupère davantage
de contexte mais peut inclure des extraits moins proches.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

This project is already instrumented. Create a free account at [observe.nestjs.com](https://observe.nestjs.com), add an application, and paste the generated app key and secret into the `ObserveModule.forRoot()` call in `src/app.module.ts`.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
