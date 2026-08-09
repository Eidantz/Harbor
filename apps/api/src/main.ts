import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Health stays at /health (Compose + Vite proxy). Everything else under /api.
  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });

  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  app.enableCors({
    origin: webOrigin,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Kanban API')
    .setDescription(
      'Local single-user Kanban API. UI uses HTTP-only cookie session; MCP uses a Bearer token from Harbor → MCP tokens.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth('kanban_session')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
  });

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`API listening on http://localhost:${port}`);
  console.log(`OpenAPI docs at http://localhost:${port}/api/docs`);
  console.log(`Health at http://localhost:${port}/health`);
}

bootstrap();
