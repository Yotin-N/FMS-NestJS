// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { FarmModule } from './farm/farm.module';
import { DeviceModule } from './device/device.module';
import { SensorModule } from './sensor/sensor.module';
import { SensorReadingModule } from './sensor-reading/sensor-reading.module';
import { MqttModule } from './mqtt/mqtt.module';
import * as fs from 'fs';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'false',
        logging: configService.get<string>('DB_LOGGING') === 'true',
        ssl:
          configService.get('DB_SSL') === 'true'
            ? {
                ca: fs.readFileSync(process.cwd() + '/src/certs/tidb.pem'),
                minVersion: 'TLSv1.2',
              }
            : undefined,
      }),
    }),
    AuthModule,
    UserModule,
    FarmModule,
    DeviceModule,
    SensorModule,
    SensorReadingModule,
    MqttModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
