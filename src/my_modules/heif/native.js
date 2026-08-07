const os = require('os');
const crypto = require('crypto');
const fs = require('fs');
const { execSync } = require('child_process');

// 緩存轉換結果和清理定時器
const heicCache = new Map();
const cacheTimers = new Map();

module.exports = {
    parseHeic: async function(srcPath) {
        return new Promise((resolve) => {
            // CRITICAL: 只在 macOS 上執行
            if (os.platform() !== 'darwin') {
                resolve({ success: false, error: 'Not macOS platform' });
                return;
            }
            
            try {
                const startTime = Date.now();
                console.time('native-heic-total');
                
                // 檢查緩存
                console.time('native-heic-cache-check');
                const fileStats = fs.statSync(srcPath);
                const cacheKey = crypto.createHash('md5')
                    .update(srcPath + fileStats.mtime.getTime() + fileStats.size)
                    .digest('hex');
                
                const cachedPath = `/tmp/eagle_heic_cache_${cacheKey}.jpg`;
                
                console.timeEnd('native-heic-cache-check');
                
                // 如果緩存文件存在且有效，直接返回並延長清理時間
                if (heicCache.has(cacheKey) && fs.existsSync(cachedPath)) {
                    console.timeEnd('native-heic-total');
                    
                    // 重新設置清理定時器（延長 60 秒）
                    if (cacheTimers.has(cacheKey)) {
                        clearTimeout(cacheTimers.get(cacheKey));
                    }
                    
                    const timer = setTimeout(() => {
                        heicCache.delete(cacheKey);
                        cacheTimers.delete(cacheKey);
                        fs.unlink(cachedPath, () => {});
                    }, 60000);
                    
                    cacheTimers.set(cacheKey, timer);
                    
                    resolve({ success: true, tempFilePath: cachedPath, error: null });
                    return;
                }
                
                // 否則進行轉換
                
                const tempPath = cachedPath;
                
                // 使用 sips（macOS 內建，超快！）
                console.time('native-heic-sips');
                try {
                    execSync(`sips -s format jpeg "${srcPath}" --out "${tempPath}"`, { 
                        stdio: 'pipe',
                        timeout: 10000  // 縮短超時時間，sips 應該很快
                    });
                    console.timeEnd('native-heic-sips');
                    
                    // 檢查文件是否成功創建
                    if (fs.existsSync(tempPath) && fs.statSync(tempPath).size > 0) {
                        
                        // 添加到緩存
                        heicCache.set(cacheKey, tempPath);
                        
                        resolve({ success: true, tempFilePath: tempPath, error: null });
                        
                        // 60秒後清理緩存文件
                        const timer = setTimeout(() => {
                            heicCache.delete(cacheKey);
                            cacheTimers.delete(cacheKey);
                            fs.unlink(tempPath, () => {});
                        }, 60000);
                        
                        cacheTimers.set(cacheKey, timer);
                        
                        console.timeEnd('native-heic-total');
                        return;
                    } else {
                        throw new Error('SIPS output file not created or empty');
                    }
                } catch (sipsError) {
                    console.timeEnd('native-heic-sips');
                    console.timeEnd('native-heic-total');
                    resolve({ 
                        success: false, 
                        error: 'SIPS conversion failed: ' + sipsError.message 
                    });
                    return;
                }
                
            } catch (error) {
                console.timeEnd('native-heic-total');
                resolve({ 
                    success: false, 
                    error: 'Script preparation failed: ' + error.message 
                });
            }
        });
    }
};