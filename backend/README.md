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

### Bookings
- POST /api/bookings/check-availability - Check whether a room is free for a date range
- POST /api/bookings - Create a booking and lock room availability
- GET /api/bookings - List bookings. Optional query: `userId`, `status`
- GET /api/bookings/:id - Get booking detail
- PATCH /api/bookings/:id/cancel - Cancel a pending/confirmed booking and release availability
- PATCH /api/bookings/:id/check-in - Move booking to `checked_in` and mark room `occupied`
- PATCH /api/bookings/:id/check-out - Move booking to `checked_out`, release availability, and mark room `available`

Example create booking payload:
```json
{
  "userId": 1,
  "roomId": 2,
  "checkIn": "2026-07-01",
  "checkOut": "2026-07-03",
  "adults": 2,
  "children": 0,
  "notes": "Late arrival"
}
```

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
