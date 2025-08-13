# 🚀 Extraction Logs System - Production Debugging Guide

This system provides **real-time logging and monitoring** for your extraction processes, similar to local development but accessible on your Linux server.

## 🎯 Problem Solved

- **❌ Before**: No visibility into production extraction process
- **❌ Before**: Can't see errors, steps, or flow on Linux server  
- **❌ Before**: Difficult to debug issues in production
- **✅ Now**: Full real-time logging with web-based viewing
- **✅ Now**: Session-based tracking for each extraction
- **✅ Now**: Easy debugging with detailed step-by-step logs

## 📋 Available Endpoints

### 1. **Real-time Logs Viewer** (Most Important)
```
GET /api/extraction-logs?format=html
```
**What it does**: Opens a beautiful web interface showing all extraction logs in real-time
**How to use**: Open this URL in your browser to see live logs
- Auto-refresh capability
- Filter by error level (errors, warnings, info, steps)
- Filter by specific session
- Color-coded log levels

### 2. **JSON Logs API**
```
GET /api/extraction-logs
```
**Parameters**:
- `limit`: Number of recent logs (default: 100)
- `level`: Filter by level (error, warn, info, step, debug)
- `sessionId`: Filter by specific session

**Example**:
```bash
# Get last 50 logs
curl "your-server.com/api/extraction-logs?limit=50"

# Get only errors
curl "your-server.com/api/extraction-logs?level=error"
```

### 3. **Session-Specific Logs**
```
GET /api/extraction-logs/:sessionId
```
**What it does**: Gets detailed logs for a specific extraction session
**Returns**: Complete session info including steps, errors, performance metrics

### 4. **Active Sessions Monitor**
```
GET /api/extraction-sessions
```
**What it does**: Shows all active and recent extraction sessions
**Returns**: Session summaries with status, duration, error counts

### 5. **Clear Logs** (Emergency)
```
POST /api/extraction-logs/clear
```
**What it does**: Clears all logs (use if memory issues occur)

## 🔍 How to Debug Your Extractions

### Method 1: Browser Interface (Recommended)
1. Open your browser
2. Go to: `https://your-server.com/api/extraction-logs?format=html`
3. You'll see a real-time dashboard with:
   - 📊 **Statistics**: Success rates, active sessions
   - 🔍 **Filters**: Error levels, session IDs
   - 📋 **Live Logs**: Color-coded, timestamped logs
   - 🔄 **Auto-refresh**: Updates every 30 seconds

### Method 2: API Calls
```bash
# Trigger an extraction (this will create logs)
curl -X POST https://your-server.com/api/extract-company-details \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.linkedin.com/company/microsoft/"}'

# Immediately check logs for any issues
curl "https://your-server.com/api/extraction-logs?limit=20&level=error"

# Get full session details
curl "https://your-server.com/api/extraction-logs/session_1234567890_abc123"
```

## 📊 What Information You'll See

### Session Overview
```json
{
  "sessionId": "session_1705123456_abc123",
  "url": "https://www.linkedin.com/company/microsoft/",
  "startTime": "2024-01-13T10:30:00.000Z",
  "endTime": "2024-01-13T10:32:30.000Z",
  "status": "completed",
  "duration": 150000,
  "stepsCount": 12,
  "errorsCount": 0,
  "warningsCount": 1
}
```

### Detailed Steps Logged
- ✅ **URL Validation**: Validates and normalizes URLs
- ✅ **Cache Check**: Shows cache hits/misses
- ✅ **Domain Resolution**: DNS lookup results
- ✅ **Browser Launch**: Browser startup success/failure
- ✅ **Page Navigation**: Navigation attempts and results
- ✅ **Data Extraction**: Extraction process steps
- ✅ **LinkedIn Scraping**: LinkedIn-specific steps
- ✅ **Browser Cleanup**: Browser closure and cleanup
- ❌ **All Errors**: Detailed error information with stack traces

### Log Levels
- 🔴 **ERROR**: Critical failures, exceptions
- 🟡 **WARN**: Warnings, retries, fallbacks  
- 🔵 **INFO**: General information
- 🟢 **STEP**: Process steps and milestones
- ⚪ **DEBUG**: Detailed debug information

## 🚨 Common Debugging Scenarios

### Scenario 1: Extraction Times Out
**What to look for**:
```
🔍 Filter by: level=error
👀 Look for: "timeout", "navigation failed"
```

### Scenario 2: LinkedIn Blocking
**What to look for**:
```
🔍 Filter by: level=warn
👀 Look for: "anti-bot", "blocked", "403", "rate limit"
```

### Scenario 3: Browser Issues
**What to look for**:
```
🔍 Filter by: level=error  
👀 Look for: "browser launch", "Chrome", "navigation"
```

### Scenario 4: Data Extraction Problems
**What to look for**:
```
🔍 Filter by: level=step
👀 Look for: "extraction", "data fields", "banner"
```

## 🧪 Testing the System

Run the test script:
```bash
node test-extraction-logs.js
```

This will:
1. Test server connection
2. Run a sample extraction
3. Check logging endpoints
4. Display available endpoints

## 💡 Pro Tips

### 1. **Real-time Monitoring**
- Keep `your-server.com/api/extraction-logs?format=html` open while testing
- Use auto-refresh for continuous monitoring
- Filter by session ID to track specific extractions

### 2. **Error Investigation**
```bash
# Quick error check
curl "your-server.com/api/extraction-logs?level=error&limit=10"

# Get session details if you have session ID  
curl "your-server.com/api/extraction-logs/SESSION_ID_HERE"
```

### 3. **Performance Monitoring**
```bash
# Check active sessions and success rates
curl "your-server.com/api/extraction-sessions"
```

### 4. **Memory Management**
- System automatically rotates logs to prevent memory issues
- Maximum 1000 global logs, 50 sessions
- Use `/clear` endpoint if needed

## 🔧 System Integration

### Every Extraction Now Includes:
- **Session ID**: Unique identifier in response `_sessionId`
- **Detailed Logging**: Step-by-step process logging
- **Error Context**: Rich error information with context
- **Performance Metrics**: Timing and performance data

### Response Format:
```json
{
  "companyLogo": "...",
  "bannerImage": "...",
  "website": "...",
  "_sessionId": "session_1705123456_abc123",
  "_cached": false
}
```

## 🎉 Benefits

1. **🔍 Full Visibility**: See every step of extraction process
2. **🚨 Quick Debugging**: Instantly identify issues and bottlenecks  
3. **📊 Performance Monitoring**: Track success rates and timing
4. **🔄 Real-time Updates**: Monitor extractions as they happen
5. **💾 Session Tracking**: Follow specific extractions from start to finish
6. **🌐 Web Interface**: Beautiful, easy-to-use browser interface
7. **📱 Mobile Friendly**: Works on mobile devices
8. **🔐 Production Ready**: Memory-safe with automatic cleanup

## 🚀 Getting Started

1. **Start your server** (the logging system is now integrated)
2. **Open browser** to `your-server.com/api/extraction-logs?format=html`  
3. **Run an extraction** via `/api/extract-company-details`
4. **Watch the logs** appear in real-time!

That's it! You now have production-level debugging capabilities similar to your local development environment.

---

**Need help?** Check the test script or examine the logs for any issues during setup.