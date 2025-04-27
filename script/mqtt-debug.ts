import * as mqtt from 'mqtt';
import * as readline from 'readline';

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// MQTT Broker URL
const brokerUrl = 'mqtt://localhost:1883';
const client = mqtt.connect(brokerUrl, {
  clientId: `mqtt-debug-${Math.random().toString(16).slice(2, 8)}`,
  username: 'admin', // เพิ่ม username ถ้าจำเป็น
  password: 'public', // เพิ่ม password ถ้าจำเป็น
});

// Connect to MQTT Broker
client.on('connect', () => {
  console.log(`Connected to MQTT broker at ${brokerUrl}`);

  // เปลี่ยนจาก subscribe '#' เป็น subscribe เฉพาะ topic ที่เราสนใจ
  client.subscribe('sensor/SN12345678', (err) => {
    if (!err) {
      console.log('Subscribed to sensor/SN12345678');
    } else {
      console.error('Failed to subscribe to sensor/SN12345678:', err);
    }
  });

  // Listen for messages
  client.on('message', (topic, message) => {
    try {
      console.log(`Received on topic "${topic}":`);

      // Try to parse as JSON
      try {
        const jsonMessage = JSON.parse(message.toString());
        console.log('Message (JSON):', JSON.stringify(jsonMessage, null, 2));
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        // If not JSON, show as string
        console.log('Message (string):', message.toString());
      }
      console.log('-'.repeat(50));
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  // Start interactive mode
  startInteractiveMode();
});

// ... ส่วนที่เหลือของสคริปต์คงเดิม ...

client.on('error', (err) => {
  console.error('MQTT Client Error:', err);
});

// Interactive CLI for publishing messages
function startInteractiveMode() {
  console.log('\n=== MQTT Debug Tool ===');
  console.log('1. Send to sensor/SN12345678');
  console.log('2. Send to custom topic');
  console.log('3. Exit');

  rl.question('Select option: ', (option) => {
    switch (option) {
      case '1':
        sendSensorValue();
        break;
      case '2':
        sendCustomMessage();
        break;
      case '3':
        exitApp();
        break;
      default:
        console.log('Invalid option');
        startInteractiveMode();
    }
  });
}

function sendSensorValue() {
  rl.question('Enter sensor value (number): ', (value) => {
    const numValue = parseFloat(value);

    if (isNaN(numValue)) {
      console.log('Please enter a valid number');
      sendSensorValue();
      return;
    }

    // Option 1: Send as JSON
    const message = JSON.stringify({
      value: numValue,
      timestamp: new Date().toISOString(),
    });

    // Option 2: Send as plain number
    // const message = value;

    client.publish('sensor/SN12345678', message, { qos: 1 }, (err) => {
      if (err) {
        console.error('Failed to publish:', err);
      } else {
        console.log(`Published to sensor/SN12345678: ${message}`);
      }
      startInteractiveMode();
    });
  });
}

function sendCustomMessage() {
  rl.question('Enter topic: ', (topic) => {
    rl.question('Enter message (as JSON or string): ', (message) => {
      client.publish(topic, message, { qos: 1 }, (err) => {
        if (err) {
          console.error('Failed to publish:', err);
        } else {
          console.log(`Published to ${topic}: ${message}`);
        }
        startInteractiveMode();
      });
    });
  });
}

function exitApp() {
  console.log('Disconnecting...');
  client.end();
  rl.close();
  process.exit(0);
}

// Handle application exit
process.on('SIGINT', exitApp);
