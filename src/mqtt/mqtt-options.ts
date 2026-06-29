import { Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import type { IClientOptions } from 'mqtt';
import * as fs from 'fs';
import * as path from 'path';

type MqttProtocol = 'mqtt' | 'mqtts';

export interface ConfigLike {
  get<T = unknown>(key: string, defaultValue?: T): T | undefined;
}

export interface MqttRuntimeConfig {
  enabled: boolean;
  startupRequired: boolean;
  options?: MicroserviceOptions;
}

type LoggerLike = Pick<Logger, 'log' | 'warn' | 'error'>;

function getString(
  configService: ConfigLike,
  key: string,
  defaultValue?: string,
): string | undefined {
  const value = configService.get<string | number | boolean>(key, defaultValue);
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return String(value);
}

function getNumber(
  configService: ConfigLike,
  key: string,
  defaultValue: number,
): number {
  const value = configService.get<string | number>(key, defaultValue);
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : defaultValue;
}

function getBoolean(
  configService: ConfigLike,
  key: string,
  defaultValue: boolean,
): boolean {
  const value = configService.get<string | boolean>(key, defaultValue);
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return String(value).toLowerCase() === 'true';
}

function normalizeBrokerUrl(
  brokerUrl: string,
  protocol: MqttProtocol,
  port: number,
): string {
  const urlWithProtocol = brokerUrl.includes('://')
    ? brokerUrl
    : `${protocol}://${brokerUrl}`;
  const url = new URL(urlWithProtocol);

  if (!url.port) {
    url.port = String(port);
  }

  return url.toString().replace(/\/$/, '');
}

function getMqttBaseConfig(configService: ConfigLike) {
  const useCloudMqtt = getBoolean(configService, 'USE_MQTT_CLOUD', false);
  const useSsl = useCloudMqtt
    ? true
    : getBoolean(configService, 'MQTT_USE_SSL', false);
  const protocol: MqttProtocol = useSsl ? 'mqtts' : 'mqtt';
  const port = useCloudMqtt
    ? getNumber(configService, 'MQTT_CLOUD_PORT', 8883)
    : getNumber(configService, 'MQTT_PORT', useSsl ? 8883 : 1883);
  const brokerUrl =
    (useCloudMqtt
      ? getString(configService, 'MQTT_CLOUD_URL') ||
        getString(configService, 'MQTT_CLOUD_HOST')
      : getString(configService, 'MQTT_URL') ||
        getString(configService, 'MQTT_HOST')) || 'localhost';
  const username = useCloudMqtt
    ? getString(configService, 'MQTT_CLOUD_USERNAME')
    : getString(configService, 'MQTT_USERNAME');
  const password = useCloudMqtt
    ? getString(configService, 'MQTT_CLOUD_PASSWORD')
    : getString(configService, 'MQTT_PASSWORD');
  const clientId = useCloudMqtt
    ? getString(
        configService,
        'MQTT_CLOUD_CLIENT_ID',
        `shrimp-farm-cloud-${Math.random().toString(16).slice(3)}`,
      )
    : getString(
        configService,
        'MQTT_CLIENT_ID',
        `shrimp-farm-backend-${Math.random().toString(16).slice(3)}`,
      );
  const rejectUnauthorized = useCloudMqtt
    ? getBoolean(configService, 'MQTT_CLOUD_REJECT_UNAUTHORIZED', true)
    : getBoolean(configService, 'MQTT_REJECT_UNAUTHORIZED', true);
  const normalizedUrl = normalizeBrokerUrl(brokerUrl, protocol, port);
  const caFile = useCloudMqtt
    ? getString(configService, 'MQTT_CLOUD_CA_FILE')
    : getString(configService, 'MQTT_CA_FILE');

  return {
    useCloudMqtt,
    protocol,
    port,
    url: normalizedUrl,
    username,
    password,
    clientId,
    rejectUnauthorized,
    caFile,
  };
}

function readCaFile(caFile: string | undefined, logger?: LoggerLike) {
  if (!caFile) {
    return undefined;
  }

  const caFilePath = path.resolve(caFile);
  if (!fs.existsSync(caFilePath)) {
    logger?.warn(`CA certificate file not found: ${caFilePath}`);
    return undefined;
  }

  logger?.log(`Using CA certificate from ${caFilePath}`);
  return fs.readFileSync(caFilePath);
}

export function buildMqttClientOptions(
  configService: ConfigLike,
  logger?: LoggerLike,
): IClientOptions {
  const mqttConfig = getMqttBaseConfig(configService);
  const url = new URL(mqttConfig.url);
  const ca = readCaFile(mqttConfig.caFile, logger);

  return {
    host: url.hostname,
    port: Number(url.port || mqttConfig.port),
    protocol: mqttConfig.protocol,
    username: mqttConfig.username,
    password: mqttConfig.password,
    clientId: mqttConfig.clientId,
    connectTimeout: getNumber(configService, 'MQTT_CONNECT_TIMEOUT', 5000),
    reconnectPeriod: getNumber(configService, 'MQTT_RECONNECT_PERIOD', 1000),
    rejectUnauthorized: mqttConfig.rejectUnauthorized,
    ...(ca ? { ca } : {}),
  };
}

export function buildMqttMicroserviceOptions(
  configService: ConfigLike,
  logger?: LoggerLike,
): MqttRuntimeConfig {
  const enabled = getBoolean(configService, 'MQTT_ENABLED', true);
  const startupRequired = getBoolean(
    configService,
    'MQTT_STARTUP_REQUIRED',
    false,
  );

  if (!enabled) {
    return { enabled, startupRequired };
  }

  const mqttConfig = getMqttBaseConfig(configService);
  const ca = readCaFile(mqttConfig.caFile, logger);

  return {
    enabled,
    startupRequired,
    options: {
      transport: Transport.MQTT,
      options: {
        url: mqttConfig.url,
        port: mqttConfig.port,
        protocol: mqttConfig.protocol,
        username: mqttConfig.username,
        password: mqttConfig.password,
        clientId: mqttConfig.clientId,
        connectTimeout: getNumber(configService, 'MQTT_CONNECT_TIMEOUT', 5000),
        reconnectPeriod: getNumber(
          configService,
          'MQTT_RECONNECT_PERIOD',
          1000,
        ),
        queueQoSZero: false,
        reschedulePings: true,
        keepalive: 60,
        rejectUnauthorized: mqttConfig.rejectUnauthorized,
        ...(ca ? { ca } : {}),
      },
    },
  };
}

export async function startMqttMicroservices(
  app: { startAllMicroservices: () => Promise<unknown> },
  logger: LoggerLike,
  startupRequired: boolean,
): Promise<void> {
  const startPromise = app
    .startAllMicroservices()
    .then(() => {
      logger.log('MQTT microservice started');
    })
    .catch((error: Error) => {
      logger.error(`MQTT microservice failed to start: ${error.message}`);
      if (startupRequired) {
        throw error;
      }
    });

  if (startupRequired) {
    await startPromise;
    return;
  }

  await Promise.resolve();
}
