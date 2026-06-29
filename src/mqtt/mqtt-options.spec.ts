import { Transport } from '@nestjs/microservices';
import {
  buildMqttClientOptions,
  buildMqttMicroserviceOptions,
  ConfigLike,
  startMqttMicroservices,
} from './mqtt-options';

const createConfig = (values: Record<string, unknown>): ConfigLike => ({
  get: <T = unknown>(key: string, defaultValue?: T): T | undefined =>
    (key in values ? values[key] : defaultValue) as T | undefined,
});

describe('mqtt-options', () => {
  it('builds HiveMQ Cloud client options from the configured TLS URL', () => {
    const config = createConfig({
      USE_MQTT_CLOUD: 'true',
      MQTT_CLOUD_URL:
        '306b1848c14d462589272c5f6090fb08.s1.eu.hivemq.cloud:8883',
      MQTT_CLOUD_PORT: '8883',
      MQTT_CLOUD_USERNAME: 'hivemq-user',
      MQTT_CLOUD_PASSWORD: 'hivemq-password',
    });

    const options = buildMqttClientOptions(config);

    expect(options).toMatchObject({
      host: '306b1848c14d462589272c5f6090fb08.s1.eu.hivemq.cloud',
      port: 8883,
      protocol: 'mqtts',
      username: 'hivemq-user',
      password: 'hivemq-password',
      rejectUnauthorized: true,
    });
  });

  it('builds an optional Nest MQTT microservice config by default', () => {
    const config = createConfig({
      USE_MQTT_CLOUD: 'true',
      MQTT_CLOUD_URL:
        '306b1848c14d462589272c5f6090fb08.s1.eu.hivemq.cloud:8883',
      MQTT_CLOUD_PORT: '8883',
      MQTT_CLOUD_USERNAME: 'hivemq-user',
      MQTT_CLOUD_PASSWORD: 'hivemq-password',
    });

    const mqttConfig = buildMqttMicroserviceOptions(config);

    expect(mqttConfig.enabled).toBe(true);
    expect(mqttConfig.startupRequired).toBe(false);
    expect(mqttConfig.options).toMatchObject({
      transport: Transport.MQTT,
      options: {
        url: 'mqtts://306b1848c14d462589272c5f6090fb08.s1.eu.hivemq.cloud:8883',
        port: 8883,
        username: 'hivemq-user',
        password: 'hivemq-password',
        rejectUnauthorized: true,
      },
    });
  });

  it('does not reject application startup when optional MQTT startup fails', async () => {
    const app = {
      startAllMicroservices: jest
        .fn()
        .mockRejectedValue(new Error('broker unavailable')),
    };
    const logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    await expect(startMqttMicroservices(app, logger, false)).resolves.toBe(
      undefined,
    );

    expect(app.startAllMicroservices).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('broker unavailable'),
    );
  });
});
