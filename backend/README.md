# Hotel Booking Backend

Backend API for the hotel booking management system.

## Tech Stack
- Node.js
- Express.js
- MySQL
- mysql2 (database driver)

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Database
1. Create a MySQL database named `hotelbookingdb`
2. Update the `.env` file with your database credentials:
   ```
   PORT=3001
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=hotelbookingdb
   ```

### 3. Import Database Schema
```bash
mysql -u root -p hotelbookingdb < schema.sql
```

### 4. Start the Server
```bash
npm start
```

The server will be running at http://localhost:3001

## API Endpoints

### Health Check
- GET /api/health - Check server status
- GET /api/db-test - Test database connection

## Project Structure
```
backend/
├── config/
│   └── db.js        # Database configuration
├── .env             # Environment variables
├── package.json
├── schema.sql       # Database schema
└── server.js        # Main server file
```