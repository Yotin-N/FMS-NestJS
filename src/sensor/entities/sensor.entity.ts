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
  TempA = 'TempA',
  TempB = 'TempB',
  TempC = 'TempC',
  pH = 'pH',
  DO = 'DO',
  Saltlinity = 'Saltlinity',
  NHx = 'NHx',
  EC = 'EC',
  TDS = 'TDS',
  ORP = 'ORP',
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
