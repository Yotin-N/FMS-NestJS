# Farm Management System - API Documentation



## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

Alternatively, the token can be stored in HTTP-only cookies (automatically handled by the auth endpoints).

## Interactive API Documentation
Swagger documentation is available at `/api` when running in development mode.

---

## 🔐 Authentication Endpoints

### POST /auth/login
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com",
    "role": "USER"
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### POST /auth/refresh-token
Refresh an existing access token.

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### GET /auth/google
Initiate Google OAuth authentication (redirects to Google).

### GET /auth/google/callback
Google OAuth callback endpoint.

---

## 👤 User Management

### POST /users/register
Register a new user account.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "role": "USER",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

### GET /users/profile
Get current user profile (requires authentication).

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "role": "USER",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

### GET /users
Get all users (admin only).

### PATCH /users/{id}
Update user information.

**Request Body:**
```json
{
  "firstName": "Updated",
  "lastName": "Name"
}
```

---

## 🚜 Farm Management

### POST /farms
Create a new farm.

**Request Body:**
```json
{
  "name": "Ocean View Shrimp Farm",
  "description": "Large coastal shrimp farm with 10 ponds",
  "location": "Coastal Road, Phuket",
  "latitude": 7.8804,
  "longitude": 98.3923
}
```

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Ocean View Shrimp Farm",
  "description": "Large coastal shrimp farm with 10 ponds",
  "location": "Coastal Road, Phuket",
  "latitude": 7.8804,
  "longitude": 98.3923,
  "ownerId": "123e4567-e89b-12d3-a456-426614174000",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/farms \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ocean View Shrimp Farm",
    "description": "Large coastal shrimp farm with 10 ponds",
    "location": "Coastal Road, Phuket",
    "latitude": 7.8804,
    "longitude": 98.3923
  }'
```

### GET /farms/my-farms
Get farms belonging to the current user.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response:**
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Ocean View Shrimp Farm",
      "description": "Large coastal shrimp farm with 10 ponds",
      "location": "Coastal Road, Phuket",
      "latitude": 7.8804,
      "longitude": 98.3923,
      "ownerId": "123e4567-e89b-12d3-a456-426614174000",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 10,
  "totalPages": 3
}
```

### GET /farms/{id}
Get farm by ID.

### PATCH /farms/{id}
Update farm information.

### DELETE /farms/{id}
Delete a farm.

### POST /farms/{id}/members
Add a member to the farm.

**Request Body:**
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000"
}
```

### DELETE /farms/{id}/members/{userId}
Remove a member from the farm.

### GET /farms/{id}/members
Get farm members.

---

## 📟 Device Management

### POST /devices
Create a new IoT device.

**Request Body:**
```json
{
  "name": "Main Pond Controller",
  "description": "Central device controlling pond sensors",
  "location": "Pond 1",
  "farmId": "123e4567-e89b-12d3-a456-426614174000",
  "macAddress": "00:1B:44:11:3A:B7",
  "isActive": true
}
```

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Main Pond Controller",
  "description": "Central device controlling pond sensors",
  "location": "Pond 1",
  "farmId": "123e4567-e89b-12d3-a456-426614174000",
  "macAddress": "00:1B:44:11:3A:B7",
  "isActive": true,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

### GET /devices/by-farm/{farmId}
Get all devices for a specific farm.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

### GET /devices/{id}
Get device by ID.

### PATCH /devices/{id}
Update device information.

### DELETE /devices/{id}
Delete a device.

---

## 🌡️ Sensor Management

### POST /sensors
Create a new sensor.

**Request Body (pH Sensor):**
```json
{
  "name": "pH Sensor 1",
  "serialNumber": "SN12345678",
  "type": "pH",
  "deviceId": "123e4567-e89b-12d3-a456-426614174000",
  "unit": "pH",
  "minValue": 0,
  "maxValue": 14,
  "isActive": true
}
```

**Request Body (Temperature Sensor):**
```json
{
  "name": "Temperature Sensor 1",
  "serialNumber": "SN87654321",
  "type": "TempA",
  "deviceId": "123e4567-e89b-12d3-a456-426614174000",
  "unit": "°C",
  "minValue": 0,
  "maxValue": 40,
  "isActive": true
}
```

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "pH Sensor 1",
  "serialNumber": "SN12345678",
  "type": "pH",
  "deviceId": "123e4567-e89b-12d3-a456-426614174000",
  "unit": "pH",
  "minValue": 0,
  "maxValue": 14,
  "isActive": true,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z",
  "mqttTopic": "shrimp_farm/farm123/device/device456/sensor/ph"
}
```

