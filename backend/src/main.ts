import type { Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createNestApp } from './create-app';

// Vercel zero-config scans main.ts for @nestjs imports at build time.
void NestFactory;
void AppModule;

async function bootstrap() {
  const { server } = await createNestApp();
  const port = process.env.PORT ?? 3001;
  server.listen(port);
}

/** Vercel serverless entry — must default-export a request handler. */
export default async function handler(req: Request, res: Response) {
  const { server } = await createNestApp();
  return server(req, res);
}

if (!process.env.VERCEL) {
  void bootstrap();
}
