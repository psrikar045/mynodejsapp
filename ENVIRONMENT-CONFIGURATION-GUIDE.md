# 🌍 Environment Configuration Guide

## 📋 **How Environment Detection Works**

The system automatically detects the environment using these rules:

### **Production Environment Detected When:**
1. `NODE_ENV=production` is set
2. `RENDER` environment variable exists (for Render.com deployment)
3. Any of the above conditions are true

### **Development Environment (Default):**
- When no environment variables are set
- When `NODE_ENV` is not "production"
- Local development setup

## 🔧 **Setting Environment Variables**

### **Method 1: Command Line (Temporary)**

#### **Linux/Mac:**
```bash
# Set to production
NODE_ENV=production node index.js

# Set to development (explicit)
NODE_ENV=development node index.js

# Default (no setting needed)
node index.js  # Defaults to development
```

#### **Windows:**
```cmd
# Set to production
set NODE_ENV=production && node index.js

# Set to development (explicit)
set NODE_ENV=development && node index.js

# Default (no setting needed)
node index.js  # Defaults to development
```

#### **PowerShell (Windows):**
```powershell
# Set to production
$env:NODE_ENV="production"; node index.js

# Set to development
$env:NODE_ENV="development"; node index.js
```

### **Method 2: .env File (Recommended)**

Create a `.env` file in your project root:

#### **For Production (.env):**
```bash
NODE_ENV=production
ADAPTIVE_MODE=true
VERBOSE_LOGGING=false
PORT=3000
```

#### **For Development (.env):**
```bash
NODE_ENV=development
ADAPTIVE_MODE=true
VERBOSE_LOGGING=true
PORT=3000
```

### **Method 3: System Environment Variables (Persistent)**

#### **Linux/Mac (Persistent):**
```bash
# Add to ~/.bashrc or ~/.profile
export NODE_ENV=production
export ADAPTIVE_MODE=true
export VERBOSE_LOGGING=false

# Reload shell
source ~/.bashrc
```

#### **Windows (Persistent):**
```cmd
# Set system environment variable
setx NODE_ENV production
setx ADAPTIVE_MODE true
setx VERBOSE_LOGGING false

# Restart command prompt to take effect
```

### **Method 4: PM2 Configuration**

#### **Using PM2 Ecosystem File:**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'linkedin-scraper',
    script: 'index.js',
    env: {
      NODE_ENV: 'development',
      ADAPTIVE_MODE: 'true',
      VERBOSE_LOGGING: 'true'
    },
    env_production: {
      NODE_ENV: 'production',
      ADAPTIVE_MODE: 'true',
      VERBOSE_LOGGING: 'false'
    }
  }]
};
```

#### **PM2 Commands:**
```bash
# Start in development
pm2 start ecosystem.config.js

# Start in production
pm2 start ecosystem.config.js --env production

# Or directly
pm2 start index.js --name linkedin-scraper --env production
```

## 🔍 **How to Check Current Environment**

### **Method 1: Check via API**
```bash
# Check system status (includes environment)
curl http://localhost:3000/status

# Response includes:
# "environment": "production" or "development"
```

### **Method 2: Check via Logs**
When you start the application, look for:
```
📊 Environment: production
🧠 Adaptive Mode: ✅ Enabled
```

### **Method 3: Check via Node.js**
```javascript
// In Node.js console or script
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Is Production:', process.env.NODE_ENV === 'production');
```

## 🎯 **Environment Differences**

### **Production Environment:**
```bash
NODE_ENV=production
```

**Behavior:**
- ✅ **Browser Priority**: Microsoft Edge → Chrome → Chromium
- ✅ **Logging**: Minimal, production-focused
- ✅ **Performance**: Optimized for speed
- ✅ **Error Handling**: Graceful, user-friendly
- ✅ **Caching**: Enabled and optimized
- ✅ **Security**: Enhanced security headers

**Browser Selection:**
1. `/usr/bin/microsoft-edge` (your production Edge)
2. `/usr/bin/google-chrome-stable`
3. `/usr/bin/google-chrome`
4. Puppeteer bundled browser

### **Development Environment:**
```bash
NODE_ENV=development  # or not set
```

**Behavior:**
- ✅ **Browser Priority**: Local browsers → Puppeteer bundled
- ✅ **Logging**: Verbose, detailed debugging
- ✅ **Performance**: Debug-friendly
- ✅ **Error Handling**: Detailed error messages
- ✅ **Caching**: Reduced for testing
- ✅ **Security**: Relaxed for development

**Browser Selection:**
1. Local Edge/Chrome (Windows/Mac paths)
2. Puppeteer bundled browser

## 🚀 **Recommended Setups**

### **For Production Server:**
```bash
# Option 1: .env file (recommended)
echo "NODE_ENV=production" > .env
echo "ADAPTIVE_MODE=true" >> .env
echo "VERBOSE_LOGGING=false" >> .env
node index.js

# Option 2: Direct command
NODE_ENV=production node index.js

