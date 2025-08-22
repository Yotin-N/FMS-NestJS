# 📊 Granular Sensor Data Guide

## 🎯 **Problem Solved**
You wanted **60 data points for 1 hour range** instead of the previous 1 data point per hour. Now you can get minute-level granularity!

## 🚀 **How It Works**

### **New `granularityMinutes` Parameter**
The enhanced API now accepts a `granularityMinutes` parameter that controls data point granularity:

- `granularityMinutes=1`: 1 data point per minute → **60 points/hour**
- `granularityMinutes=5`: 1 data point per 5 minutes → **12 points/hour**  
- `granularityMinutes=15`: 1 data point per 15 minutes → **4 points/hour**
- `granularityMinutes=60`: 1 data point per hour → **1 point/hour** (default)

## 📈 **Usage Examples**

### **1. Get 60 Data Points for 1 Hour (Your Requirement)**
```bash
curl -X GET "http://localhost:3000/api/dashboard/farm/FARM_ID/sensor-data?timeRange=1&granularityMinutes=1&sensorType=pH" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Result:** 60 data points, each representing 1-minute average

### **2. Get 720 Data Points for 12 Hours (Minute-level)**
```bash
curl -X GET "http://localhost:3000/api/dashboard/farm/FARM_ID/sensor-data?timeRange=12&granularityMinutes=1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Result:** 720 data points (12 hours × 60 minutes)

### **3. Get 144 Data Points for 12 Hours (5-minute intervals)**
```bash
curl -X GET "http://localhost:3000/api/dashboard/farm/FARM_ID/sensor-data?timeRange=12&granularityMinutes=5" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Result:** 144 data points (12 hours × 12 intervals per hour)

## 📋 **Response Format**

```json
[
  {
    "type": "pH",
    "data": [
      {
        "time": "2025-01-22T10:00:00.000Z",
        "value": 7.2
      },
      {
        "time": "2025-01-22T10:01:00.000Z", 
        "value": 7.1
      },
      {
        "time": "2025-01-22T10:02:00.000Z",
        "value": null  // Missing data - frontend can interpolate
      },
      {
        "time": "2025-01-22T10:03:00.000Z",
        "value": 7.0
      }
      // ... 56 more data points for complete hour
    ]
  }
]
```

## ⚡ **Smart Features**

### **1. Gap Filling**
- Missing time slots return `null` values
- Frontend can interpolate or show gaps
- Maintains consistent time series structure

### **2. Data Aggregation** 
- Multiple sensor readings within each time slot are averaged
- Handles irregular sensor data gracefully
- Reduces noise while preserving trends

### **3. Memory Efficient**
- Only fetches data within requested time range
- Aggregation happens in-memory after database query
- Suitable for real-time dashboards

## 🔧 **Implementation Details**

### **Time Slot Algorithm:**
```typescript
// For granularityMinutes = 1:
// 10:23:45 → 10:23:00 (rounded down to minute)

// For granularityMinutes = 5: 
// 10:23:45 → 10:20:00 (rounded down to 5-minute slot)

// For granularityMinutes = 60:
// 10:23:45 → 10:00:00 (rounded down to hour)
```

### **Data Processing Flow:**
1. **Query**: Fetch all sensor readings in time range
2. **Group**: Group readings by calculated time slots  
3. **Aggregate**: Average multiple readings per slot
4. **Fill**: Generate complete time series with gaps
5. **Return**: Consistent data structure for frontend

## 🧪 **Testing Your Setup**

### **Test Script (Node.js/JavaScript)**
```javascript
const testGranularData = async (authToken, farmId) => {
  const baseUrl = 'http://localhost:3000/api/dashboard/farm';
  
  // Test 1: 60 points in 1 hour (minute-level)
  const response1h = await fetch(
    `${baseUrl}/${farmId}/sensor-data?timeRange=1&granularityMinutes=1&sensorType=pH`, 
    { headers: { 'Authorization': `Bearer ${authToken}` }}
  );
  const data1h = await response1h.json();
  
  console.log('1 Hour Data:');
  console.log(`- Data points: ${data1h[0]?.data?.length || 0}`);
  console.log(`- Time span: ${data1h[0]?.data[0]?.time} to ${data1h[0]?.data.slice(-1)[0]?.time}`);
  
  // Test 2: 12 points in 1 hour (5-minute intervals)
  const response5min = await fetch(
    `${baseUrl}/${farmId}/sensor-data?timeRange=1&granularityMinutes=5&sensorType=pH`,
    { headers: { 'Authorization': `Bearer ${authToken}` }}
  );
  const data5min = await response5min.json();
  
  console.log('\n5-Minute Intervals:');
  console.log(`- Data points: ${data5min[0]?.data?.length || 0}`);
  console.log(`- Expected: 12 points per hour`);
};
```

### **Test with cURL**
```bash
#!/bin/bash

# Set your variables
FARM_ID="your-farm-id"
TOKEN="your-jwt-token"

echo "Testing granular sensor data..."

echo "1. Testing 60 points in 1 hour:"
curl -s -X GET "http://localhost:3000/api/dashboard/farm/$FARM_ID/sensor-data?timeRange=1&granularityMinutes=1&sensorType=pH" \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | .data | length'

echo "2. Testing 12 points in 1 hour:"  
curl -s -X GET "http://localhost:3000/api/dashboard/farm/$FARM_ID/sensor-data?timeRange=1&granularityMinutes=5&sensorType=pH" \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | .data | length'

echo "3. Testing 24 points in 1 day:"
curl -s -X GET "http://localhost:3000/api/dashboard/farm/$FARM_ID/sensor-data?timeRange=24&granularityMinutes=60&sensorType=pH" \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | .data | length'
```

## 📊 **Common Use Cases**

### **Real-time Dashboard (1-minute updates)**
```javascript
// Refresh every minute with latest 1-hour data
setInterval(async () => {
  const data = await fetchSensorData(farmId, 1, 1); // 1 hour, 1-minute granularity
  updateChart(data); // 60 data points
}, 60000);
```

### **Historical Analysis (5-minute trends)** 
```javascript
// Load 12 hours of data with 5-minute granularity
const historicalData = await fetchSensorData(farmId, 12, 5); // 144 data points
showTrendAnalysis(historicalData);
```

### **Performance Monitoring (Hourly overview)**
```javascript
// Load 7 days with hourly granularity  
const weeklyData = await fetchSensorData(farmId, 168, 60); // 168 data points (7×24)
generateWeeklyReport(weeklyData);
```

## ⚠️ **Performance Considerations**

- **Minute-level data**: High resolution, more database load
- **5-minute intervals**: Good balance of detail vs. performance  
- **Hourly aggregation**: Lightweight, good for overviews
- **Recommended**: Use appropriate granularity for your use case

## 🎉 **You're All Set!**

Your system now supports:
✅ **60 data points per hour** (granularityMinutes=1)  
✅ **Flexible time ranges** (1 hour to multiple days)
✅ **Smart gap handling** (null values for missing data)
✅ **Multiple sensor types** (pH, temperature, etc.)
✅ **Consistent API** (backward compatible)

Use `timeRange=1&granularityMinutes=1` to get exactly what you requested: **60 data points for a 1-hour range**!