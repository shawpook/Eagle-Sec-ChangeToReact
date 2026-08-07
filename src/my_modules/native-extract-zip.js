const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');


// Performance optimizations
const PROGRESS_BATCH_SIZE = 10; // Update progress every 10 files
const BUFFER_SIZE = 64 * 1024; // 64KB buffer for stdout processing


/**
 * Native extract-zip replacement that preserves file timestamps
 * Compatible interface with extract-zip package
 * Uses system unzip commands to list and extract files
 */
function nativeExtract(zipPath, opts, callback) {
    if (typeof opts === 'function') {
        callback = opts;
        opts = {};
    }

    if (!opts.dir) {
        return callback(new Error('Target directory is required'));
    }

    if (!path.isAbsolute(opts.dir)) {
        return callback(new Error('Target directory must be absolute'));
    }

    // Ensure target directory exists
    try {
        if (!fs.existsSync(opts.dir)) {
            fs.mkdirSync(opts.dir, { recursive: true });
        }
    } catch (err) {
        return callback(err);
    }

    // Direct extraction based on platform
    const platform = os.platform();

    if (platform === 'darwin') {
        // macOS always uses unzip
        extractWithUnzipOptimized(zipPath, opts, callback);
    } else if (platform === 'win32') {
        // Windows uses PowerShell
        extractWithPowershellOptimized(zipPath, opts, callback);
    } else {
        // Other platforms try unzip
        extractWithUnzipOptimized(zipPath, opts, callback);
    }
}



// Optimized extraction with batched progress updates
function extractWithUnzipOptimized(zipPath, opts, callback) {
    // First get file count quickly
    getFileCountFast(zipPath, (err, fileCount) => {
        const totalFiles = err ? 100 : fileCount; // Fallback estimate

        // Now extract with progress tracking
        const unzip = spawn('unzip', ['-o', zipPath, '-d', opts.dir], {
            stdio: ['pipe', 'pipe', 'pipe'],
            maxBuffer: BUFFER_SIZE * 8
        });

        let processedFiles = 0;
        let pendingProgressUpdates = [];

        // Optimized progress batch updater
        const flushProgressUpdates = () => {
            if (pendingProgressUpdates.length === 0 || !opts.onEntry) return;

            // Send batched updates
            const batchCount = Math.min(pendingProgressUpdates.length, PROGRESS_BATCH_SIZE);
            for (let i = 0; i < batchCount; i++) {
                const entry = pendingProgressUpdates[i];
                opts.onEntry(entry, { entryCount: totalFiles });
            }

            // Remove processed updates
            pendingProgressUpdates.splice(0, batchCount);

            // Schedule next batch if more pending
            if (pendingProgressUpdates.length > 0) {
                setImmediate(flushProgressUpdates);
            }
        };

        // Pre-compiled regex for better performance
        const extractingRegex = /^\s*extracting:\s*(.+)$/;

        unzip.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;

                if (trimmedLine.startsWith('extracting:')) {
                    processedFiles++;
                    const filenameMatch = extractingRegex.exec(trimmedLine);
                    const filename = filenameMatch ? filenameMatch[1] : trimmedLine.substring(11);

                    // Add to batch instead of immediate callback
                    pendingProgressUpdates.push({
                        fileName: filename,
                        uncompressedSize: 0,
                        getLastModDate: () => new Date()
                    });

                    // Trigger batch update when batch size reached
                    if (pendingProgressUpdates.length >= PROGRESS_BATCH_SIZE) {
                        flushProgressUpdates();
                    }
                }
            }
        });

        unzip.on('close', (code) => {
            // Flush any remaining progress updates
            flushProgressUpdates();

            if (code === 0) {
                callback(null);
            } else {
                callback(new Error(`unzip exited with code ${code}`));
            }
        });

        unzip.on('error', (err) => {
            callback(err);
        });
    });
}

