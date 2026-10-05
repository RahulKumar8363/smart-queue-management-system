# ⚡ Smart Queue Management System (Full-Stack College Project)

A real-time, web-based Queue Management System designed for hospitals, banks, and public service offices to eliminate physical long lines and deliver predictive waiting time estimations.

---

## 🌟 Key Features

1. **Online Digital Token Booking**: Users can book tokens digitally from their mobile devices or kiosk interface.
2. **Predictive Wait Time Engine**: Calculates dynamic waiting times based on queue length, department handling speed, and active servicing counters.
3. **Live Token Position Tracker**: Real-time websocket updates via Socket.io showing position in line, status transitions, and audio alerts.
4. **Staff Counter Control Panel**: Staff interface to call next tokens, recall, mark completion, or flag no-shows.
5. **Real-time Analytics Dashboard**: Monitors peak usage, total tokens issued, average wait times, and department performance.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3 (Glassmorphism & Responsive Grid), Vanilla JavaScript (ES6+), Socket.io Client
- **Backend**: Node.js, Express.js
- **Database**: MySQL (with zero-setup standalone fallback mode for instant demonstration)
- **Real-Time Websockets**: Socket.io

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Database (Optional for MySQL)
Edit `.env` or set environment variables:
```env
PORT=3000
DB_TYPE=mysql
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=smart_queue_db
```
*Note: If MySQL is not running locally, the system automatically runs in standalone in-memory mode so you can demo the application instantly!*

Import `schema.sql` into MySQL if using MySQL:
```bash
mysql -u root -p < schema.sql
```

### 3. Start Application
```bash
npm start
```
Or for auto-reloading development mode:
```bash
npm run dev
```

---

## 📱 Access Portals

- **User Ticket Booking & Tracking**: [http://localhost:3000](http://localhost:3000)
- **Staff Counter Control Panel**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)
- **Live Analytics & Display Monitor**: [http://localhost:3000/dashboard.html](http://localhost:3000/dashboard.html)