# Option 3: PM2 (best for production)
pm2 start index.js --name linkedin-scraper --env production
```

### **For Local Development:**
```bash
# Option 1: Default (no setup needed)
node index.js

# Option 2: Explicit development
NODE_ENV=development node index.js

# Option 3: .env file for consistency
echo "NODE_ENV=development" > .env
echo "VERBOSE_LOGGING=true" >> .env
node index.js
```

### **For Testing:**
```bash
# Test production behavior locally
NODE_ENV=production node index.js

# Test with different settings
NODE_ENV=production VERBOSE_LOGGING=true node index.js
```

## 🔧 **Auto-Detection Features**

The system has **smart auto-detection**:

### **Automatic Production Detection:**
- ✅ **Render.com**: Automatically detected via `RENDER` env var
- ✅ **Heroku**: Detected via common Heroku env vars
- ✅ **Docker**: Detected via container environment
- ✅ **Linux Servers**: Detected via system paths

### **Automatic Development Detection:**
- ✅ **Local Machine**: When no production indicators found
- ✅ **Windows/Mac**: Local development paths detected
- ✅ **IDE Environment**: Development tools detected

## 📊 **Environment Status Check**

### **Create Environment Check Script:**
```bash
# Create env-check.js
cat > env-check.js << 'EOF'
console.log('🌍 Environment Configuration Check');
console.log('================================');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development (default)');
console.log('Is Production:', process.env.NODE_ENV === 'production');
console.log('ADAPTIVE_MODE:', process.env.ADAPTIVE_MODE || 'true (default)');
console.log('VERBOSE_LOGGING:', process.env.VERBOSE_LOGGING || 'false (default)');
console.log('PORT:', process.env.PORT || '3000 (default)');
console.log('Platform:', process.platform);
console.log('Node Version:', process.version);

// Check for production indicators
const productionIndicators = [
    process.env.NODE_ENV === 'production',
    !!process.env.RENDER,
    !!process.env.HEROKU,
    !!process.env.PM2_HOME
];

console.log('\n🔍 Production Indicators:');
console.log('NODE_ENV=production:', process.env.NODE_ENV === 'production');
console.log('RENDER detected:', !!process.env.RENDER);
console.log('HEROKU detected:', !!process.env.HEROKU);
console.log('PM2 detected:', !!process.env.PM2_HOME);

const isProduction = productionIndicators.some(indicator => indicator);
console.log('\n🎯 Final Environment:', isProduction ? 'PRODUCTION' : 'DEVELOPMENT');
EOF

# Run the check
node env-check.js
```

## 🚨 **Common Issues & Solutions**

### **1. Environment Not Detected**
```bash
# Check current environment
node -e "console.log('NODE_ENV:', process.env.NODE_ENV || 'undefined')"

# Set explicitly
export NODE_ENV=production  # Linux/Mac
set NODE_ENV=production     # Windows
```

### **2. .env File Not Working**
```bash
# Verify .env file exists and has correct format
cat .env

# Should show:
# NODE_ENV=production
# ADAPTIVE_MODE=true
# VERBOSE_LOGGING=false

# Check file permissions
ls -la .env
```

### **3. PM2 Environment Issues**
```bash
# Check PM2 environment
pm2 show linkedin-scraper

# Restart with specific environment
pm2 restart linkedin-scraper --env production

# Check PM2 logs for environment info
pm2 logs linkedin-scraper
```

### **4. Windows Environment Variables**
```cmd
# Check current environment variables
echo %NODE_ENV%

# Set temporarily
set NODE_ENV=production

# Set permanently
setx NODE_ENV production
```

## 🎉 **Quick Setup Commands**

### **Production Setup (One Command):**
```bash
# Linux/Mac
echo "NODE_ENV=production" > .env && echo "ADAPTIVE_MODE=true" >> .env && echo "VERBOSE_LOGGING=false" >> .env && node index.js

# Windows
echo NODE_ENV=production > .env && echo ADAPTIVE_MODE=true >> .env && echo VERBOSE_LOGGING=false >> .env && node index.js
```

### **Development Setup (Default):**
```bash
# Just run - defaults to development
node index.js
```

### **Check Environment:**
```bash
# Quick environment check
curl http://localhost:3000/status | grep environment
```

## 📝 **Summary**

### **✅ Automatic (No Setup Needed):**
- Defaults to **development** environment
- Auto-detects production platforms (Render, Heroku, etc.)
- Smart browser selection based on environment

### **🔧 Manual Setup Options:**
1. **Command line**: `NODE_ENV=production node index.js`
2. **`.env` file**: Create `.env` with `NODE_ENV=production`
3. **System variables**: `export NODE_ENV=production`
4. **PM2**: `pm2 start index.js --env production`

### **🎯 Recommended for Production:**
```bash
# Best practice for production
echo "NODE_ENV=production" > .env
pm2 start index.js --name linkedin-scraper --env production
```

**The system works automatically with sensible defaults, but you can override as needed!** 🚀