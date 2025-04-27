import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload, Ctx } from '@nestjs/microservices';
import { MqttContext } from '@nestjs/microservices/ctx-host/mqtt.context';
import { SensorService } from '../sensor/sensor.service';
import { MqttService } from './mqtt.service';
import { MqttSensorData } from './interfaces/mqtt-message.interface';

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
    await this.mqttService.processMessage(topic, data);
  }

  @MessagePattern('sensors/+/+')
  async handleTypeSensor(@Payload() data: any, @Ctx() context: MqttContext) {
    const topic = context.getTopic();
    this.logger.debug(`Received type-based sensor message on topic ${topic}`);
    await this.mqttService.processMessage(topic, data);
  }
}
