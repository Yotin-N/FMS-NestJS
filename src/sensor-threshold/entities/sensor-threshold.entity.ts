import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Farm } from '../../farm/entities/farm.entity';

export enum SeverityLevel {
    CRITICAL = 'critical',
    WARNING = 'warning',
    NORMAL = 'normal',
}

@Entity('sensor_thresholds')
@Index(['farmId', 'sensorType', 'severityLevel'], { unique: true })
export class SensorThreshold {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    farmId: string;

    @ManyToOne(() => Farm, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'farmId' })
    farm: Farm;

    @Column({ length: 50 })
    sensorType: string; // pH, DO, Temperature, etc.

    @Column({
        type: 'enum',
        enum: SeverityLevel,
    })
    severityLevel: SeverityLevel;

    @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
    minValue: number;

    @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
    maxValue: number;

    @Column({ default: true })
    notificationEnabled: boolean;

    @Column({ length: 7, default: '#4caf50' })
    colorCode: string;

    @Column({ length: 100, nullable: true })
    label: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}