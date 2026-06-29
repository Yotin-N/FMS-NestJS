/* eslint-disable no-useless-escape */
import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import type { MqttClient } from 'mqtt';
import { SensorService } from '../sensor/sensor.service';
import {
  MqttSensorData,
  MqttTopicData,
} from './interfaces/mqtt-message.interface';
import { SensorReadingService } from '../sensor-reading/sensor-reading.service';
import { Sensor } from '../sensor/entities/sensor.entity';
import { SensorResponseDto } from '../sensor/dto/sensor.dto';

@Injectable()
export class MqttService implements OnModuleInit {
  private readonly logger = new Logger(MqttService.name);
  private readonly activeTopics = new Set<string>();
  private readonly topicToSensorMap = new Map<string, string>();
  private readonly subscribeTimeoutMs = 3000;

  constructor(
    @Inject('MQTT_CLIENT') private readonly client: MqttClient,
    private readonly sensorService: SensorService,
    @Inject(forwardRef(() => SensorReadingService))
    private readonly sensorReadingService: SensorReadingService,
  ) {}

  onModuleInit() {
    this.registerClientListeners();
    void this.subscribeGeneralTopics().catch((error) => {
      this.logger.error(
        `Failed to subscribe general MQTT topics: ${error.message}`,
      );
    });
    void this.subscribeToAllSensors();
  }

  private registerClientListeners() {
    this.client.on('connect', () => {
      this.logger.log('Connected to MQTT broker');
      void this.resubscribeActiveTopics();
    });

    this.client.on('reconnect', () => {
      this.logger.warn('MQTT broker reconnecting');
    });

    this.client.on('close', () => {
      this.logger.warn('MQTT broker connection closed');
    });

    this.client.on('offline', () => {
      this.logger.warn('MQTT broker offline');
    });

    this.client.on('error', (error) => {
      this.logger.error(`MQTT client error: ${error.message}`);
    });
  }

  private async subscribeGeneralTopics() {
    await Promise.all([
      this.subscribeTopic('sensor/+'),
      this.subscribeTopic('sensors/+/+'),
      this.subscribeTopic('shrimp_farm/+/device/+/sensor/+'),
    ]);
    this.logger.log('Subscribed to general MQTT patterns');
  }

  private async resubscribeActiveTopics() {
    try {
      await Promise.all(
        [...this.activeTopics].map((topic) => this.subscribeViaClient(topic)),
      );
    } catch (error) {
      this.logger.error(`Failed to resubscribe MQTT topics: ${error.message}`);
    }
  }

  async subscribeToAllSensors() {
    try {
      const sensors = await this.sensorService.findAll(1, 1000);
      for (const sensorDto of sensors.data) {
        // Fetch the full sensor entity with relationships
        const sensor = await this.sensorService.findOne(sensorDto.id);
        await this.subscribeSensor(sensor);
      }
      this.logger.log(`Subscribed to ${sensors.data.length} sensors`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to sensors: ${error.message}`);
    }
  }

  async subscribeSensorById(sensorId: string) {
    try {
      const sensor = await this.sensorService.findOne(sensorId);
      return this.subscribeSensor(sensor);
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to sensor ${sensorId}: ${error.message}`,
      );
      throw error;
    }
  }

