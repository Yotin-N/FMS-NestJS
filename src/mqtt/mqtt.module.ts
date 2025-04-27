import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MqttService } from './mqtt.service';
import { MqttController } from './mqtt.controller';
import * as mqtt from 'mqtt';
import { SensorModule } from '../sensor/sensor.module';
import { SensorReadingModule } from '../sensor-reading/sensor-reading.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => SensorModule),
    forwardRef(() => SensorReadingModule),
  ],
  controllers: [MqttController],
  providers: [
    {
      provide: 'MQTT_CLIENT',
      useFactory: (configService: ConfigService) => {
        // Determine if we should use cloud MQTT or local MQTT
        const useCloudMqtt =
          configService.get<string>('USE_MQTT_CLOUD') === 'true';

        if (useCloudMqtt) {
          return mqtt.connect({
            host: configService.get('MQTT_CLOUD_HOST'),
            port: configService.get('MQTT_CLOUD_PORT', 8883),
            protocol: 'mqtts',
            username: configService.get('MQTT_CLOUD_USERNAME'),
            password: configService.get('MQTT_CLOUD_PASSWORD'),
            clientId: `nestjs_${Math.random().toString(16).slice(2, 8)}`,
            connectTimeout: 5000,
            reconnectPeriod: 1000,
            rejectUnauthorized:
              configService.get('MQTT_CLOUD_REJECT_UNAUTHORIZED', 'true') ===
              'true',
          });
        } else {
          // Local MQTT connection
          const useSSL = configService.get<string>('MQTT_USE_SSL') === 'true';

          return mqtt.connect({
            host: configService.get('MQTT_HOST', 'localhost'),
            port: configService.get('MQTT_PORT', useSSL ? 8883 : 1883),
            protocol: useSSL ? 'mqtts' : 'mqtt',
            username: configService.get('MQTT_USERNAME'),
            password: configService.get('MQTT_PASSWORD'),
            clientId: `nestjs_${Math.random().toString(16).slice(2, 8)}`,
            connectTimeout: 5000,
            reconnectPeriod: 1000,
          });
        }
      },
      inject: [ConfigService],
    },
    MqttService,
  ],
  exports: [MqttService],
})
export class MqttModule {}