### Available Sensor Types
- `pH`: pH sensors
- `TempA`: Temperature sensors (type A)
- `TempB`: Temperature sensors (type B)
- `DO`: Dissolved Oxygen sensors
- `Salinity`: Salinity sensors
- `NH4`: Ammonia sensors
- `TDS`: Total Dissolved Solids sensors

### GET /sensors/by-device/{deviceId}
Get all sensors for a specific device.

### GET /sensors/{id}
Get sensor by ID.

### PATCH /sensors/{id}
Update sensor information.

### DELETE /sensors/{id}
Delete a sensor.

---

## 📊 Sensor Readings

### GET /sensors/{id}/readings
Get readings for a specific sensor.

**Query Parameters:**
- `startDate` (optional): Start date (ISO format)
- `endDate` (optional): End date (ISO format)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 100)

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/sensors/123e4567-e89b-12d3-a456-426614174000/readings?startDate=2025-01-01T00:00:00.000Z&endDate=2025-01-31T23:59:59.999Z&page=1&limit=100" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "value": 7.2,
      "timestamp": "2025-01-01T00:00:00.000Z",
      "sensorId": "123e4567-e89b-12d3-a456-426614174000"
    }
  ],
  "total": 1000,
  "page": 1,
  "limit": 100,
  "totalPages": 10
}
```

### POST /sensors/{id}/readings
Add a reading to a specific sensor.

**Request Body (with timestamp):**
```json
{
  "value": 7.2,
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

**Request Body (current timestamp):**
```json
{
  "value": 7.2
}
```

### GET /sensors/{id}/readings/latest
Get the latest reading for a sensor.

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "value": 7.2,
  "timestamp": "2025-01-01T00:00:00.000Z",
  "sensorId": "123e4567-e89b-12d3-a456-426614174000"
}
```

### GET /sensors/{sensorId}/readings/{readingId}
Get a specific reading.

### PATCH /sensors/{sensorId}/readings/{readingId}
Update a specific reading.

### DELETE /sensors/{sensorId}/readings/{readingId}
Delete a specific reading (admin or farm owner only).

---

## 📈 Dashboard Analytics

### GET /dashboard/farm/{farmId}/summary
Get dashboard summary for a farm.

**Response:**
```json
{
  "latestTimestamp": "2025-01-01T12:00:00.000Z",
  "sensorAverages": {
    "pH": 7.2,
    "TempA": 28.5,
    "DO": 6.8
  },
  "activeSensorCount": 15,
  "totalReadingsToday": 1440
}
```

### GET /dashboard/farm/{farmId}/sensor-data
Get sensor data for charts with configurable granularity.

**Query Parameters:**
- `timeRange` (optional): Time range in hours (default: 24)
- `sensorType` (optional): Filter by sensor type
- `granularityMinutes` (optional): Data point granularity in minutes (default: 60)
  - Use `1` for 60 data points per hour (1 per minute)
  - Use `5` for 12 data points per hour (1 per 5 minutes)
  - Use `60` for 1 data point per hour (default)

**Example Request (60 points in 1 hour):**
```bash
curl -X GET "http://localhost:3000/api/dashboard/farm/123e4567-e89b-12d3-a456-426614174000/sensor-data?timeRange=1&granularityMinutes=1&sensorType=pH" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Request (24 points in 1 day):**
```bash
curl -X GET "http://localhost:3000/api/dashboard/farm/123e4567-e89b-12d3-a456-426614174000/sensor-data?timeRange=24&granularityMinutes=60&sensorType=pH" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
[
  {
    "sensorId": "123e4567-e89b-12d3-a456-426614174000",
    "sensorName": "pH Sensor 1",
    "sensorType": "pH",
    "data": [
      {
        "timestamp": "2025-01-01T00:00:00.000Z",
        "value": 7.2
      },
      {
        "timestamp": "2025-01-01T01:00:00.000Z",
        "value": 7.1
      }
    ]
  }
]
```

