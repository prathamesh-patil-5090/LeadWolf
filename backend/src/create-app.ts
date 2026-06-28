import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module';

let nestApp: INestApplication | null = null;
let cachedServer: express.Express | null = null;

export async function createNestApp(): Promise<{
  app: INestApplication;
  server: express.Express;
}> {
  if (nestApp && cachedServer) {
    return { app: nestApp, server: cachedServer };
  }

  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? [
      'http://localhost:3000',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api');

  await app.init();
  nestApp = app;
  cachedServer = server;

  return { app, server };
}
