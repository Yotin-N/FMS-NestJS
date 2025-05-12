// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const configService = app.get(ConfigService);

  // Determine if we should use cloud MQTT or local MQTT
  const useCloudMqtt = configService.get<string>('USE_MQTT_CLOUD') === 'true';

  let mqttOptions: any;

  if (useCloudMqtt) {
    logger.log('Configuring MQTT connection to cloud broker');

    mqttOptions = {
      transport: Transport.MQTT,
      options: {
        url: configService.get<string>('MQTT_CLOUD_URL'),
        port: configService.get<number>('MQTT_CLOUD_PORT', 8883),
        protocol: 'mqtts',
        username: configService.get<string>('MQTT_CLOUD_USERNAME'),
        password: configService.get<string>('MQTT_CLOUD_PASSWORD'),
        clientId: configService.get<string>(
          'MQTT_CLOUD_CLIENT_ID',
          `shrimp-farm-cloud-${Math.random().toString(16).slice(3)}`,
        ),
        connectTimeout: 5000,
        reconnectPeriod: 1000,
        queueQoSZero: false,
        reschedulePings: true,
        keepalive: 60,
        rejectUnauthorized: false, // Consider setting to true in production with proper CA certificates
      },
    };

    // Add CA certificate if provided
    const caFile = configService.get<string>('MQTT_CLOUD_CA_FILE');
    if (caFile) {
      const caFilePath = path.resolve(caFile);
      if (fs.existsSync(caFilePath)) {
        logger.log(`Using CA certificate from ${caFilePath}`);
        mqttOptions.options.ca = fs.readFileSync(caFilePath);
      } else {
        logger.warn(`CA certificate file not found: ${caFilePath}`);
      }
    }
  } else {
    logger.log('Configuring MQTT connection to local broker');

    // Local MQTT connection
    const useSSL = configService.get<string>('MQTT_USE_SSL') === 'true';

    mqttOptions = {
      transport: Transport.MQTT,
      options: {
        url: configService.get<string>('MQTT_URL', 'mqtt://localhost:1883'),
        port: configService.get<number>('MQTT_PORT', 1883),
        protocol: useSSL ? 'mqtts' : 'mqtt',
        username: configService.get<string>('MQTT_USERNAME'),
        password: configService.get<string>('MQTT_PASSWORD'),
        clientId: configService.get<string>(
          'MQTT_CLIENT_ID',
          `shrimp-farm-backend-${Math.random().toString(16).slice(3)}`,
        ),
      },
    };

    // Add CA certificate if using SSL and provided
    if (useSSL) {
      const caFile = configService.get<string>('MQTT_CA_FILE');
      if (caFile) {
        const caFilePath = path.resolve(caFile);
        if (fs.existsSync(caFilePath)) {
          logger.log(`Using CA certificate from ${caFilePath}`);
          mqttOptions.options.ca = fs.readFileSync(caFilePath);
        } else {
          logger.warn(`CA certificate file not found: ${caFilePath}`);
        }
      }
    }
  }

  // Load MQTT connection
  app.connectMicroservice<MicroserviceOptions>(mqttOptions);

  // Global configurations
  app.use(cookieParser());

  // CORS configuration - UPDATED to allow multiple origins
  // Get origin configuration from environment variables or use default values
  const corsOrigin = configService.get<string>(
    'CORS_ORIGIN',
    'http://localhost:3000,http://localhost:3001,https://farm-management-theta.vercel.app',
  );

  // Parse multiple origins if provided as comma-separated string
  const origins = corsOrigin.split(',').map((origin) => origin.trim());

  app.enableCors({
    origin: origins.length === 1 ? origins[0] : origins,
    credentials: true,
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

  // Start MQTT microservice
  await app.startAllMicroservices();
  logger.log('MQTT microservice started');

  // Start HTTP server
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`Application is running on port ${port}`);
}

bootstrap();
