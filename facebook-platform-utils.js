/**
 * Facebook Platform Utilities
 * Cross-platform compatibility helpers
 */

const os = require('os');
const fs = require('fs');

class FacebookPlatformUtils {
    static isProduction() {
        return process.env.NODE_ENV === 'production' || process.env.RENDER;
    }

    static isLinux() {
        return os.platform() === 'linux';
    }

    static isWindows() {
        return os.platform() === 'win32';
    }

    static isMac() {
        return os.platform() === 'darwin';
    }

    static getBrowserExecutablePath() {
        const platform = os.platform();
        const isProduction = this.isProduction();

        if (isProduction || this.isLinux()) {
            // Production/Linux paths
            const linuxPaths = [
                '/usr/bin/google-chrome',
                '/usr/bin/google-chrome-stable',
                '/usr/bin/chromium-browser',
                '/usr/bin/chromium',
                '/snap/bin/chromium'
            ];

            for (const browserPath of linuxPaths) {
                if (fs.existsSync(browserPath)) {
                    return browserPath;
                }
            }
        } else if (this.isWindows()) {
            // Windows development paths
            const windowsPaths = [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
            ];

            for (const browserPath of windowsPaths) {
                if (fs.existsSync(browserPath)) {
                    return browserPath;
                }
            }
        } else if (this.isMac()) {
            // Mac development paths
            const macPaths = [
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            ];

            for (const browserPath of macPaths) {
                if (fs.existsSync(browserPath)) {
                    return browserPath;
                }
            }
        }

        // Return null to use Puppeteer's bundled Chromium
        return null;
    }

    static getOptimalViewport() {
        const isProduction = this.isProduction();
        
        if (isProduction) {
            // Smaller viewport for production to save memory
            return {
                width: 1024,
                height: 768,
                deviceScaleFactor: 1
            };
        } else {
            // Larger viewport for development
            return {
                width: 1366,
                height: 768,
                deviceScaleFactor: 1
            };
        }
    }

    static getMemoryOptimizedArgs() {
        const isProduction = this.isProduction();
        
        if (isProduction) {
            return [
                '--memory-pressure-off',
                '--max_old_space_size=512',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding'
            ];
        }
        
        return [];
    }
}

module.exports = { FacebookPlatformUtils };