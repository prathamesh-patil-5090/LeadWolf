import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureNestApp } from './create-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await configureNestApp(app);
  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
