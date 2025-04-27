import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MqttService } from './mqtt.service';
import { MqttController } from './mqtt.controller';
import { SensorModule } from '../sensor/sensor.module';
import { DeviceModule } from '../device/device.module';
import * as fs from 'fs';
import * as path from 'path';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'MQTT_CLIENT',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const useSSL = configService.get<string>('MQTT_USE_SSL') === 'true';
          const caFile = configService.get<string>('MQTT_CA_FILE');

          const mqttConfig: any = {
            transport: Transport.MQTT,
            options: {
              url: configService.get<string>(
                'MQTT_URL',
                'mqtt://localhost:1883',
              ),
              port: configService.get<number>('MQTT_PORT', 1883),
              protocol: configService.get<string>('MQTT_PROTOCOL', 'mqtt'),
              username: configService.get<string>('MQTT_USERNAME'),
              password: configService.get<string>('MQTT_PASSWORD'),
              clientId: configService.get<string>(
                'MQTT_CLIENT_ID',
                `shrimp-farm-backend-${Math.random().toString(16).slice(3)}`,
              ),
              connectTimeout: 5000,
              reconnectPeriod: 1000,
              // Add these options to ensure proper subscription behavior
              queueQoSZero: false, // Don't queue QoS 0 messages if client offline
              reschedulePings: true, // Reschedule ping timer when connection established
              keepalive: 60, // Keep connection alive (in seconds)
            },
          };

          // Add SSL configuration if enabled
          if (useSSL) {
            mqttConfig.options.protocol = 'mqtts';

            // Add CA certificate if provided
            if (caFile) {
              mqttConfig.options.ca = fs.readFileSync(path.resolve(caFile));
            }
          }

          return mqttConfig;
        },
      },
    ]),
    SensorModule,
    DeviceModule,
  ],
  controllers: [MqttController],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}
