# 🚀 Enhanced System Monitoring & Logging Guide

Your extraction system now has **enterprise-level monitoring, logging, and analytics** - giving you complete visibility into your Linux server operations with **long-term data storage**.

## 🎯 What's New

| Feature | Description | Benefit |
|---------|-------------|---------|
| **🔍 Search History** | Long-term storage of every extraction | Track patterns, analyze success rates over time |
| **🏥 System Health** | Real-time server monitoring | Monitor memory, CPU, disk, uptime with alerts |
| **📝 Detailed Logs** | Separate log files by type | Easier debugging with organized logs |
| **📊 Analytics** | Comprehensive statistics | Data-driven insights for optimization |
| **🌐 Web Dashboards** | Beautiful browser interfaces | Easy monitoring from anywhere |
| **💾 Persistent Storage** | Long-term data retention | Historical analysis and reporting |

## 📋 Complete Endpoint Reference

### 🔥 **Primary Monitoring Endpoints**

#### 1. **Real-time Extraction Logs** (Enhanced)
```
GET /api/extraction-logs?format=html
```
**What's New**: Session tracking, step-by-step flow, performance metrics
- **Web Dashboard**: Beautiful real-time log viewer
- **Filters**: By level, session, time
- **Auto-refresh**: 30-second intervals
- **Session Tracking**: Follow specific extractions from start to finish

#### 2. **System Health Dashboard** (NEW)
```
GET /api/system-health?format=html
```
**Monitor**: Memory usage, CPU load, uptime, disk space, system alerts
- **Real-time Metrics**: Updated every 30 seconds
- **Health Alerts**: Automatic warnings for high resource usage
- **System Info**: Platform, Node version, environment details
- **Historical Data**: Track system performance over time

#### 3. **Search History & Analytics** (NEW)
```
GET /api/search-history?format=html
```
**Track**: Every URL searched, success rates, performance trends
- **Long-term Storage**: Permanent record of all extractions
- **Analytics Dashboard**: Success rates, duration trends, cache hits
- **Company Insights**: Track company names, industries extracted
- **LinkedIn Statistics**: Dedicated LinkedIn success monitoring

### 📊 **Analytics & Data Endpoints**

#### 4. **Search Analytics API**
```
GET /api/search-analytics
```
**Returns**:
- Total searches and success rates
- Average extraction duration
- LinkedIn-specific statistics
- Cache hit rates
- Recent activity (24h, 1h)
- Top domains extracted

#### 5. **Detailed File Logs**
```
GET /api/logs/:logType
```
**Log Types Available**:
- `extraction` - All extraction activities
- `errors` - Error logs with stack traces
- `performance` - Performance timing data
- `system` - System health events
- `api` - API request/response logs
- `security` - Security-related events
- `browser` - Browser launch/close events
- `linkedin` - LinkedIn-specific activities

#### 6. **Log Files Status**
```
GET /api/logs-status
```
**Monitor**: File sizes, last modified dates, rotation status

#### 7. **Universal Log Search**
```
GET /api/logs/search/:query
```
**Search**: Across all log types with filters and time ranges

### 🔧 **System Management**

#### 8. **Export Search History**
```
GET /api/search-history/export?format=json|csv
```
**Export**: Complete search history for analysis or backup

#### 9. **Active Sessions Monitor**
```
GET /api/extraction-sessions
```
**View**: Currently running and recent extractions

## 🌐 **Web Dashboards Overview**

### 1. **Real-time Extraction Monitor**
`your-server.com/api/extraction-logs?format=html`

**Features**:
- 📊 Live statistics (success rates, active sessions)
- 🔍 Filter by error level, session ID
- ⏰ Auto-refresh capability
- 🎨 Color-coded log levels
- 📱 Mobile-friendly interface

### 2. **System Health Dashboard**
`your-server.com/api/system-health?format=html`

**Features**:
- 💾 Memory usage graphs and alerts
- ⏱️ System and process uptime
- 🔄 Load average monitoring
- 🚨 Critical system alerts
- 🔧 Environment and configuration info

### 3. **Search History Analytics**
`your-server.com/api/search-history?format=html`

**Features**:
- 📈 Success rate trends
- 🏢 Company extraction statistics  
- 🔗 LinkedIn vs. website analysis
- ⚡ Performance metrics
- 📁 Export functionality

## 📊 **Search History Data Structure**

Every extraction is logged with comprehensive details:

```json
{
  "searchId": "search_1705123456_abc123",
  "timestamp": "2024-01-13T10:30:00.000Z",
  "url": "https://www.linkedin.com/company/microsoft/",
  "domain": "linkedin.com",
  "sessionId": "session_1705123456_def456",
  
  "status": "success",
  "performance": {
    "duration": 12500,
    "cacheHit": false,
    "browserLaunchTime": 3000,
    "extractionTime": 8500
  },
  
  "extraction": {
    "fieldsExtracted": ["companyName", "industry", "website"],
    "companyName": "Microsoft Corporation",
    "industry": "Computer Software",
    "hasLogo": true,
    "hasBanner": true,
    "isLinkedIn": true,
    "isVerified": true
  },
  
  "technical": {
    "userAgent": "Mozilla/5.0...",
    "browserUsed": "chrome",
    "platform": "linux",
    "retryCount": 0
  }
}
```

