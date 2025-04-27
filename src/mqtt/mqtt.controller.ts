import { Controller, Logger } from '@nestjs/common';
import {
  MessagePattern,
  Payload,
  Ctx,
  MqttContext,
} from '@nestjs/microservices';
import { SensorService } from '../sensor/sensor.service';
import { MqttService } from './mqtt.service';

@Controller()
export class MqttController {
  private readonly logger = new Logger(MqttController.name);

  constructor(
    private readonly mqttService: MqttService,
    private readonly sensorService: SensorService,
  ) {}

  // Define message patterns for different MQTT topics
  @MessagePattern('shrimp_farm/+/device/+/sensor/+')
  async handleFarmDeviceSensor(
    @Payload() data: any,
    @Ctx() context: MqttContext,
  ) {
    const topic = context.getTopic();
    this.logger.debug(
      `Received hierarchical shrimp_farm message on topic ${topic}`,
    );
    await this.mqttService.processMessage(topic, data);
  }

  @MessagePattern('sensor/+')
  async handleSensor(@Payload() data: any, @Ctx() context: MqttContext) {
    const topic = context.getTopic();
    this.logger.debug(`Received direct sensor message on topic ${topic}`);
    this.logger.debug(`Message payload: ${JSON.stringify(data)}`);
    await this.mqttService.processMessage(topic, data);
  }

  @MessagePattern('sensors/+/+')
  async handleTypeSensor(@Payload() data: any, @Ctx() context: MqttContext) {
    const topic = context.getTopic();
    this.logger.debug(`Received type-based sensor message on topic ${topic}`);
    await this.mqttService.processMessage(topic, data);
  }

  // Add a wildcard pattern to catch any unhandled topics
  @MessagePattern('#')
  async handleAnyTopic(@Payload() data: any, @Ctx() context: MqttContext) {
    const topic = context.getTopic();
    // Only process if it's not one of our already-handled patterns
    if (
      !topic.startsWith('shrimp_farm/') &&
      !topic.startsWith('sensor/') &&
      !topic.startsWith('sensors/')
    ) {
      this.logger.debug(`Received message on unhandled topic ${topic}`);
      await this.mqttService.processMessage(topic, data);
    }
  }
}
