// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { MicroserviceOptions } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  buildMqttMicroserviceOptions,
  startMqttMicroservices,
} from './mqtt/mqtt-options';
import { buildCorsOriginDelegate } from './config/cors.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const configService = app.get(ConfigService);
  const mqttConfig = buildMqttMicroserviceOptions(configService, logger);

  if (mqttConfig.enabled && mqttConfig.options) {
    app.connectMicroservice<MicroserviceOptions>(mqttConfig.options);
    logger.log('MQTT microservice configured');
  } else {
    logger.warn('MQTT is disabled; HTTP API will run without MQTT ingestion');
  }

  // Global configurations
  app.use(cookieParser());

  app.enableCors({
    origin: buildCorsOriginDelegate(configService.get<string>('CORS_ORIGIN')),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // API documentation with Swagger - IMPROVED CONFIGURATION
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const options = new DocumentBuilder()
      .setTitle('Shrimp Farm Management API')
      .setDescription('The API for managing shrimp farms, devices, and sensors')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Enter JWT token (without Bearer prefix)',
          in: 'header',
        },
        'access-token', // This key identifies the security scheme
      )
      .build();

    const document = SwaggerModule.createDocument(app, options);

    // Configure Swagger UI
    SwaggerModule.setup('api', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        defaultModelsExpandDepth: -1,
        defaultModelExpandDepth: -1,
      },
    });

    logger.log('Swagger documentation available at /api');
  }

  if (mqttConfig.enabled && mqttConfig.startupRequired) {
    await startMqttMicroservices(app, logger, true);
  }

  // Start HTTP server
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`Application is running on port ${port}`);

  if (mqttConfig.enabled && !mqttConfig.startupRequired) {
    await startMqttMicroservices(app, logger, false);
  }
}

bootstrap();
