import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Load MQTT connection
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.MQTT,
    options: {
      url: configService.get<string>('MQTT_URL', 'mqtt://localhost:1883'),
      port: configService.get<number>('MQTT_PORT', 1883),
      username: configService.get<string>('MQTT_USERNAME'),
      password: configService.get<string>('MQTT_PASSWORD'),
    },
  });

  // Global configurations
  app.use(cookieParser());
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
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
        defaultModelsExpandDepth: 3,
        defaultModelExpandDepth: 3,
      },
    });

    console.log('Swagger documentation available at /api');
  }

  // Start MQTT microservice
  await app.startAllMicroservices();

  // Start HTTP server
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`Application is running on port ${port}`);
}

bootstrap();
