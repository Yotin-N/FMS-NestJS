// mqtt.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MqttService } from './mqtt.service';
import * as mqtt from 'mqtt';
import { SensorModule } from '../sensor/sensor.module';
import { SensorReadingModule } from '../sensor-reading/sensor-reading.module';

@Module({
  imports: [ConfigModule, SensorModule, SensorReadingModule],
  providers: [
    {
      provide: 'MQTT_CLIENT',
      useFactory: (configService: ConfigService) => {
        return mqtt.connect({
          host: configService.get('MQTT_HOST'),
          port: configService.get('MQTT_PORT'),
          username: configService.get('MQTT_USERNAME'),
          password: configService.get('MQTT_PASSWORD'),
          clientId: `nestjs_${Math.random().toString(16).substr(2, 8)}`,
          protocol: 'mqtts',
          reconnectPeriod: 5000,
          keepalive: 30,
          connectTimeout: 5000,
          rejectUnauthorized: true,
        });
      },
      inject: [ConfigService],
    },
    MqttService,
  ],
  exports: [MqttService],
})
export class MqttModule {}
