import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Device } from '../../device/entities/device.entity';
import { SensorReading } from '../../sensor-reading/entities/sensor-reading.entity';

export enum SensorType {
  TempA = 'TempA',     // Temperature A (°C)
  TempB = 'TempB',     // Temperature B (°C) 
  TempC = 'TempC',     // Temperature C (°C)

  // Water quality sensors from WQI picture
  DO = 'DO',           // Dissolved Oxygen (mg/L)
  Salinity = 'Salinity', // Salinity (ppt)
  pH = 'pH',           // pH level
  Ammonia = 'Ammonia', // Ammonia (PPM)
  Turbidity = 'Turbidity', // Turbidity (cm)
  NO2 = 'NO2',         // Nitrite
}

@Entity()
export class Sensor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ unique: true })
  serialNumber: string;

  @Column({
    type: 'enum',
    enum: SensorType,
  })
  type: SensorType;

  @Column()
  deviceId: string;

  @ManyToOne(() => Device, (device) => device.sensors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device: Device;

  @OneToMany(() => SensorReading, (reading) => reading.sensor)
  readings: SensorReading[];

  @Column({ nullable: true })
  unit: string;

  @Column({ type: 'float', nullable: true })
  minValue: number;

  @Column({ type: 'float', nullable: true })
  maxValue: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}