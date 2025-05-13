// mqtt-simulator.js - Simulates sensor data publishing to MQTT broker for 24 hours (228 cycles)

const mqtt = require('mqtt');
const fs = require('fs');
require('dotenv').config();

// Configuration (replace with your actual values)
const CONFIG = {
  MQTT_BROKER: 'mqtts://m1511512.ala.asia-southeast1.emqxsl.com',
  MQTT_USERNAME: 'admin',
  MQTT_PASSWORD: '1234',
  MQTT_CLIENT_ID: `fms-simulator-${Date.now()}`,
  ENTITIES_FILE: './test_entities.json',
  
  // MQTT topic structure based on your NestJS MQTT service
  TOPIC_STRUCTURE: 'shrimp_farm/{farmId}/device/{deviceId}/sensor/{sensorType}',
  
  // 24-hour simulation configuration (228 cycles)
  TOTAL_CYCLES: 228, // 228 cycles = 24 hours (once every ~6.316 minutes)
  CYCLE_INTERVAL_MS: (24 * 60 * 60 * 1000) / 228 // ~6.316 minutes
};

// Load test entities created by the setup script
function loadTestEntities() {
  try {
    const data = fs.readFileSync(CONFIG.ENTITIES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Failed to load test entities from ${CONFIG.ENTITIES_FILE}:`, error.message);
    throw error;
  }
}

// Connect to MQTT broker
function connectToMqtt() {
  const options = {
    clientId: CONFIG.MQTT_CLIENT_ID,
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 1000
  };
  
  // Add credentials if provided
  if (CONFIG.MQTT_USERNAME && CONFIG.MQTT_PASSWORD) {
    options.username = CONFIG.MQTT_USERNAME;
    options.password = CONFIG.MQTT_PASSWORD;
  }
  
  const client = mqtt.connect(CONFIG.MQTT_BROKER, options);
  
  return new Promise((resolve, reject) => {
    client.on('connect', () => {
      console.log('Connected to MQTT broker:', CONFIG.MQTT_BROKER);
      resolve(client);
    });
    
    client.on('error', (err) => {
      console.error('MQTT connection error:', err);
      reject(err);
    });
  });
}

// Generate a realistic sensor value based on sensor type and range
function generateSensorValue(sensor) {
  const min = sensor.minValue || 0;
  const max = sensor.maxValue || 100;
  
  // Generate a value with some random noise
  let value;
  
  switch (sensor.type) {
    case 'TempA':
    case 'TempB':
    case 'TempC':
      // Temperature typically around 25-28°C in aquaculture
      value = 26.5 + (Math.random() * 3 - 1.5);
      break;
    case 'pH':
      // pH typically around 7-8.5 in aquaculture
      value = 7.8 + (Math.random() * 1.4 - 0.7);
      break;
    case 'DO':
      // Dissolved Oxygen typically 5-8 mg/L
      value = 6.5 + (Math.random() * 3 - 1.5);
      break;
    case 'EC':
      // Electrical Conductivity
      value = 2.5 + (Math.random() * 3 - 1.5);
      break;
    case 'TDS':
      // Total Dissolved Solids
      value = 1200 + (Math.random() * 600 - 300);
      break;
    case 'Saltlinity':
      // Salinity for brackish water
      value = 15 + (Math.random() * 10 - 5);
      break;
    case 'NHx':
      // Ammonia - typically low
      value = 0.5 + (Math.random() * 1 - 0.5);
      break;
    case 'ORP':
      // Oxidation-Reduction Potential
      value = 150 + (Math.random() * 100 - 50);
      break;
    default:
      // Default random value within min-max range
      value = min + (Math.random() * (max - min));
  }
  
  // Ensure value is within the sensor's min-max range
  value = Math.max(min, Math.min(max, value));
  
  // Return with 2 decimal places
  return parseFloat(value.toFixed(2));
}

// Construct MQTT topic from template
function constructTopic(topicStructure, farm, device, sensor) {
  return topicStructure
    .replace('{farmId}', farm.id)
    .replace('{deviceId}', device.id)
    .replace('{sensorType}', sensor.type.toLowerCase());
}

// Publish sensor data to MQTT
async function publishSensorData(client, entities) {
  const { farm, devices, sensors } = entities;
  const timestamp = new Date().toISOString();
  const publishPromises = [];
  
  // Group sensors by device for easier processing
  const sensorsByDevice = {};
  sensors.forEach(sensor => {
    if (!sensorsByDevice[sensor.deviceId]) {
      sensorsByDevice[sensor.deviceId] = [];
    }
    sensorsByDevice[sensor.deviceId].push(sensor);
  });
  
  console.log(`Publishing sensor data with timestamp: ${timestamp}`);
  
  // For each device, publish data for all its sensors
  devices.forEach(device => {
    const deviceSensors = sensorsByDevice[device.id] || [];
    
    deviceSensors.forEach(sensor => {
      const value = generateSensorValue(sensor);
      const topic = constructTopic(CONFIG.TOPIC_STRUCTURE, farm, device, sensor);
      const payload = JSON.stringify({
        value: value,
        timestamp: timestamp,
        sensorId: sensor.id,
        serialNumber: sensor.serialNumber
      });
      
      // Create a promise for publishing
      const publishPromise = new Promise((resolve, reject) => {
        client.publish(topic, payload, { qos: 1 }, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve({
              topic,
              sensorId: sensor.id,
              value
            });
          }
        });
      });
      
      publishPromises.push(publishPromise);
    });
  });
  
  // Wait for all messages to be published
  const results = await Promise.allSettled(publishPromises);
  
  // Count successful and failed messages
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  console.log(`Published ${successful} messages successfully, ${failed} failed`);
  
  return {
    timestamp,
    successful,
    failed,
    total: publishPromises.length
  };
}

// Main function to run the 24-hour simulation (228 cycles)
async function run24HourSimulation() {
    try {
      console.log('Starting MQTT simulation for 228 cycles (running immediately after each cycle completes)...');
      
      // Load test entities
      const entities = loadTestEntities();
      console.log(`Loaded test entities: 1 farm, ${entities.devices.length} devices, ${entities.sensors.length} sensors`);
      
      // Connect to MQTT broker
      const client = await connectToMqtt();
      
      // Array to store all results
      const allResults = [];
      let cycleCount = 0;
      
      // Function to handle one publishing cycle
      const publishCycle = async () => {
        cycleCount++;
        console.log(`\nStarting cycle ${cycleCount}/${CONFIG.TOTAL_CYCLES}`);
        
        try {
          const result = await publishSensorData(client, entities);
          allResults.push(result);
          
          // Save intermediate results
          const simulationResults = {
            startTime: new Date().toISOString(),
            farmId: entities.farm.id,
            deviceCount: entities.devices.length,
            sensorCount: entities.sensors.length,
            cycles: allResults
          };
          
          fs.writeFileSync('./simulation_results.json', JSON.stringify(simulationResults, null, 2));
          console.log('Updated simulation results saved to simulation_results.json');
          
        } catch (error) {
          console.error('Error during publish cycle:', error);
        }
      };
      
      // Run exactly 228 cycles immediately after each completes
      for (let i = 0; i < CONFIG.TOTAL_CYCLES; i++) {
        await publishCycle();
      }
      
      // After all cycles are complete
      console.log('\n228-cycle simulation completed successfully!');
      
      // Save final results
      const finalResults = {
        startTime: new Date(allResults[0]?.timestamp || Date.now()).toISOString(),
        endTime: new Date().toISOString(),
        farmId: entities.farm.id,
        deviceCount: entities.devices.length,
        sensorCount: entities.sensors.length,
        totalCycles: cycleCount,
        cycles: allResults
      };
      fs.writeFileSync('./simulation_results_final.json', JSON.stringify(finalResults, null, 2));
      console.log('Final simulation results saved to simulation_results_final.json');
      
      // Disconnect MQTT client and exit
      client.end(() => {
        console.log('MQTT client disconnected');
        process.exit(0);
      });
      
      // Handle process termination
      process.on('SIGINT', () => {
        console.log('\nReceived SIGINT. Shutting down gracefully...');
        client.end();
        process.exit(0);
      });
      
      process.on('SIGTERM', () => {
        console.log('\nReceived SIGTERM. Shutting down gracefully...');
        client.end();
        process.exit(0);
      });
      
    } catch (error) {
      console.error('Simulation failed to start:', error);
      process.exit(1);
    }
  }
  
  // Run the simulation if this script is executed directly
  if (require.main === module) {
    run24HourSimulation()
      .catch(err => {
        console.error('Simulation failed:', err);
        process.exit(1);
      });
  }
  
  module.exports = { run24HourSimulation };