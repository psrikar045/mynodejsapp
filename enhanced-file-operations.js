/**
 * Enhanced File Operations with Advanced Error Handling
 * Provides robust file operations with retry mechanisms, detailed error reporting, and recovery strategies
 */

const fs = require('fs').promises;
const path = require('path');
const { createWriteStream, createReadStream } = require('fs');
const { performanceMonitor } = require('./performance-monitor');

class EnhancedFileOperations {
    constructor() {
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 10000,
            backoffMultiplier: 2
        };
        
        this.operationTimeouts = {
            read: 30000,    // 30 seconds
            write: 45000,   // 45 seconds
            copy: 60000,    // 60 seconds
            move: 30000,    // 30 seconds
            delete: 15000   // 15 seconds
        };
    }

    /**
     * Enhanced file read with comprehensive error handling
     */
    async readFile(filePath, options = {}) {
        const timer = performanceMonitor.startTimer('file_read');
        const {
            encoding = 'utf8',
            timeout = this.operationTimeouts.read,
            validateContent = false,
            fallbackContent = null
        } = options;

        let attempt = 0;
        let lastError = null;

        while (attempt <= this.retryConfig.maxRetries) {
            try {
                // Validate path security
                this.validatePath(filePath);
                
                // Check if file exists and is readable
                await this.checkFileAccess(filePath, fs.constants.R_OK);
                
                // Set up timeout
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`File read timeout after ${timeout}ms`)), timeout);
                });

                // Read file with timeout
                const readPromise = fs.readFile(filePath, { encoding });
                const content = await Promise.race([readPromise, timeoutPromise]);

                // Validate content if required
                if (validateContent && typeof validateContent === 'function') {
                    const validationResult = validateContent(content);
                    if (!validationResult.valid) {
                        throw new Error(`Content validation failed: ${validationResult.error}`);
                    }
                }

                performanceMonitor.endTimer(timer, true, { 
                    filePath, 
                    fileSize: content.length,
                    attempt: attempt + 1 
                });

                console.log(`📄 [FileOps] Read successful: ${path.basename(filePath)} (${content.length} chars)`);
                return content;

            } catch (error) {
                lastError = error;
                attempt++;

                const context = {
                    filePath,
                    attempt,
                    operation: 'read',
                    error: error.message
                };

                if (attempt > this.retryConfig.maxRetries) {
                    performanceMonitor.recordError('file_operation', error, context);
                    performanceMonitor.endTimer(timer, false, context);

                    // Try fallback content if provided
                    if (fallbackContent !== null) {
                        console.warn(`📄 [FileOps] Using fallback content for: ${path.basename(filePath)}`);
                        return fallbackContent;
                    }

                    throw new FileOperationError('READ_FAILED', filePath, error, attempt - 1);
                }

                console.warn(`📄 [FileOps] Read failed (attempt ${attempt}): ${error.message}`);
                await this.delay(this.calculateDelay(attempt));
            }
        }
    }

    /**
     * Enhanced file write with atomic operations and backup
     */
    async writeFile(filePath, content, options = {}) {
        const timer = performanceMonitor.startTimer('file_write');
        const {
            encoding = 'utf8',
            timeout = this.operationTimeouts.write,
            atomic = true,
            backup = false,
            mode = 0o666
        } = options;

        let attempt = 0;
        let lastError = null;
        let backupPath = null;

        while (attempt <= this.retryConfig.maxRetries) {
            try {
                // Validate path security
                this.validatePath(filePath);
                
                // Ensure directory exists
                await this.ensureDirectory(path.dirname(filePath));

                // Create backup if requested and file exists
                if (backup && await this.fileExists(filePath)) {
                    backupPath = await this.createBackup(filePath);
                }

                // Write with timeout
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`File write timeout after ${timeout}ms`)), timeout);
                });

                let writePromise;
                
                if (atomic) {
                    // Atomic write using temporary file
                    const tempPath = `${filePath}.tmp.${Date.now()}`;
                    writePromise = this.performAtomicWrite(tempPath, filePath, content, { encoding, mode });
                } else {
                    // Direct write
                    writePromise = fs.writeFile(filePath, content, { encoding, mode });
                }

                await Promise.race([writePromise, timeoutPromise]);

                // Verify write
                if (options.verify !== false) {
                    await this.verifyWrite(filePath, content, encoding);
                }

                performanceMonitor.endTimer(timer, true, { 
                    filePath, 
                    contentSize: typeof content === 'string' ? content.length : content.byteLength,
                    attempt: attempt + 1,
                    atomic,
                    backup: !!backupPath
                });

                console.log(`💾 [FileOps] Write successful: ${path.basename(filePath)} (${typeof content === 'string' ? content.length : content.byteLength} bytes)`);
                return { success: true, backupPath };

            } catch (error) {
                lastError = error;
                attempt++;

                // Restore from backup if atomic write failed and backup exists
                if (atomic && backupPath && await this.fileExists(backupPath)) {
                    try {
                        await fs.copyFile(backupPath, filePath);
                        console.log(`🔄 [FileOps] Restored from backup: ${path.basename(filePath)}`);
                    } catch (restoreError) {
                        console.error(`❌ [FileOps] Backup restore failed: ${restoreError.message}`);
                    }
                }

                const context = {
                    filePath,
                    attempt,
                    operation: 'write',
                    contentSize: typeof content === 'string' ? content.length : content.byteLength,
                    error: error.message
                };

                if (attempt > this.retryConfig.maxRetries) {
                    performanceMonitor.recordError('file_operation', error, context);
                    performanceMonitor.endTimer(timer, false, context);
                    throw new FileOperationError('WRITE_FAILED', filePath, error, attempt - 1);
                }

                console.warn(`💾 [FileOps] Write failed (attempt ${attempt}): ${error.message}`);
                await this.delay(this.calculateDelay(attempt));
            }
        }
    }

    /**
     * Enhanced file copy with progress tracking
     */
    async copyFile(sourcePath, destPath, options = {}) {
        const timer = performanceMonitor.startTimer('file_copy');
        const {
            timeout = this.operationTimeouts.copy,
            overwrite = true,
            preserveTimestamps = true
        } = options;

        let attempt = 0;
        let lastError = null;

        while (attempt <= this.retryConfig.maxRetries) {
            try {
                // Validate paths
                this.validatePath(sourcePath);
                this.validatePath(destPath);

                // Check source file accessibility
                await this.checkFileAccess(sourcePath, fs.constants.R_OK);

                // Check destination
                if (!overwrite && await this.fileExists(destPath)) {
                    throw new Error('Destination file exists and overwrite is false');
                }

                // Ensure destination directory exists
                await this.ensureDirectory(path.dirname(destPath));

                // Get source file stats
                const sourceStats = await fs.stat(sourcePath);

                // Set up timeout
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`File copy timeout after ${timeout}ms`)), timeout);
                });

                // Copy file
                const copyPromise = fs.copyFile(sourcePath, destPath);
                await Promise.race([copyPromise, timeoutPromise]);

                // Preserve timestamps if requested
                if (preserveTimestamps) {
                    await fs.utimes(destPath, sourceStats.atime, sourceStats.mtime);
                }

                // Verify copy
                const destStats = await fs.stat(destPath);
                if (destStats.size !== sourceStats.size) {
                    throw new Error('Copy verification failed: size mismatch');
                }

                performanceMonitor.endTimer(timer, true, { 
                    sourcePath, 
                    destPath, 
                    fileSize: sourceStats.size,
                    attempt: attempt + 1
                });

                console.log(`📋 [FileOps] Copy successful: ${path.basename(sourcePath)} -> ${path.basename(destPath)} (${sourceStats.size} bytes)`);
                return { success: true, size: sourceStats.size };

            } catch (error) {
                lastError = error;
                attempt++;

                const context = {
                    sourcePath,
                    destPath,
                    attempt,
                    operation: 'copy',
                    error: error.message
                };

                if (attempt > this.retryConfig.maxRetries) {
                    performanceMonitor.recordError('file_operation', error, context);
                    performanceMonitor.endTimer(timer, false, context);
                    throw new FileOperationError('COPY_FAILED', `${sourcePath} -> ${destPath}`, error, attempt - 1);
                }

                console.warn(`📋 [FileOps] Copy failed (attempt ${attempt}): ${error.message}`);
                await this.delay(this.calculateDelay(attempt));
            }
        }
    }

    /**
     * Enhanced file move with rollback capability
     */
    async moveFile(sourcePath, destPath, options = {}) {
        const timer = performanceMonitor.startTimer('file_move');
        const { 
            timeout = this.operationTimeouts.move,
            overwrite = false 
        } = options;

        try {
            // First copy the file
            await this.copyFile(sourcePath, destPath, { timeout, overwrite });
            
            // Then delete the original
            await this.deleteFile(sourcePath, { timeout: timeout / 2 });

            performanceMonitor.endTimer(timer, true, { sourcePath, destPath });
            console.log(`🚚 [FileOps] Move successful: ${path.basename(sourcePath)} -> ${path.basename(destPath)}`);
            
            return { success: true };

        } catch (error) {
            performanceMonitor.recordError('file_operation', error, { sourcePath, destPath, operation: 'move' });
            performanceMonitor.endTimer(timer, false, { sourcePath, destPath, error: error.message });
            
            // If copy succeeded but delete failed, try to remove the destination
            if (await this.fileExists(destPath)) {
                try {
                    await this.deleteFile(destPath);
                    console.log(`🧹 [FileOps] Rollback successful: removed ${path.basename(destPath)}`);
                } catch (rollbackError) {
                    console.error(`❌ [FileOps] Rollback failed: ${rollbackError.message}`);
                }
            }

            throw new FileOperationError('MOVE_FAILED', `${sourcePath} -> ${destPath}`, error);
        }
    }

    /**
     * Enhanced file deletion with secure removal
     */
    async deleteFile(filePath, options = {}) {
        const timer = performanceMonitor.startTimer('file_delete');
        const { 
            timeout = this.operationTimeouts.delete,
            secure = false 
        } = options;

        let attempt = 0;
        let lastError = null;

        while (attempt <= this.retryConfig.maxRetries) {
            try {
                // Validate path
                this.validatePath(filePath);

                // Check if file exists
                if (!await this.fileExists(filePath)) {
                    console.log(`🗑️ [FileOps] File already deleted: ${path.basename(filePath)}`);
                    performanceMonitor.endTimer(timer, true, { filePath, alreadyDeleted: true });
                    return { success: true, alreadyDeleted: true };
                }

                // Secure deletion (overwrite with random data first)
                if (secure) {
                    await this.secureDelete(filePath);
                }

                // Set up timeout
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`File delete timeout after ${timeout}ms`)), timeout);
                });

                // Delete file
                const deletePromise = fs.unlink(filePath);
                await Promise.race([deletePromise, timeoutPromise]);

                performanceMonitor.endTimer(timer, true, { filePath, attempt: attempt + 1, secure });
                console.log(`🗑️ [FileOps] Delete successful: ${path.basename(filePath)}`);
                
                return { success: true };

            } catch (error) {
                lastError = error;
                attempt++;

                const context = {
                    filePath,
                    attempt,
                    operation: 'delete',
                    secure,
                    error: error.message
                };

                if (attempt > this.retryConfig.maxRetries) {
                    performanceMonitor.recordError('file_operation', error, context);
                    performanceMonitor.endTimer(timer, false, context);
                    throw new FileOperationError('DELETE_FAILED', filePath, error, attempt - 1);
                }

                console.warn(`🗑️ [FileOps] Delete failed (attempt ${attempt}): ${error.message}`);
                await this.delay(this.calculateDelay(attempt));
            }
        }
    }

    /**
     * Stream-based file operations for large files
     */
    async streamCopy(sourcePath, destPath, options = {}) {
        const timer = performanceMonitor.startTimer('file_stream_copy');
        const { 
            bufferSize = 64 * 1024, // 64KB chunks
            timeout = 5 * 60 * 1000 // 5 minutes
        } = options;

        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                reject(new Error(`Stream copy timeout after ${timeout}ms`));
            }, timeout);

            const sourceStream = createReadStream(sourcePath, { highWaterMark: bufferSize });
            const destStream = createWriteStream(destPath);

            let bytesTransferred = 0;

            sourceStream.on('data', (chunk) => {
                bytesTransferred += chunk.length;
            });

            sourceStream.on('error', (error) => {
                clearTimeout(timeoutHandle);
                performanceMonitor.recordError('file_operation', error, { operation: 'stream_copy', sourcePath, destPath });
                performanceMonitor.endTimer(timer, false, { sourcePath, destPath, bytesTransferred });
                reject(new FileOperationError('STREAM_COPY_FAILED', sourcePath, error));
            });

            destStream.on('error', (error) => {
                clearTimeout(timeoutHandle);
                performanceMonitor.recordError('file_operation', error, { operation: 'stream_copy', sourcePath, destPath });
                performanceMonitor.endTimer(timer, false, { sourcePath, destPath, bytesTransferred });
                reject(new FileOperationError('STREAM_COPY_FAILED', destPath, error));
            });

            destStream.on('finish', () => {
                clearTimeout(timeoutHandle);
                performanceMonitor.endTimer(timer, true, { sourcePath, destPath, bytesTransferred });
                console.log(`📊 [FileOps] Stream copy successful: ${path.basename(sourcePath)} (${bytesTransferred} bytes)`);
                resolve({ success: true, bytesTransferred });
            });

            sourceStream.pipe(destStream);
        });
    }

    // Helper methods

    async performAtomicWrite(tempPath, finalPath, content, options) {
        await fs.writeFile(tempPath, content, options);
        await fs.rename(tempPath, finalPath);
    }

    async verifyWrite(filePath, originalContent, encoding) {
        const writtenContent = await fs.readFile(filePath, { encoding });
        if (writtenContent !== originalContent) {
            throw new Error('Write verification failed: content mismatch');
        }
    }

    async createBackup(filePath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${filePath}.backup-${timestamp}`;
        await fs.copyFile(filePath, backupPath);
        return backupPath;
    }

    async secureDelete(filePath) {
        const stats = await fs.stat(filePath);
        const randomData = Buffer.alloc(stats.size);
        
        // Fill with random data
        for (let i = 0; i < stats.size; i++) {
            randomData[i] = Math.floor(Math.random() * 256);
        }
        
        // Overwrite file with random data
        await fs.writeFile(filePath, randomData);
        await fs.fsync(await fs.open(filePath, 'r+')); // Force write to disk
    }

    validatePath(filePath) {
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('Invalid file path');
        }

        // Security check: prevent path traversal
        const normalizedPath = path.normalize(filePath);
        if (normalizedPath.includes('..')) {
            throw new Error('Path traversal detected');
        }
    }

    async checkFileAccess(filePath, mode) {
        try {
            await fs.access(filePath, mode);
        } catch (error) {
            throw new Error(`File access check failed: ${error.message}`);
        }
    }

    async ensureDirectory(dirPath) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    calculateDelay(attempt) {
        const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
            this.retryConfig.maxDelay
        );
        // Add jitter
        return delay + (Math.random() * 1000);
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Custom error class for file operations
 */
class FileOperationError extends Error {
    constructor(code, filePath, originalError, attempts = 0) {
        super(`${code}: ${originalError.message} (file: ${filePath}, attempts: ${attempts})`);
        this.name = 'FileOperationError';
        this.code = code;
        this.filePath = filePath;
        this.originalError = originalError;
        this.attempts = attempts;
    }
}

// Singleton instance
const enhancedFileOps = new EnhancedFileOperations();

module.exports = {
    EnhancedFileOperations,
    FileOperationError,
    enhancedFileOps
};