## 🏥 **System Health Monitoring**

### **Automatic Health Checks Every 30 Seconds**

**Memory Monitoring**:
- Process heap usage
- System memory availability
- Memory leak detection
- Automatic alerts when > 85% usage

**Performance Monitoring**:
- CPU usage approximation
- System load averages
- Process uptime tracking
- Response time monitoring

**System Information**:
- Disk space monitoring
- Network interface status
- Environment configuration
- Node.js version tracking

### **Alert System**

**Warning Alerts** (Yellow):
- Memory usage > 85%
- High system load
- Extended response times

**Critical Alerts** (Red):
- Memory usage > 95%
- System memory critically low
- Process crashes or restarts

## 📝 **Detailed File Logging**

### **Organized Log Files**

All logs are stored in `/logs/` directory:

```
logs/
├── extraction.log      - All extraction activities
├── errors.log         - Errors with full stack traces  
├── performance.log    - Timing and performance data
├── system.log         - System health events
├── api.log           - API requests and responses
├── security.log      - Security-related events
├── browser.log       - Browser operations
├── linkedin.log      - LinkedIn-specific activities
└── daily-logs/       - Daily organized logs
    ├── searches-2024-01-13.json
    └── searches-2024-01-14.json
```

### **Automatic Log Rotation**

- **Max Size**: 10MB per log file
- **Rotation**: Automatic when limit reached
- **Retention**: 5 rotated files per type
- **Cleanup**: Automatic removal of old files

## 🔍 **Advanced Analytics Features**

### **LinkedIn Success Tracking**
- Separate success rates for LinkedIn vs. other sites
- Anti-bot detection effectiveness
- Banner extraction success rates
- Company verification statistics

### **Performance Analysis**
- Average extraction times by domain
- Cache hit rate optimization
- Browser launch time tracking
- Memory usage per extraction

### **Usage Patterns**
- Peak usage hours
- Most extracted domains
- Company name extraction rates
- Industry distribution analysis

## 🚀 **Getting Started**

### 1. **Start Your Enhanced Server**
```bash
npm start
```

### 2. **Access Web Dashboards**
Open in your browser:
- **Main Monitor**: `your-server.com/api/extraction-logs?format=html`
- **System Health**: `your-server.com/api/system-health?format=html` 
- **Search History**: `your-server.com/api/search-history?format=html`

### 3. **Run Test Extractions**
```bash
# Test the enhanced system
node test-enhanced-system.js

# Run a sample extraction
curl -X POST your-server.com/api/extract-company-details \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.linkedin.com/company/microsoft/"}'
```

### 4. **Monitor in Real-time**
- Watch logs appear instantly in the web dashboards
- Check system health metrics
- Analyze search history patterns

## 💡 **Pro Tips**

### **Production Monitoring Workflow**
1. **Keep dashboards open** during active usage
2. **Monitor system health** for resource issues
3. **Check search analytics** for success rate trends
4. **Use log search** to investigate specific issues
5. **Export data** regularly for offline analysis

### **Debugging Workflow**
1. **Check extraction logs** for real-time issues
2. **Search specific logs** by error type or session
3. **Review search history** for pattern analysis
4. **Monitor system health** for resource constraints
5. **Export logs** for detailed offline analysis

### **Performance Optimization**
- **Monitor cache hit rates** - optimize for better performance
- **Track LinkedIn success rates** - adjust anti-bot strategies
- **Analyze extraction times** - identify slow domains
- **Monitor memory usage** - prevent resource issues

## 🎯 **Key Benefits**

### **For Debugging**
- ✅ **Real-time visibility** into extraction process
- ✅ **Step-by-step tracking** of each extraction
- ✅ **Comprehensive error logging** with context
- ✅ **Historical data** for pattern analysis

### **For Performance**
- ✅ **Cache effectiveness** monitoring
- ✅ **Resource usage** alerts and tracking
- ✅ **Success rate optimization** insights
- ✅ **System health** proactive monitoring

### **For Analytics**
- ✅ **Long-term data storage** for trend analysis
- ✅ **Company intelligence** tracking
- ✅ **Usage pattern** identification
- ✅ **ROI measurement** capabilities

### **For Operations**
- ✅ **Web-based monitoring** from anywhere
- ✅ **Automatic alerting** for issues
- ✅ **Data export** for reporting
- ✅ **Memory-safe operations** with cleanup

## 🔧 **Maintenance**

### **Automatic Maintenance**
- **Log rotation** when files get too large
- **Memory cleanup** to prevent leaks
- **Old data removal** based on retention policies
- **Health monitoring** with automatic alerts

### **Manual Maintenance**
```bash
# Clear old search data (keeps 90 days by default)
curl -X POST your-server.com/api/search-history/cleanup

# Export data before cleanup
curl your-server.com/api/search-history/export > backup.json

# Clear extraction logs if needed
curl -X POST your-server.com/api/extraction-logs/clear
```

---

🎉 **You now have enterprise-level monitoring and logging for your extraction system!** 

**Next Steps**: Open the web dashboards and start monitoring your extractions in real-time.