// Fast file count helper function
function getFileCountFast(zipPath, callback) {
    const unzip = spawn('unzip', ['-l', zipPath], {
        stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    unzip.stdout.on('data', (data) => {
        output += data.toString();
    });

    unzip.on('close', (code) => {
        if (code === 0) {
            // Extract file count from the last line like "181 files"
            const lines = output.trim().split('\n');
            const lastLine = lines[lines.length - 1];
            const match = lastLine.match(/(\d+)\s+files?$/);
            if (match) {
                callback(null, parseInt(match[1]));
            } else {
                callback(new Error('Could not parse file count'));
            }
        } else {
            callback(new Error(`unzip -l failed with code ${code}`));
        }
    });

    unzip.on('error', callback);
}

// Optimized PowerShell extraction with progress tracking
function extractWithPowershellOptimized(zipPath, opts, callback) {
    // Basic security validation
    if (zipPath.includes('..') || opts.dir.includes('..')) {
        return callback(new Error('Path traversal detected'));
    }

    // // Check for dangerous characters
    // const dangerousPattern = /[;&|`$<>]/;
    // if (dangerousPattern.test(zipPath) || dangerousPattern.test(opts.dir)) {
    //     return callback(new Error('Dangerous characters in path'));
    // }

    // Use optimized PowerShell script for better performance and progress tracking
    // Keep Windows paths as-is for PowerShell, only escape single quotes
    const escapedZipPath = zipPath.replace(/'/g, "''");
    const escapedTargetDir = opts.dir.replace(/'/g, "''");
    
    const psScript = `
        try {
            # Check PowerShell and .NET version compatibility
            if ($PSVersionTable.PSVersion.Major -lt 3) {
                Write-Error "PowerShell 3.0 or higher required"
                exit 1
            }
            
            # Load required assemblies with error handling
            try {
                Add-Type -AssemblyName System.IO.Compression.FileSystem
            }
            catch {
                Write-Error "Failed to load System.IO.Compression.FileSystem assembly: $($_.Exception.Message)"
                exit 1
            }
            
            # Verify file exists and is accessible (use -LiteralPath to handle special characters)
            if (!(Test-Path -LiteralPath '${escapedZipPath}')) {
                Write-Error "ZIP file not found or not accessible: ${escapedZipPath}"
                exit 1
            }
            
            $zip = [System.IO.Compression.ZipFile]::OpenRead('${escapedZipPath}')
            $fileEntries = $zip.Entries | Where-Object { $_.Name -ne '' }
            $totalFiles = $fileEntries.Count
            $processed = 0

            foreach ($entry in $zip.Entries) {
                if ($entry.Name -ne '') {
                    $targetPath = Join-Path '${escapedTargetDir}' $entry.FullName
                    $targetDir = Split-Path $targetPath -Parent

                    if (!(Test-Path $targetDir)) {
                        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
                    }

                    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $targetPath, $true)
                    $processed++

                    # Output progress for every file (like macOS unzip behavior)
                    Write-Host "PROGRESS:$processed\`:$totalFiles\`:$($entry.Name)"
                }
            }
            $zip.Dispose()
        }
        catch {
            Write-Error "PowerShell extraction failed: $($_.Exception.Message)"
            Write-Error "Full error details: $_"
            exit 1
        }
    `;

    // Use Base64 encoded command to handle Unicode paths properly
    const fullCommand = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${psScript}`;
    const encodedCommand = Buffer.from(fullCommand, 'utf16le').toString('base64');
    
    const ps = spawn('powershell', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-EncodedCommand', encodedCommand
    ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: BUFFER_SIZE * 4,
        env: { ...process.env }
    });

    let totalFiles = 0;
    let processedFiles = 0;

    let stderr = '';

    let buffer = '';
    
    ps.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('PROGRESS:')) {
                // Parse single line format: PROGRESS:processed:total:filename
                const parts = trimmedLine.split(':');
                if (parts.length >= 4) {
                    const processed = parseInt(parts[1]);
                    const total = parseInt(parts[2]);
                    const filename = parts.slice(3).join(':'); // Handle filenames with colons
                    
                    processedFiles = processed;
                    totalFiles = total;

                    if (opts.onEntry && filename) {
                        opts.onEntry({
                            fileName: filename,
                            uncompressedSize: 0,
                            getLastModDate: () => new Date()
                        }, { entryCount: totalFiles });
                    }
                }
            }
        }
    });

    ps.stderr.on('data', (data) => {
        stderr += data.toString();
    });

    ps.on('close', (code) => {
        if (code === 0) {
            callback(null);
        } else {
            const errorMsg = stderr ? 
                `PowerShell extraction failed with code ${code}: ${stderr}` : 
                `PowerShell extraction exited with code ${code}`;
            callback(new Error(errorMsg));
        }
    });

    ps.on('error', (err) => {
        callback(err);
    });
}

// Check if native extraction is available on this system
function checkAvailability(callback) {
    const platform = os.platform();
    
    if (platform === 'darwin') {
        // macOS: check if unzip command is available
        const unzip = spawn('unzip', ['-h'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        unzip.on('close', (code) => {
            callback(null, code === 0);
        });
        
        unzip.on('error', () => {
            callback(null, false);
        });
    } else if (platform === 'win32') {
        // Windows: check if PowerShell and required assemblies are available
        const psTestScript = `
            try {
                # Check PowerShell version
                if ($PSVersionTable.PSVersion.Major -lt 3) {
                    exit 1
                }
                
                # Try to load required assemblies
                Add-Type -AssemblyName System.IO.Compression.FileSystem
                
                # Test basic functionality
                $testMethod = [System.IO.Compression.ZipFile].GetMethod('OpenRead')
                if ($testMethod -eq $null) {
                    exit 1
                }
                
                exit 0
            }
            catch {
                exit 1
            }
        `;
        
        const ps = spawn('powershell', [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-Command',
            psTestScript
        ], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        ps.on('close', (code) => {
            callback(null, code === 0);
        });
        
        ps.on('error', () => {
            callback(null, false);
        });
    } else {
        // Other platforms: try unzip command
        const unzip = spawn('unzip', ['-h'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        unzip.on('close', (code) => {
            callback(null, code === 0);
        });
        
        unzip.on('error', () => {
            callback(null, false);
        });
    }
}

// Synchronous availability check (cached result)
let availabilityCache = null;
let availabilityChecked = false;

function available() {
    if (!availabilityChecked) {
        // For synchronous call, do a quick platform check
        const platform = os.platform();
        
        if (platform === 'darwin' || platform === 'win32') {
            // Assume available for supported platforms
            // Real check will be done asynchronously
            availabilityCache = true;
        } else {
            availabilityCache = false;
        }
        
        // Perform async check to update cache
        checkAvailability((err, isAvailable) => {
            availabilityCache = isAvailable;
            availabilityChecked = true;
        });
    }
    
    return availabilityCache;
}

// Async availability check
function checkAvailable(callback) {
    if (availabilityChecked) {
        return callback(null, availabilityCache);
    }
    
    checkAvailability((err, isAvailable) => {
        availabilityCache = isAvailable;
        availabilityChecked = true;
        callback(err, isAvailable);
    });
}

module.exports = nativeExtract;
module.exports.available = available;
module.exports.checkAvailable = checkAvailable;

