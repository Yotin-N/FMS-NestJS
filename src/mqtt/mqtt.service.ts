/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/await-thenable */
import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { SensorService } from '../sensor/sensor.service';
import { SensorType } from '../sensor/entities/sensor.entity';
import {
  MqttSensorData,
  MqttTopicData,
} from './interfaces/mqtt-message.interface';

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

      // Subscribe to general patterns
      await this.client.emit('mqtt_subscribe', { topic: 'sensor/+' });
      await this.client.emit('mqtt_subscribe', { topic: 'sensors/+/+' });
      await this.client.emit('mqtt_subscribe', {
        topic: 'shrimp_farm/+/device/+/sensor/+',
      });

      this.logger.log('Subscribed to general MQTT patterns');
      await this.subscribeToAllSensors();
    } catch (error) {
      this.logger.error(`MQTT initialization failed: ${error.message}`);
    }
  }

  async subscribeToAllSensors() {
    try {
      const sensors = await this.sensorService.findAll(1, 1000);
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

  async subscribeSensorTopics(
    sensorId: string,
    serialNumber: string,
    type: SensorType,
  ) {
    try {
      const sensor = await this.sensorService.findOne(sensorId);
      const deviceId = sensor.deviceId;
      const farmId = sensor.device.farm.id;

      const topics = [
        `shrimp_farm/${farmId}/device/${deviceId}/sensor/${type.toLowerCase()}`,
        `sensor/${serialNumber}`,
        `sensors/${type.toLowerCase()}/${serialNumber}`,
      ];

      for (const topic of topics) {
        if (!this.activeTopics.has(topic)) {
          await this.subscribeTopic(topic, sensorId);
          this.activeTopics.add(topic);
          this.logger.log(`Subscribed to topic: ${topic}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to sensor ${sensorId}: ${error.message}`,
      );
    }
  }

  private async subscribeTopic(topic: string, sensorId: string) {
    try {
      await this.client.emit('mqtt_subscribe', { topic });
      this.topicToSensorMap.set(topic, sensorId);
      this.logger.log(`Subscribed to topic: ${topic}`);
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to topic ${topic}: ${error.message}`,
      );
    }
  }

  async processMessage(topic: string, message: any) {
    try {
      this.logger.debug(`Processing message from topic: ${topic}`);

      // Try to get sensorId from direct topic mapping first
      const sensorId = this.topicToSensorMap.get(topic);
      if (sensorId) {
        await this.handleMessageWithSensor(topic, message, sensorId);
        return;
      }

      // Fallback to message parsing if no direct mapping
      await this.handleMessage(topic, message);
    } catch (error) {
      this.logger.error(`Error processing MQTT message: ${error.message}`);
    }
  }

  private async handleMessageWithSensor(
    topic: string,
    message: any,
    sensorId: string,
  ) {
    try {
      const data = this.parseMessage(message);
      if (!data) {
        this.logger.warn(`Invalid message format for sensor ${sensorId}`);
        return;
      }

      await this.sensorService.addReading(sensorId, {
        value: data.value,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      });

      this.logger.debug(`Saved reading for sensor ${sensorId}: ${data.value}`);
    } catch (error) {
      this.logger.error(
        `Error handling message for sensor ${sensorId}: ${error.message}`,
      );
    }
  }

  private async handleMessage(topic: string, message: any) {
    try {
      const data = this.parseMessage(message);
      if (!data) {
        this.logger.warn(`Invalid message format for topic ${topic}`);
        return;
      }

      const topicData = this.parseTopicPattern(topic);
      const serialNumber = data.serialNumber || topicData.serialNumber;

      if (!serialNumber) {
        this.logger.warn(
          `Cannot determine sensor from message or topic: ${topic}`,
        );
        return;
      }

      const sensor = await this.sensorService.findBySerialNumber(serialNumber);
      await this.sensorService.addReading(sensor.id, {
        value: data.value,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      });

      this.logger.debug(`Saved reading for sensor ${sensor.id}: ${data.value}`);
    } catch (error) {
      this.logger.error(`Error handling message: ${error.message}`);
    }
  }

  private parseMessage(message: any): MqttSensorData | null {
    try {
      let parsed: any;

      if (Buffer.isBuffer(message)) {
        message = message.toString();
      }

      if (typeof message === 'string') {
        try {
          parsed = JSON.parse(message);
        } catch {
          // Try to parse as plain number
          const numValue = Number(message);
          if (!isNaN(numValue)) {
            return { value: numValue };
          }
          return null;
        }
      } else if (typeof message === 'object') {
        parsed = message;
      } else {
        return null;
      }

      // Validate required value field
      if (parsed.value === undefined || parsed.value === null) {
        return null;
      }

      const numValue = Number(parsed.value);
      if (isNaN(numValue)) {
        return null;
      }

      return {
        value: numValue,
        timestamp: parsed.timestamp,
        serialNumber: parsed.serialNumber,
        type: parsed.type,
        deviceId: parsed.deviceId,
        farmId: parsed.farmId,
      };
    } catch (error) {
      this.logger.error(`Message parsing error: ${error.message}`);
      return null;
    }
  }

  private parseTopicPattern(topic: string): MqttTopicData {
    const patterns = [
      {
        // eslint-disable-next-line no-useless-escape
        regex: /^shrimp_farm\/([^\/]+)\/device\/([^\/]+)\/sensor\/([^\/]+)$/,
        handler: (match: RegExpExecArray) => ({
          farmId: match[1],
          deviceId: match[2],
          sensorType: match[3],
        }),
      },
      {
        regex: /^sensor\/([^\/]+)$/,
        handler: (match: RegExpExecArray) => ({
          serialNumber: match[1],
        }),
      },
      {
        regex: /^sensors\/([^\/]+)\/([^\/]+)$/,
        handler: (match: RegExpExecArray) => ({
          sensorType: match[1],
          serialNumber: match[2],
        }),
      },
    ];

    for (const pattern of patterns) {
      const match = pattern.regex.exec(topic);
      if (match) {
        return pattern.handler(match);
      }
    }

    return {};
  }

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
