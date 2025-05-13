const axios = require('axios');
const fs = require('fs');

// Configuration (replace with your actual values)
const CONFIG = {
  API_BASE_URL: 'https://fms-nestjs.onrender.com/api',
  AUTH_TOKEN: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQHB1YmxpYy5jb20iLCJzdWIiOiI4NDA2YzY2NC05ZjU2LTQxOTMtOGQ2YS0zZDhlMWY4ZDY1MDciLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3NDcxMDc4NjAsImV4cCI6MTc0NzExMTQ2MH0.CD97tcdWiBWI5vr0DEf_fuM64zTWG4gSFUNpdfLRdkc', 
  OUTPUT_FILE: './test_entities.json', 
  
  // Sensor types based on your NestJS entities
  SENSOR_TYPES: [
    'TempA', 'TempB', 'pH', 'DO', 'EC', 
    'TDS', 'Saltlinity', 'NHx', 'ORP', 'TempC'
  ]
};

// Create HTTP client with authentication
const apiClient = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CONFIG.AUTH_TOKEN}`
  }
});

// Main function to create test entities
async function setupTestEntities() {
  try {
    console.log('Starting setup of test entities...');
    
    // Step 1: Create a farm
    console.log('Creating test farm...');
    const farm = await createFarm();
    console.log(`Farm created with ID: ${farm.id}`);
    
    // Step 2: Create 20 devices for this farm
    console.log('Creating 20 test devices...');
    const devices = await createDevices(farm.id, 20);
    console.log(`Created ${devices.length} devices`);
    
    // Step 3: Create 10 sensors for each device (one of each type)
    console.log('Creating 10 sensors for each device...');
    const allSensors = [];
    
    for (const device of devices) {
      const sensors = await createSensors(device.id, CONFIG.SENSOR_TYPES);
      allSensors.push(...sensors);
      console.log(`Created ${sensors.length} sensors for device ${device.id}`);
    }
    
    console.log(`Total sensors created: ${allSensors.length}`);
    
    // Step 4: Save all created entities to a file for later use
    const testEntities = {
      farm,
      devices,
      sensors: allSensors,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(CONFIG.OUTPUT_FILE, JSON.stringify(testEntities, null, 2));
    console.log(`Test entities saved to ${CONFIG.OUTPUT_FILE}`);
    
    return testEntities;
    
  } catch (error) {
    console.error('Setup failed:', error.message);
    if (error.response) {
      console.error('API Error:', error.response.data);
    }
    throw error;
  }
}

// Function to create a test farm
async function createFarm() {
  const farmData = {
    name: `Test Farm ${Date.now()}`,
    description: 'Automatically created test farm for load testing',
    location: 'Test Location',
  };
  
  const response = await apiClient.post('/farms', farmData);
  return response.data;
}

// Function to create multiple devices for a farm
async function createDevices(farmId, count) {
  const devices = [];
  
  for (let i = 1; i <= count; i++) {
    const deviceData = {
      name: `Test Device ${i}`,
      description: `Automatically created test device ${i}`,
      farmId: farmId,
      isActive: true
    };
    
    const response = await apiClient.post('/devices', deviceData);
    devices.push(response.data);
  }
  
  return devices;
}

// Function to create sensors for a device
async function createSensors(deviceId, sensorTypes) {
  const sensors = [];
  
  for (let i = 0; i < sensorTypes.length; i++) {
    const type = sensorTypes[i];
    
    // Create unit and range based on sensor type
    let unit, minValue, maxValue;
    
    switch (type) {
      case 'TempA':
      case 'TempB':
      case 'TempC':
        unit = '°C';
        minValue = 0;
        maxValue = 50;
        break;
      case 'pH':
        unit = 'pH';
        minValue = 0;
        maxValue = 14;
        break;
      case 'DO':
        unit = 'mg/L';
        minValue = 0;
        maxValue = 20;
        break;
      case 'EC':
        unit = 'mS/cm';
        minValue = 0;
        maxValue = 10;
        break;
      case 'TDS':
        unit = 'ppm';
        minValue = 0;
        maxValue = 5000;
        break;
      case 'Saltlinity':
        unit = 'ppt';
        minValue = 0;
        maxValue = 40;
        break;
      case 'NHx':
        unit = 'mg/L';
        minValue = 0;
        maxValue = 10;
        break;
      case 'ORP':
        unit = 'mV';
        minValue = -500;
        maxValue = 500;
        break;
      default:
        unit = 'units';
        minValue = 0;
        maxValue = 100;
    }
    
    const sensorData = {
      name: `${type} Sensor`,
      serialNumber: `TEST-${deviceId}-${type}-${Date.now()}`,
      type: type,
      deviceId: deviceId,
      unit: unit,
      minValue: minValue,
      maxValue: maxValue,
      isActive: true
    };
    
    const response = await apiClient.post('/sensors', sensorData);
    sensors.push(response.data);
  }
  
  return sensors;
}

// Run the setup if this script is executed directly
if (require.main === module) {
  setupTestEntities()
    .then(() => {
      console.log('Setup completed successfully');
    })
    .catch(err => {
      console.error('Setup failed:', err);
      process.exit(1);
    });
}

module.exports = { setupTestEntities };