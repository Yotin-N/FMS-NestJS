import 'reflect-metadata';
import {
  PATTERN_HANDLER_METADATA,
  PATTERN_METADATA,
} from '@nestjs/microservices/constants';
import { PatternHandler } from '@nestjs/microservices/enums/pattern-handler.enum';
import { MqttController } from './mqtt.controller';

describe('MqttController', () => {
  it('registers IoT telemetry topics as MQTT event handlers', () => {
    const handlerNames: Array<keyof MqttController> = [
      'handleFarmDeviceSensor',
      'handleSensor',
      'handleTypeSensor',
      'handleAnyTopic',
    ];

    for (const handlerName of handlerNames) {
      const handler = Object.getOwnPropertyDescriptor(
        MqttController.prototype,
        handlerName,
      )?.value as object | undefined;

      expect(handler).toBeDefined();
      if (!handler) {
        throw new Error(`Missing handler ${String(handlerName)}`);
      }
      expect(Reflect.getMetadata(PATTERN_METADATA, handler)).toBeDefined();
      expect(Reflect.getMetadata(PATTERN_HANDLER_METADATA, handler)).toBe(
        PatternHandler.EVENT,
      );
    }
  });
});
