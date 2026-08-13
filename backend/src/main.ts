import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // CORS:
  // - FRONTEND_URL definido  -> restringe à lista (separada por vírgula). Recomendado em produção.
  // - Sem FRONTEND_URL em DEV -> libera (facilita app nativo + testes locais).
  // - Sem FRONTEND_URL em PROD -> bloqueia origens cruzadas (fail-safe) e avisa no log.
  const isProd = process.env.NODE_ENV === 'production';
  let corsOrigin: string[] | boolean;
  if (process.env.FRONTEND_URL) {
    corsOrigin = process.env.FRONTEND_URL.split(',').map((o) => o.trim());
  } else if (isProd) {
    console.warn('⚠️  FRONTEND_URL não definido em produção — CORS bloqueado por segurança. Defina FRONTEND_URL.');
    corsOrigin = false;
  } else {
    corsOrigin = true;
  }
  app.enableCors({ origin: corsOrigin, credentials: true });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api/v1');

  const swagger = new DocumentBuilder()
    .setTitle('Lumin PDV — API')
    .setDescription('API multi-tenant para PDV e gestão de supermercado')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth')
    .addTag('Filiais')
    .addTag('Clientes')
    .addTag('Fornecedores')
    .addTag('Produtos')
    .addTag('Estoque/WMS')
    .addTag('Pedidos')
    .addTag('NF-e')
    .addTag('Financeiro')
    .addTag('Auditoria')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  const port = process.env.PORT || 3012;
  await app.listen(port);
  console.log(`\n🛒 Lumin PDV rodando em http://localhost:${port}`);
  console.log(`📚 Swagger: http://localhost:${port}/api/docs\n`);
}
bootstrap();
