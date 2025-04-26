import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { FarmModule } from './farm/farm.module';
import { MqttModule } from './mqtt/mqtt.module';
import { SensorReadingModule } from './sensor-reading/sensor-reading.module';
import { SensorModule } from './sensor/sensor.module';
import { DeviceModule } from './device/device.module';



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
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get('DB_USERNAME', 'root'),
        password: configService.get('DB_PASSWORD', 'example'),
        database: configService.get('DB_DATABASE', 'shrimp_farm'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('DB_SYNCHRONIZE', 'true') === 'true',
        logging: configService.get('DB_LOGGING', 'false') === 'true',
      }),
    }),
    AuthModule,
    UserModule,
    FarmModule,
    DeviceModule,
    SensorModule,
    MqttModule,
    SensorReadingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
