/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/await-thenable */
import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { SensorService } from '../sensor/sensor.service';
import {
  MqttSensorData,
  MqttTopicData,
} from './interfaces/mqtt-message.interface';
import { SensorType } from '../sensor/entities/sensor.entity';

@Injectable()
export class MqttService implements OnModuleInit {
  private readonly logger = new Logger(MqttService.name);
  private readonly activeTopics = new Set<string>();
  private readonly topicToSensorMap = new Map<string, string>();

  constructor(
    @Inject('MQTT_CLIENT') private readonly client: ClientProxy,
    private readonly sensorService: SensorService,
  ) {}

  async onModuleInit() {
    try {
      await this.client.connect();
      this.logger.log('Connected to MQTT broker');
      await this.subscribeToAllSensors();
    } catch (error) {
      this.logger.error(`Failed to connect to MQTT broker: ${error.message}`);
    }
  }

  /**
   * Subscribe to all sensors in the database
   */
  async subscribeToAllSensors() {
    try {
      // Fetch all sensors from database - you might want to paginate if there are many
      const sensors = await this.sensorService.findAll(1, 1000);

      // Subscribe to each sensor's topic patterns
      for (const sensor of sensors.data) {
        await this.subscribeSensorTopics(
          sensor.id,
          sensor.serialNumber,
          sensor.type,
        );
      }

      this.logger.log(`Subscribed to ${sensors.data.length} sensors`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to sensors: ${error.message}`);
    }
  }
  /**
   * Subscribe to new sensor topics when a sensor is added
   */
  async subscribeSensorTopics(
    sensorId: string,
    serialNumber: string,
    type: SensorType,
  ) {
    try {
      // Get device and farm info
      const sensor = await this.sensorService.findOne(sensorId);
      const deviceId = sensor.deviceId;
      const farmId = sensor.device.farm.id;

      // EMQX recommended topic structure for IoT devices
      const topics = [
        // Standard hierarchical structure (recommended)
        `shrimp_farm/${farmId}/device/${deviceId}/sensor/${type.toLowerCase()}`,

        // Direct sensor identification
        `sensor/${serialNumber}`,

        // Type-based grouping
        `sensors/${type.toLowerCase()}/${serialNumber}`,
      ];

      for (const topic of topics) {
        if (!this.activeTopics.has(topic)) {
          await this.subscribeTopic(topic, sensorId);
          this.activeTopics.add(topic);
        }
      }

      this.logger.log(`Subscribed to topics for sensor ${serialNumber}`);
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to sensor ${sensorId}: ${error.message}`,
      );
    }
  }

