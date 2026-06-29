import type { MqttClient } from 'mqtt';
import { MqttService } from './mqtt.service';
import { Sensor, SensorType } from '../sensor/entities/sensor.entity';
import type { SensorService } from '../sensor/sensor.service';
import type { SensorReadingService } from '../sensor-reading/sensor-reading.service';

type TestMqttClient = MqttClient & {
  emit: jest.Mock;
  on: jest.Mock;
  subscribe: jest.Mock;
};

describe('MqttService', () => {
  const createClient = () => {
    const client = {
      subscribe: jest.fn(
        (_topic: string, callback: (error?: Error) => void) => {
          callback();
          return client as unknown as MqttClient;
        },
      ),
      emit: jest.fn(),
      on: jest.fn(),
    } as unknown as TestMqttClient;

    return client;
  };

  it('subscribes sensors through the MQTT client subscribe API', async () => {
    const client = createClient();
    const sensorService = {};
    const sensorReadingService = {};
    const service = new MqttService(
      client,
      sensorService as unknown as SensorService,
      sensorReadingService as unknown as SensorReadingService,
    );
    const sensor = {
      id: 'sensor-id',
      serialNumber: 'SN12345678',
      type: SensorType.pH,
      deviceId: 'device-id',
      device: {
        farm: {
          id: 'farm-id',
        },
      },
    } as unknown as Sensor;

    await service.subscribeSensor(sensor);

    expect(client.subscribe).toHaveBeenCalledWith(
      'shrimp_farm/farm-id/device/device-id/sensor/ph',
      expect.any(Function),
    );
    expect(client.subscribe).toHaveBeenCalledWith(
      'sensor/SN12345678',
      expect.any(Function),
    );
    expect(client.subscribe).toHaveBeenCalledWith(
      'sensors/ph/SN12345678',
      expect.any(Function),
    );
    expect(client.emit).not.toHaveBeenCalledWith(
      'mqtt_subscribe',
      expect.anything(),
    );
  });

  it('saves numeric MQTT payloads for subscribed sensor topics', async () => {
    const client = createClient();
    const sensorService = {};
    const sensorReadingService = {
      create: jest.fn(),
    };
    const service = new MqttService(
      client,
      sensorService as unknown as SensorService,
      sensorReadingService as unknown as SensorReadingService,
    );
    const sensor = {
      id: 'sensor-id',
      serialNumber: 'SN0004',
      type: SensorType.TempB,
      deviceId: 'device-id',
      device: {
        farm: {
          id: 'farm-id',
        },
      },
    } as unknown as Sensor;

    await service.subscribeSensor(sensor);
    await service.processMessage('sensors/tempb/SN0004', 32);

    expect(sensorReadingService.create).toHaveBeenCalledWith({
      sensorId: 'sensor-id',
      value: 32,
      timestamp: expect.any(Date),
    });
  });
});
