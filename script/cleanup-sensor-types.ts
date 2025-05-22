// scripts/cleanup-sensor-types.ts
import { createConnection } from 'typeorm';
import { Sensor } from '../src/sensor/entities/sensor.entity';

async function cleanupSensorTypes() {
    const connection = await createConnection();

    try {
        console.log('Starting sensor type cleanup...');

        // 1. Fix spelling: Saltlinity -> Salinity
        const saltyResult = await connection
            .createQueryBuilder()
            .update(Sensor)
            .set({ type: 'Salinity' as any })
            .where("type = 'Saltlinity'")
            .execute();
        console.log(`Fixed Saltlinity spelling: ${saltyResult.affected} records`);

        // 2. Convert Temperature -> TempA (or prompt user to choose A/B/C)
        const tempResult = await connection
            .createQueryBuilder()
            .update(Sensor)
            .set({ type: 'TempA' as any })
            .where("type = 'Temperature'")
            .execute();
        console.log(`Converted Temperature to TempA: ${tempResult.affected} records`);

        // 3. Convert NHx -> Ammonia
        const nhxResult = await connection
            .createQueryBuilder()
            .update(Sensor)
            .set({ type: 'Ammonia' as any })
            .where("type = 'NHx'")
            .execute();
        console.log(`Converted NHx to Ammonia: ${nhxResult.affected} records`);

        // 4. Remove sensors with old types that don't exist in WQI (EC, TDS, ORP)
        const oldTypes = ['EC', 'TDS', 'ORP'];
        for (const oldType of oldTypes) {
            const deleteResult = await connection
                .createQueryBuilder()
                .delete()
                .from(Sensor)
                .where("type = :type", { type: oldType })
                .execute();
            console.log(`Removed old ${oldType} sensors: ${deleteResult.affected} records`);
        }

        // 5. List all remaining sensor types for verification
        const remainingSensors = await connection
            .createQueryBuilder()
            .select('sensor.type', 'type')
            .addSelect('COUNT(*)', 'count')
            .from(Sensor, 'sensor')
            .groupBy('sensor.type')
            .getRawMany();

        console.log('Remaining sensor types:');
        remainingSensors.forEach(result => {
            console.log(`  ${result.type}: ${result.count} sensors`);
        });

        console.log('Sensor type cleanup completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.close();
    }
}

cleanupSensorTypes();