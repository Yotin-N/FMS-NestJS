import { Controller, Logger, Inject, forwardRef } from '@nestjs/common';
import { EventPattern, Payload, Ctx, MqttContext } from '@nestjs/microservices';
import { SensorService } from '../sensor/sensor.service';
import { MqttService } from './mqtt.service';

@Controller()
export class MqttController {
  private readonly logger = new Logger(MqttController.name);

  constructor(
    private readonly mqttService: MqttService,
    @Inject(forwardRef(() => SensorService))
    private readonly sensorService: SensorService,
  ) {}

  // Define message patterns for different MQTT topics
  @EventPattern('shrimp_farm/+/device/+/sensor/+')
  async handleFarmDeviceSensor(
    @Payload() data: any,
    @Ctx() context: MqttContext,
  ) {
    const topic = context.getTopic();
    this.logger.log(
      `MQTT received hierarchical topic=${topic} payload=${JSON.stringify(data)}`,
    );
    await this.mqttService.processMessage(topic, data);
  }

  @EventPattern('sensor/+')
  async handleSensor(@Payload() data: any, @Ctx() context: MqttContext) {
    const topic = context.getTopic();
    this.logger.log(
      `MQTT received direct topic=${topic} payload=${JSON.stringify(data)}`,
    );
    await this.mqttService.processMessage(topic, data);
  }

  @EventPattern('sensors/+/+')
  async handleTypeSensor(@Payload() data: any, @Ctx() context: MqttContext) {
    const topic = context.getTopic();
    this.logger.log(
      `MQTT received type topic=${topic} payload=${JSON.stringify(data)}`,
    );
    await this.mqttService.processMessage(topic, data);
  }

  // Add a wildcard pattern to catch any unhandled topics
  @EventPattern('#')
  async handleAnyTopic(@Payload() data: any, @Ctx() context: MqttContext) {
    const topic = context.getTopic();
    // Only process if it's not one of our already-handled patterns
    if (
      !topic.startsWith('shrimp_farm/') &&
      !topic.startsWith('sensor/') &&
      !topic.startsWith('sensors/')
    ) {
      this.logger.log(
        `MQTT received unhandled topic=${topic} payload=${JSON.stringify(data)}`,
      );
      await this.mqttService.processMessage(topic, data);
    }
  }
}