  // This method now accepts only full Sensor entities
  async subscribeSensor(sensor: Sensor) {
    try {
      // Generate MQTT topic for the sensor
      const mqttTopic = this.generateMqttTopic(sensor);

      // Subscribe to the primary topic
      if (!this.activeTopics.has(mqttTopic)) {
        await this.subscribeTopic(mqttTopic, sensor.id);
        this.activeTopics.add(mqttTopic);
        this.logger.log(`Subscribed to primary topic: ${mqttTopic}`);
      }

      // Also subscribe to the serial number based topic as fallback
      const serialTopic = `sensor/${sensor.serialNumber}`;
      if (!this.activeTopics.has(serialTopic)) {
        await this.subscribeTopic(serialTopic, sensor.id);
        this.activeTopics.add(serialTopic);
        this.logger.log(`Subscribed to serial topic: ${serialTopic}`);
      }

      // Type-based topic for grouping similar sensors
      const typeTopic = `sensors/${sensor.type.toLowerCase()}/${sensor.serialNumber}`;
      if (!this.activeTopics.has(typeTopic)) {
        await this.subscribeTopic(typeTopic, sensor.id);
        this.activeTopics.add(typeTopic);
        this.logger.log(`Subscribed to type topic: ${typeTopic}`);
      }

      return mqttTopic;
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to sensor ${sensor.id}: ${error.message}`,
      );
      throw error;
    }
  }

  private async subscribeTopic(topic: string, sensorId?: string) {
    try {
      if (sensorId) {
        this.topicToSensorMap.set(topic, sensorId);
      }

      if (this.activeTopics.has(topic)) {
        return;
      }

      this.activeTopics.add(topic);
      await this.subscribeViaClient(topic);
      this.logger.log(`Subscribed to topic: ${topic}`);
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to topic ${topic}: ${error.message}`,
      );
      throw error;
    }
  }

  private async subscribeViaClient(topic: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        settled = true;
        this.logger.warn(
          `MQTT subscribe timed out for topic ${topic}; it will retry on reconnect`,
        );
        resolve();
      }, this.subscribeTimeoutMs);

      this.client.subscribe(topic, (error) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);

        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
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

      // Use SensorReadingService to create a new reading
      await this.sensorReadingService.create({
        sensorId,
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

      try {
        const sensor =
          await this.sensorService.findBySerialNumber(serialNumber);

        // Use SensorReadingService to create a new reading
        await this.sensorReadingService.create({
          sensorId: sensor.id,
          value: data.value,
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        });

        this.logger.debug(
          `Saved reading for sensor ${sensor.id}: ${data.value}`,
        );
      } catch (error) {
        this.logger.error(
          `Error finding sensor by serial number: ${error.message}`,
        );
      }
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
      this.activeTopics.delete(topic);
      this.topicToSensorMap.delete(topic);
      await this.unsubscribeViaClient(topic);
      this.logger.log(`Unsubscribed from topic: ${topic}`);
    } catch (error) {
      this.logger.error(
        `Failed to unsubscribe from topic ${topic}: ${error.message}`,
      );
    }
  }

  private async unsubscribeViaClient(topic: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        settled = true;
        this.logger.warn(`MQTT unsubscribe timed out for topic ${topic}`);
        resolve();
      }, this.subscribeTimeoutMs);

      this.client.unsubscribe(topic, (error) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);

        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  // Method to generate MQTT topic for a sensor entity or DTO
  generateMqttTopic(sensor: Sensor | SensorResponseDto): string {
    // For Sensor entity with relationships
    if ('device' in sensor && sensor.device?.farm?.id) {
      return `shrimp_farm/${sensor.device.farm.id}/device/${sensor.deviceId}/sensor/${sensor.type.toLowerCase()}`;
    }

    // Fallback to serial number if full hierarchy isn't available
    return `sensor/${sensor.serialNumber}`;
  }

  // Method to handle sensor creation - subscribe to the necessary topics
  async handleSensorCreated(sensorId: string): Promise<string> {
    const sensor = await this.sensorService.findOne(sensorId);
    const mqttTopic = this.generateMqttTopic(sensor);
    void this.subscribeSensor(sensor).catch((error) => {
      this.logger.error(
        `Failed to subscribe newly created sensor ${sensorId}: ${error.message}`,
      );
    });
    return mqttTopic;
  }

  // Method to handle sensor updates - update subscriptions if needed
  async handleSensorUpdated(
    sensorId: string,
    oldSerialNumber?: string,
  ): Promise<string> {
    try {
      const sensor = await this.sensorService.findOne(sensorId);

      // If the serial number changed, unsubscribe from old topics
      if (oldSerialNumber && oldSerialNumber !== sensor.serialNumber) {
        const oldSerialTopic = `sensor/${oldSerialNumber}`;
        const oldTypeTopic = `sensors/${sensor.type.toLowerCase()}/${oldSerialNumber}`;

        await this.unsubscribeTopic(oldSerialTopic);
        await this.unsubscribeTopic(oldTypeTopic);
      }

      const mqttTopic = this.generateMqttTopic(sensor);
      void this.subscribeSensor(sensor).catch((error) => {
        this.logger.error(
          `Failed to resubscribe updated sensor ${sensorId}: ${error.message}`,
        );
      });
      return mqttTopic;
    } catch (error) {
      this.logger.error(
        `Failed to update subscriptions for sensor ${sensorId}: ${error.message}`,
      );
      throw error;
    }
  }

  // Method to handle sensor deletion - unsubscribe from topics
  async handleSensorDeleted(
    sensorId: string,
    serialNumber: string,
    type: string,
  ): Promise<void> {
    try {
      // We need to generate topics without fetching the sensor since it might be deleted already
      const serialTopic = `sensor/${serialNumber}`;
      const typeTopic = `sensors/${type.toLowerCase()}/${serialNumber}`;

      // Try to unsubscribe from all possible topics
      await this.unsubscribeTopic(serialTopic);
      await this.unsubscribeTopic(typeTopic);

      // Clean up any remaining topics for this sensor
      this.topicToSensorMap.forEach((sid, topic) => {
        if (sid === sensorId) {
          this.unsubscribeTopic(topic);
        }
      });
    } catch (error) {
      this.logger.error(
        `Error unsubscribing deleted sensor ${sensorId}: ${error.message}`,
      );
    }
  }
}