  private async subscribeTopic(topic: string, sensorId: string) {
    try {
      // Use the established pattern in your codebase
      await this.client.emit('mqtt_subscribe', { topic });

      // Store the sensor ID mapping for this topic
      this.topicToSensorMap.set(topic, sensorId);

      this.logger.log(`Successfully subscribed to topic: ${topic}`);
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to topic ${topic}: ${error.message}`,
      );
    }
  }

  /**
   * Process incoming MQTT messages from controller
   */
  async processMessage(topic: string, message: any) {
    try {
      // Get the sensorId from our mapping
      const sensorId = this.topicToSensorMap.get(topic);

      if (sensorId) {
        // Process with the known sensorId
        await this.handleMessage(topic, message, sensorId);
      } else {
        // Try to determine the sensor from the message or topic
        await this.handleMessage(topic, message);
      }
    } catch (error) {
      this.logger.error(`Error processing MQTT message: ${error.message}`);
    }
  }

  /**
   * Handle incoming MQTT messages
   */
  private async handleMessage(topic: string, message: any, sensorId?: string) {
    try {
      this.logger.debug(
        `Received message on topic ${topic}: ${JSON.stringify(message)}`,
      );

      // Parse the topic to extract metadata if available
      const topicData = this.parseTopicPattern(topic);

      // Parse the message (could be string or buffer)
      let data: MqttSensorData;

      if (typeof message === 'string') {
        try {
          data = JSON.parse(message);
        } catch (e) {
          // If not JSON, try to parse as a simple numeric value
          const value = parseFloat(message);
          if (!isNaN(value)) {
            data = { value };
          } else {
            throw new Error(
              `Could not parse message as JSON or number: ${message}`,
            );
          }
        }
      } else if (Buffer.isBuffer(message)) {
        try {
          data = JSON.parse(message.toString());
        } catch (e) {
          // If not JSON, try to parse as a simple numeric value
          const value = parseFloat(message.toString());
          if (!isNaN(value)) {
            data = { value };
          } else {
            throw new Error(`Could not parse buffer message as JSON or number`);
          }
        }
      } else if (typeof message === 'object') {
        data = message;
      } else {
        throw new Error(`Unsupported message format: ${typeof message}`);
      }

      if (data && typeof data.value === 'number') {
        // Determine the sensor to use
        let targetSensorId = sensorId;

        // If we don't have a sensor ID from the subscription, try to find it
        if (!targetSensorId) {
          if (data.serialNumber) {
            // Find sensor by serial number
            const sensor = await this.sensorService.findBySerialNumber(
              data.serialNumber,
            );
            targetSensorId = sensor.id;
          } else if (topicData.serialNumber) {
            // Find sensor by serial number from topic
            const sensor = await this.sensorService.findBySerialNumber(
              topicData.serialNumber,
            );
            targetSensorId = sensor.id;
          } else if (topicData.deviceId && topicData.sensorType) {
            // Find sensor by device ID and type
            // Would need additional methods in SensorService to support this lookup
            this.logger.warn(
              `Topic-based sensor lookup by device and type not implemented`,
            );
            return;
          }
        }

        if (!targetSensorId) {
          this.logger.warn(
            `Could not determine sensor ID for message: ${JSON.stringify(data)}`,
          );
          return;
        }

        // Save the sensor reading
        await this.sensorService.addReading(targetSensorId, {
          value: data.value,
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        });

        this.logger.debug(
          `Saved reading for sensor ${targetSensorId}: ${data.value}`,
        );
      } else {
        this.logger.warn(
          `Invalid sensor data format, missing value: ${JSON.stringify(data)}`,
        );
      }
    } catch (error) {
      this.logger.error(`Error handling MQTT message: ${error.message}`);
    }
  }

  /**
   * Parse the topic string to extract metadata
   */
  private parseTopicPattern(topic: string): MqttTopicData {
    const result: MqttTopicData = {};

    // Pattern: farm/{farmId}/device/{deviceId}/sensor/{sensorType}
    const farmDeviceSensorPattern =
      /^farm\/([^\/]+)\/device\/([^\/]+)\/sensor\/([^\/]+)$/;
    const farmMatch = farmDeviceSensorPattern.exec(topic);

    if (farmMatch) {
      result.farmId = farmMatch[1];
      result.deviceId = farmMatch[2];
      result.sensorType = farmMatch[3];
      return result;
    }

    // Pattern: sensor/{serialNumber}
    const sensorPattern = /^sensor\/([^\/]+)$/;
    const sensorMatch = sensorPattern.exec(topic);

    if (sensorMatch) {
      result.serialNumber = sensorMatch[1];
      return result;
    }

    // Pattern: sensors/{serialNumber}
    const sensorsPattern = /^sensors\/([^\/]+)$/;
    const sensorsMatch = sensorsPattern.exec(topic);

    if (sensorsMatch) {
      result.serialNumber = sensorsMatch[1];
      return result;
    }

    // Pattern: {sensorType}/{serialNumber}
    const typePattern = /^([^\/]+)\/([^\/]+)$/;
    const typeMatch = typePattern.exec(topic);

    if (typeMatch) {
      result.sensorType = typeMatch[1];
      result.serialNumber = typeMatch[2];
      return result;
    }

    return result;
  }

  /**
   * Unsubscribe from a topic
   */
  async unsubscribeTopic(topic: string) {
    try {
      await this.client.emit('mqtt_unsubscribe', { topic });
      this.activeTopics.delete(topic);
      this.topicToSensorMap.delete(topic);
      this.logger.log(`Unsubscribed from topic: ${topic}`);
    } catch (error) {
      this.logger.error(
        `Failed to unsubscribe from topic ${topic}: ${error.message}`,
      );
    }
  }
}
