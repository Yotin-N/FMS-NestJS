# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a Farm Management System (FMS) built with NestJS, designed for IoT-based shrimp farm management. The system handles real-time sensor data via MQTT, provides REST APIs for farm management, and includes authentication with multiple strategies.

## Development Commands
```bash
# Development
npm run start:dev          # Start in development mode with hot reload
npm run start:debug        # Start with debugging enabled
npm run start              # Start in normal mode
npm run start:prod         # Start in production mode

# Building and Testing
npm run build              # Build the application
npm run lint               # Run ESLint with auto-fix
npm run format             # Format code with Prettier
npm run test               # Run unit tests
npm run test:watch         # Run tests in watch mode
npm run test:cov           # Run tests with coverage report
npm run test:e2e           # Run end-to-end tests

# Database Operations
npm run migration:generate # Generate new migration
npm run migration:run      # Run pending migrations
npm run migration:revert   # Revert last migration
npm run schema:sync        # Sync database schema (use with caution)
npm run schema:drop        # Drop all database tables
npm run seed               # Run database seeds

# Utilities
npm run cleanup:sensors    # Clean up sensor types via script
```

## Architecture

### Core Structure
- **Modular Architecture**: Each domain (auth, user, farm, device, sensor, etc.) is organized as a NestJS module
- **Database**: MySQL with TypeORM for ORM and migrations
- **Real-time Communication**: MQTT integration for IoT sensor data
- **Authentication**: Multi-strategy auth (JWT, Local, Google OAuth)
- **API Documentation**: Swagger/OpenAPI integration (available at `/api` in non-production)

### Key Modules
- `auth/` - Authentication with JWT, local, and Google strategies
- `user/` - User management and profiles  
- `farm/` - Farm entity management
- `device/` - IoT device registration and management
- `sensor/` - Sensor configuration and metadata
- `sensor-reading/` - Time-series sensor data storage
- `sensor-threshold/` - Alert threshold configuration
- `mqtt/` - MQTT message handling and topic management
- `dashboard/` - Dashboard data aggregation

### MQTT Integration
The system uses a sophisticated MQTT setup:
- **Cloud and Local MQTT**: Configurable via `USE_MQTT_CLOUD` environment variable
- **Topic Patterns**: 
  - `shrimp_farm/{farmId}/device/{deviceId}/sensor/{sensorType}`
  - `sensor/{serialNumber}`
  - `sensors/{sensorType}/{serialNumber}`
- **Auto-subscription**: Automatically subscribes to all registered sensors on startup
- **Message Processing**: Handles both JSON and plain numeric payloads

### Database Configuration  
- **Connection**: MySQL with SSL support (configurable via `DB_SSL`)
- **Migrations**: Located in migrations that reference `src/config/database.config.ts` 
- **Entities**: Auto-loaded from `/**/*.entity{.ts,.js}` pattern
- **SSL Certificates**: TiDB certificate in `src/certs/tidb.pem`

### Authentication Flow
- **JWT Strategy**: Extracts tokens from cookies (preferred) or Authorization header
- **Google OAuth**: Integrated for social login
- **Role-based Access**: User roles supported with guards
- **Token Storage**: Uses HTTP-only cookies for security

## Environment Configuration
Key environment variables:
- Database: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `DB_SSL`
- MQTT Cloud: `USE_MQTT_CLOUD`, `MQTT_CLOUD_URL`, `MQTT_CLOUD_PORT`, `MQTT_CLOUD_USERNAME`, `MQTT_CLOUD_PASSWORD`
- MQTT Local: `MQTT_URL`, `MQTT_PORT`, `MQTT_USE_SSL`, `MQTT_USERNAME`, `MQTT_PASSWORD`
- Auth: `JWT_SECRET`, Google OAuth credentials
- CORS: `CORS_ORIGIN` (comma-separated list of allowed origins)

## Development Notes
- **CORS**: Configured for multiple origins including localhost and Vercel deployment
- **Global Validation**: Uses class-validator with whitelist and transform enabled
- **API Prefix**: All routes prefixed with `/api`
- **Swagger**: Auto-generated docs with JWT auth support (disabled in production)
- **Logging**: Structured logging with NestJS Logger throughout
- **Error Handling**: Global exception filters in `common/filters/`

## Testing
- **Unit Tests**: Jest configuration in package.json, tests in `src/` alongside source files
- **E2E Tests**: Separate configuration in `test/jest-e2e.json`
- **Coverage**: Reports generated to `coverage/` directory
- **Test Database**: Consider separate test database configuration for integration tests

## Common Patterns
- **DTOs**: Input validation and transformation using class-validator
- **Entities**: TypeORM entities with proper relationships and indexes
- **Services**: Business logic layer with dependency injection
- **Controllers**: Thin controllers focused on HTTP concerns
- **Guards**: Authentication and authorization guards
- **Interceptors**: Cross-cutting concerns like logging and transformations