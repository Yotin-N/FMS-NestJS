import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MqttService } from './mqtt.service';
import { MqttController } from './mqtt.controller';
import * as mqtt from 'mqtt';
import { SensorModule } from '../sensor/sensor.module';
import { SensorReadingModule } from '../sensor-reading/sensor-reading.module';
import { buildMqttClientOptions } from './mqtt-options';

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
        const client = mqtt.connect(buildMqttClientOptions(configService));
        client.on('error', () => undefined);
        return client;
      },
      inject: [ConfigService],
    },
    MqttService,
  ],
  exports: [MqttService],
})
export class MqttModule {}
