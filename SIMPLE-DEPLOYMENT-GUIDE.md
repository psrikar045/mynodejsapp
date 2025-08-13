# Simple Production Deployment Guide

## 🎯 Quick Start (Single Command)

### For Windows:
```cmd
deploy.bat
```

### For Linux/Mac:
```bash
chmod +x deploy.sh
./deploy.sh
```

### Manual (Any OS):
```bash
node index.js
```

That's it! The system will auto-initialize everything.

---

## 📋 Step-by-Step Manual Deployment

### 1. Prerequisites Check
```bash
# Check Node.js version (18+ required)
node --version

# Check npm
npm --version
```

### 2. Install Dependencies
```bash
# Install production dependencies
npm ci --only=production

# Install Chrome for Puppeteer (if no system browser available)
npx puppeteer browsers install chrome

# Note: System will automatically detect Microsoft Edge at /usr/bin/microsoft-edge
# or other installed browsers (Chrome, Chromium) and use them preferentially
```

### 3. Set Environment (Optional)
```bash
# Linux/Mac
export NODE_ENV=production
export ADAPTIVE_MODE=true
export VERBOSE_LOGGING=false

# Windows
set NODE_ENV=production
set ADAPTIVE_MODE=true
set VERBOSE_LOGGING=false
```

### 4. Start Application
```bash
# Simple start
node index.js

# The system will automatically:
# ✅ Check system health
# ✅ Deploy adaptive system
# ✅ Initialize all components
# ✅ Schedule maintenance
# ✅ Start the server
```

---

## 🔧 Production Management

### Using PM2 (Recommended)
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start index.js --name linkedin-scraper --env production

# Auto-restart on server reboot
pm2 startup
pm2 save

# Monitor
pm2 status
pm2 logs linkedin-scraper
pm2 monit
```

### Direct Node.js
```bash
# Start in background (Linux/Mac)
nohup node index.js > app.log 2>&1 &

# Start in background (Windows)
start /b node index.js
```

---

## 📊 Health Monitoring

### Check System Status
```bash
# Health check
curl http://localhost:3000/health

# Detailed status
curl http://localhost:3000/status

# LinkedIn metrics
curl http://localhost:3000/linkedin-metrics
```

### View Logs
```bash
# PM2 logs
pm2 logs linkedin-scraper

# Direct logs (if using nohup)
tail -f app.log

# System logs
tail -f scraper.log
```

---

## 🚨 Troubleshooting

### Common Issues

#### 1. "Browser not found"
```bash
# Solution 1: Install Chrome for Puppeteer
npx puppeteer browsers install chrome

# Solution 2: Verify Microsoft Edge installation
ls -la /usr/bin/microsoft-edge

# Solution 3: Install system browser
# Ubuntu/Debian: sudo apt install microsoft-edge-stable
# CentOS/RHEL: sudo yum install microsoft-edge-stable
```

#### 2. "Port 3000 already in use"
```bash
# Find process
netstat -tulpn | grep :3000  # Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>  # Linux
taskkill /PID <PID> /F  # Windows
```

#### 3. "Permission denied"
```bash
# Linux/Mac
chmod +x deploy.sh
sudo chown -R $USER:$USER .
```

#### 4. Auto-initialization fails
```bash
# Manual deployment
node deploy-adaptive-system.js
node index.js
```

---

## 🔄 Updates & Maintenance

### Update Application
```bash
# Stop application
pm2 stop linkedin-scraper  # or kill process

# Update files (git pull, file upload, etc.)

# Restart
pm2 start linkedin-scraper  # or node index.js
```

### Manual Maintenance
```bash
# Run maintenance
node maintenance-script.js

# Check system health
node test-production-readiness.js
```

---

## 📈 Performance Tips

### 1. Memory Management
```bash
# Set memory limit
node --max-old-space-size=2048 index.js

# With PM2
pm2 start index.js --max-memory-restart 2G
```

### 2. Environment Optimization
```bash
# Production settings
export NODE_ENV=production
export VERBOSE_LOGGING=false
export ADAPTIVE_MODE=true
```

### 3. Log Management
```bash
# Rotate logs with PM2
pm2 install pm2-logrotate

# Manual log cleanup
find . -name "*.log" -size +10M -delete
```

---

## 🎯 Summary

**Simplest Deployment:**
```bash
node index.js
```

**Production Deployment:**
```bash
npm ci --only=production
npx puppeteer browsers install chrome
pm2 start index.js --name linkedin-scraper --env production
```

**Health Check:**
```bash
curl http://localhost:3000/health
```

The system handles everything else automatically! 🚀