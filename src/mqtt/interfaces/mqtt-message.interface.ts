export interface MqttSensorData {
  value: number;
  timestamp?: string | Date;
  serialNumber?: string;
  type?: string;
  deviceId?: string;
  farmId?: string;
}

export interface MqttTopicData {
  farmId?: string;
  deviceId?: string;
  sensorType?: string;
  serialNumber?: string;
}
