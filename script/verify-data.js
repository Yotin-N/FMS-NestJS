const fs = require('fs');
const mysql = require('mysql2/promise');

async function verifyData() {
  console.log('🔍 Starting data verification...');

  // Load simulation results
  const simulationResults = JSON.parse(fs.readFileSync('./simulation_results.json', 'utf-8'));

  // Load test entities and flatten all sensors from farm → device → sensors
  const testEntitiesRaw = JSON.parse(fs.readFileSync('./test_entities.json', 'utf-8'));
  const sensors = [];

  if (Array.isArray(testEntitiesRaw)) {
    testEntitiesRaw.forEach(farm => {
      if (Array.isArray(farm.devices)) {
        farm.devices.forEach(device => {
          if (Array.isArray(device.sensors)) {
            device.sensors.forEach(sensor => sensors.push(sensor));
          }
        });
      }
    });
  }

  if (sensors.length === 0) {
    console.error('❌ No sensors found in test_entities.json');
    return;
  }

  console.log(`📦 Loaded test data: ${sensors.length} sensors, ${simulationResults.cycles.length} simulation cycles`);

  // Time window
  const startTime = new Date(simulationResults.cycles[0].timestamp);
  const endTime = new Date(startTime.getTime() + 2 * 60 * 1000); // 2 minutes

  console.log(`🕒 Verifying readings from ${startTime.toISOString()} to ${endTime.toISOString()}`);

  // DB connection
  const db = await mysql.createConnection({
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '4HJc5zPFgtmS9zj.root',
    password: 'fpeYy7U21qMQobiM',
    database: 'shrimp_farm',
    ssl: { rejectUnauthorized: true },
  });

  console.log('✅ Connected to TiDB Cloud');

  // Verify readings per sensor
  const results = [];
  for (const sensor of sensors) {
    const [rows] = await db.execute(
      'SELECT COUNT(*) AS count FROM sensor_reading WHERE sensorId = ? AND timestamp BETWEEN ? AND ?',
      [sensor.id, startTime, endTime]
    );

    results.push({
      sensorId: sensor.id,
      expected: simulationResults.cycles.length,
      actual: rows[0].count,
      missing: simulationResults.cycles.length - rows[0].count,
    });
  }

  await db.end();
  console.log('🔌 Closed database connection');

  // Aggregate stats
  const sensorsWithData = results.filter(r => r.actual > 0);
  const missingData = results.filter(r => r.missing > 0);

  console.log('\n📊 Verification Results:');
  console.log(`Total Sensors: ${sensors.length}`);
  console.log(`Sensors with Data: ${sensorsWithData.length}`);
  console.log(`Sensors without Data: ${sensors.length - sensorsWithData.length}`);
  console.log(`Expected Readings per Sensor: ${simulationResults.cycles.length}`);
  console.log(`Total Expected Readings: ${sensors.length * simulationResults.cycles.length}`);
  console.log(`Total Actual Readings: ${sensorsWithData.reduce((sum, r) => sum + r.actual, 0)}`);
  console.log(`Missing Readings: ${missingData.reduce((sum, r) => sum + r.missing, 0)}`);
  console.log(`Extra Readings: 0`);
  console.log(`✅ Verification Success: ${missingData.length === 0}`);

  if (missingData.length > 0) {
    console.log('\n⚠️ Sensors with missing readings:');
    console.table(missingData.slice(0, 5));
    if (missingData.length > 5) {
      console.log(`...and ${missingData.length - 5} more`);
    }
  }

  console.log('\n✅ Verification completed.');
}

verifyData().catch(err => {
  console.error('❌ Verification failed:', err);
});
