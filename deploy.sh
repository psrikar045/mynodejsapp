#!/bin/bash

# LinkedIn Banner Extraction System - Production Deployment Script
# This script automates the deployment process

set -e  # Exit on any error

echo "🚀 LinkedIn Banner Extraction System - Production Deployment"
echo "============================================================"

# Configuration
NODE_VERSION_REQUIRED="18"
APP_NAME="linkedin-scraper"
APP_DIR=$(pwd)
LOG_DIR="$APP_DIR/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as root (not recommended)
check_user() {
    if [[ $EUID -eq 0 ]]; then
        log_warning "Running as root is not recommended for security reasons"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Check Node.js version
check_node_version() {
    log_info "Checking Node.js version..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        log_info "Please install Node.js $NODE_VERSION_REQUIRED or higher"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    
    if [ "$NODE_VERSION" -lt "$NODE_VERSION_REQUIRED" ]; then
        log_error "Node.js version $NODE_VERSION_REQUIRED or higher is required"
        log_error "Current version: $(node -v)"
        exit 1
    fi
    
    log_success "Node.js version: $(node -v)"
}

# Check npm
check_npm() {
    log_info "Checking npm..."
    
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    log_success "npm version: $(npm -v)"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    if [ -f "package-lock.json" ]; then
        npm ci --only=production
    else
        npm install --only=production
    fi
    
    log_success "Dependencies installed"
}

# Install Chrome for Puppeteer
install_chrome() {
    log_info "Installing Chrome for Puppeteer..."
    
    npx puppeteer browsers install chrome
    
    log_success "Chrome installed for Puppeteer"
}

# Create necessary directories
create_directories() {
    log_info "Creating necessary directories..."
    
    mkdir -p "$LOG_DIR"
    
    log_success "Directories created"
}

# Set environment variables
setup_environment() {
    log_info "Setting up environment..."
    
    export NODE_ENV=production
    export ADAPTIVE_MODE=true
    export VERBOSE_LOGGING=false
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        cat > .env << EOF
NODE_ENV=production
ADAPTIVE_MODE=true
VERBOSE_LOGGING=false
PORT=3000
EOF
        log_success "Created .env file"
    else
        log_info ".env file already exists"
    fi
}

# Test the application
test_application() {
    log_info "Testing application startup..."
    
    # Start the application in background for testing
    timeout 30s node index.js &
    APP_PID=$!
    
    # Wait a bit for startup
    sleep 10
    
    # Check if process is still running
    if kill -0 $APP_PID 2>/dev/null; then
        log_success "Application started successfully"
        kill $APP_PID
        wait $APP_PID 2>/dev/null || true
    else
        log_error "Application failed to start"
        exit 1
    fi
}

# Setup PM2 (if available)
setup_pm2() {
    if command -v pm2 &> /dev/null; then
        log_info "Setting up PM2..."
        
        # Stop existing instance if running
        pm2 stop $APP_NAME 2>/dev/null || true
        pm2 delete $APP_NAME 2>/dev/null || true
        
        # Start with PM2
        pm2 start index.js --name $APP_NAME --env production
        
        # Save PM2 configuration
        pm2 save
        
        log_success "PM2 configured and application started"
        log_info "Use 'pm2 status' to check application status"
        log_info "Use 'pm2 logs $APP_NAME' to view logs"
    else
        log_warning "PM2 not found. Install with: npm install -g pm2"
        log_info "Starting application directly..."
        
        # Start application directly
        nohup node index.js > "$LOG_DIR/app.log" 2>&1 &
        echo $! > "$LOG_DIR/app.pid"
        
        log_success "Application started in background"
        log_info "PID saved to $LOG_DIR/app.pid"
        log_info "Logs available at $LOG_DIR/app.log"
    fi
}

# Main deployment function
deploy() {
    echo
    log_info "Starting deployment process..."
    echo
    
    check_user
    check_node_version
    check_npm
    create_directories
    install_dependencies
    install_chrome
    setup_environment
    test_application
    setup_pm2
    
    echo
    log_success "🎉 Deployment completed successfully!"
    echo
    log_info "Application is now running on port 3000"
    log_info "Health check: curl http://localhost:3000/health"
    log_info "Status check: curl http://localhost:3000/status"
    echo
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        deploy
        ;;
    "test")
        log_info "Running deployment test..."
        check_node_version
        check_npm
        test_application
        log_success "Test completed successfully"
        ;;
    "stop")
        log_info "Stopping application..."
        if command -v pm2 &> /dev/null; then
            pm2 stop $APP_NAME
            log_success "Application stopped via PM2"
        else
            if [ -f "$LOG_DIR/app.pid" ]; then
                PID=$(cat "$LOG_DIR/app.pid")
                kill $PID 2>/dev/null || true
                rm -f "$LOG_DIR/app.pid"
                log_success "Application stopped"
            else
                log_warning "No PID file found"
            fi
        fi
        ;;
    "restart")
        log_info "Restarting application..."
        if command -v pm2 &> /dev/null; then
            pm2 restart $APP_NAME
            log_success "Application restarted via PM2"
        else
            $0 stop
            sleep 2
            $0 deploy
        fi
        ;;
    "status")
        log_info "Checking application status..."
        if command -v pm2 &> /dev/null; then
            pm2 status $APP_NAME
        else
            if [ -f "$LOG_DIR/app.pid" ]; then
                PID=$(cat "$LOG_DIR/app.pid")
                if kill -0 $PID 2>/dev/null; then
                    log_success "Application is running (PID: $PID)"
                else
                    log_error "Application is not running"
                fi
            else
                log_error "No PID file found"
            fi
        fi
        ;;
    "logs")
        log_info "Showing application logs..."
        if command -v pm2 &> /dev/null; then
            pm2 logs $APP_NAME
        else
            if [ -f "$LOG_DIR/app.log" ]; then
                tail -f "$LOG_DIR/app.log"
            else
                log_error "No log file found"
            fi
        fi
        ;;
    "help")
        echo "Usage: $0 [command]"
        echo
        echo "Commands:"
        echo "  deploy   - Deploy the application (default)"
        echo "  test     - Test deployment without starting"
        echo "  stop     - Stop the application"
        echo "  restart  - Restart the application"
        echo "  status   - Check application status"
        echo "  logs     - Show application logs"
        echo "  help     - Show this help message"
        echo
        ;;
    *)
        log_error "Unknown command: $1"
        echo "Use '$0 help' for available commands"
        exit 1
        ;;
esac