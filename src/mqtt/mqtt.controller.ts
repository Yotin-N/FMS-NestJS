import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
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
  async handleFarmDeviceSensor(@Payload() data: MqttSensorData) {
    this.logger.debug(
      `Received hierarchical shrimp_farm message: ${JSON.stringify(data)}`,
    );
    // The actual processing happens in the MqttService through subscriptions
  }

  @MessagePattern('sensor/+')
  async handleSensor(@Payload() data: MqttSensorData) {
    this.logger.debug(
      `Received direct sensor message: ${JSON.stringify(data)}`,
    );
    // The actual processing happens in the MqttService through subscriptions
  }

  @MessagePattern('sensors/+/+')
  async handleTypeSensor(@Payload() data: MqttSensorData) {
    this.logger.debug(
      `Received type-based sensor message: ${JSON.stringify(data)}`,
    );
    // The actual processing happens in the MqttService through subscriptions
  }
}
