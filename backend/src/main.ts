import type { Request, Response } from 'express';
import { createNestApp } from './create-app';

async function bootstrap() {
  const { server } = await createNestApp();
  const port = process.env.PORT ?? 3001;
  server.listen(port);
}

/** Vercel serverless entry — must export a request handler. */
export default async function handler(req: Request, res: Response) {
  const { server } = await createNestApp();
  return server(req, res);
}

if (!process.env.VERCEL) {
  void bootstrap();
}