### GET /dashboard/farm/{farmId}/sensor/{sensorType}/realtime-data
Get real-time sensor data for charts.

**Query Parameters:**
- `startDate` (required): Start date-time (ISO format)
- `endDate` (required): End date-time (ISO format)

---

## 🚨 Sensor Thresholds

### GET /sensor-thresholds/farm/{farmId}
Get all thresholds for a farm.

**Response:**
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "farmId": "123e4567-e89b-12d3-a456-426614174000",
    "sensorType": "pH",
    "minValue": 6.5,
    "maxValue": 8.5,
    "alertEnabled": true,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

### POST /sensor-thresholds/farm/{farmId}/sensor/{sensorType}
Create or update sensor thresholds.

**Request Body:**
```json
[
  {
    "minValue": 6.5,
    "maxValue": 8.5,
    "alertEnabled": true
  }
]
```

### GET /sensor-thresholds/defaults/{sensorType}
Get default thresholds for a sensor type.

---

## 🌐 MQTT Integration

The system automatically subscribes to MQTT topics when sensors are created. The topic format is:
- Primary: `shrimp_farm/{farmId}/device/{deviceId}/sensor/{sensorType}`
- Serial: `sensor/{serialNumber}`
- Type-based: `sensors/{sensorType}/{serialNumber}`

### Message Format
MQTT messages should be in JSON format:
```json
{
  "value": 7.2,
  "timestamp": "2025-01-01T12:00:00.000Z",
  "serialNumber": "SN12345678",
  "type": "pH",
  "deviceId": "device123",
  "farmId": "farm456"
}
```

Or plain numeric values:
```
7.2
```

---

## 📝 Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Forbidden - insufficient permissions"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Resource not found"
}
```

### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "Serial number already exists"
}
```

---

## 🧪 Testing with cURL

### Complete Flow Example

1. **Register a user:**
```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "password": "securePassword123"
  }'
```

2. **Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "securePassword123"
  }'
```

3. **Create a farm:**
```bash
curl -X POST http://localhost:3000/api/farms \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Farm",
    "description": "My test farm",
    "location": "Test Location",
    "latitude": 7.8804,
    "longitude": 98.3923
  }'
```

4. **Create a device:**
```bash
curl -X POST http://localhost:3000/api/devices \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Device",
    "description": "Test IoT device",
    "location": "Pond 1",
    "farmId": "FARM_ID_FROM_STEP_3",
    "macAddress": "00:1B:44:11:3A:B7",
    "isActive": true
  }'
```

5. **Create a sensor:**
```bash
curl -X POST http://localhost:3000/api/sensors \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test pH Sensor",
    "serialNumber": "TEST001",
    "type": "pH",
    "deviceId": "DEVICE_ID_FROM_STEP_4",
    "unit": "pH",
    "minValue": 0,
    "maxValue": 14,
    "isActive": true
  }'
```

6. **Add a sensor reading:**
```bash
curl -X POST http://localhost:3000/api/sensors/SENSOR_ID_FROM_STEP_5/readings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "value": 7.2
  }'
```

7. **Get sensor readings:**
```bash
curl -X GET "http://localhost:3000/api/sensors/SENSOR_ID_FROM_STEP_5/readings" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 📚 Additional Resources

- **Swagger UI**: Available at `/api` in development mode
- **Postman Collection**: Import the API endpoints for testing
- **MQTT Client**: Use any MQTT client to publish sensor data
- **WebSocket Support**: Real-time updates for dashboard (if implemented)

For more detailed information, refer to the interactive Swagger documentation available when running the application in development mode.