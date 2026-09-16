/**
 * b1-9bl：/vendor/eagle-smooth-zoom.js 剥壳归位——BitmapViewer 全类逐字搬迁
 * （vendor 29-826；数学/DOM/Worker 行为锁定，见 PROGRESS「S4-bl 考据定案」）。
 * 过渡期保留面：$ 为 window.$（jQuery DOM 微操作，P4 统一退役）；$bodyScope 走
 * window（bundleGlobals 供给）；bitmapWorker 协议/消息不变，仅路径由文档相对的
 * js/workers/bitmapWorker.js 改为站点根绝对的 /src/app/js/workers/bitmapWorker.js（M0）。
 * vendor 脚本随本批自 index.html 摘除；压缩版（js/vendors/jquery.smoothZoom.min.js）
 * 留 bl-B 预览窗切换时一并退役。
 */
import { getRawUrl } from './itemDomain';
import { q, getAttr, setAttrEl, setCssEl, widthOf, heightOf } from '../utils/domQuery';
import {
	NATIVE_HEIC_CHANNEL,
	type BitmapWorkerRequest,
	type BitmapWorkerResponse,
	type NativeHeicInitMessage,
	type NativeHeicParseRequestMessage,
	type NativeHeicParseResponseMessage,
} from './workers/protocol';
/* bundle/主窗全局：typed ambient 声明，只补类型不改运行期。 */
declare const require: any;
declare const FileUrlHelper: any;
declare const preferences: any;

export class BitmapViewer {
	/* bundle 逐字搬迁的类：属性面宽且原码不声明，此处只补类型（不改运行期）。 */
	url: any;
	preloadData: any;
	#zoomer: any;
	#createBitmapWorker: any;
	#preloadBitmapWorker: any;
	#container: any;
	#dpr = 1;
	#canvas: any;
	#bitmapTileCount: any;
	#bitmapTiles: any[] = [];
    #thumbBitmap: any;
    #thumbBitmapFromWorker = false;  // ✅ 新增：追蹤 bitmap 是否來自 Worker
    #nativeHeicParser: any = null;  // ✅ 新增：原生 HEIC 解析器
	#viewportBitmap: any = null;  // 新增：viewport 優化用的 bitmap
	#totalTiles = 0;         // 新增：總磁磚數
	#imageWidth = 0;         // 新增：原始圖片寬度
	#imageHeight = 0;        // 新增：原始圖片高度
	#lastViewportWidth = 0;  // 新增：上次 viewport 寬度（用於動態更新）
	#requestVersion = 0;      // ✅ 新增：請求版本控制
	#viewport: any;
    #renderTimeout: any;
    #renderTimeoutDuration: any;
    #thumbRatio: any;
	#height: any
	#width: any
	#thumbnailMode = false
	#tileSize = 500

	constructor (parentElement: any, zoomer: any) {
		this.#zoomer = zoomer;
        this.#container = parentElement;
        this.#canvas = null;
        this.#thumbBitmap = null;
        this.#viewport = {};
        this.url = null;
		this.#bitmapTiles = [];
		this.#bitmapTileCount = 0;
		this.preloadData = {};
		
		// ✅ 初始化原生 HEIC 解析器
		this.#initNativeHeicParser();
	}
	
	// ✅ 初始化原生 HEIC 解析器
	#initNativeHeicParser() {
		try {
			if (typeof require !== 'undefined') {
				const appRoot = require('app-root-path');
				this.#nativeHeicParser = require(appRoot + '/my_modules/heif/native');
				console.log('[SmoothZoom] Native HEIC parser loaded successfully');
			}
		} catch (error) {
			console.warn('[SmoothZoom] Failed to load native HEIC parser:', error);
		}
	}
	
	// ✅ 設置 Worker 的原生 HEIC 支持
	#setupWorkerNativeHeic(worker: any) {
		if (!this.#nativeHeicParser) return;
		
		// 設置消息處理（P2：主线程 ↔ worker 的反向请求，通道名见 core/workers/protocol.ts）
		worker.addEventListener('message', (e: MessageEvent<NativeHeicParseRequestMessage>) => {
			if (e.data.type === NATIVE_HEIC_CHANNEL.REQUEST) {
				const { filePath, requestId } = e.data.data;

				this.#nativeHeicParser.parseHeic(filePath).then((result: any) => {
					const response: NativeHeicParseResponseMessage = {
						type: NATIVE_HEIC_CHANNEL.RESPONSE,
						data: {
							requestId,
							success: result.success,
							tempFilePath: result.tempFilePath,
							error: result.error
						}
					};
					worker.postMessage(response);
				}).catch((error: any) => {
					const response: NativeHeicParseResponseMessage = {
						type: NATIVE_HEIC_CHANNEL.RESPONSE,
						data: {
							requestId,
							success: false,
							error: error.message
						}
					};
					worker.postMessage(response);
				});
			}
		});

		// 通知 Worker 原生解析器可用
		const initMessage: NativeHeicInitMessage = {
			type: NATIVE_HEIC_CHANNEL.INIT,
			available: true
		};
		worker.postMessage(initMessage);
	}

    clear() {
        clearTimeout(this.#renderTimeout);
        
        // ✅ 修復：終止所有運行中的 Workers
        if (this.#createBitmapWorker) {
            this.#createBitmapWorker.terminate();
            this.#createBitmapWorker = null;
        }
        if (this.#preloadBitmapWorker) {
            this.#preloadBitmapWorker.terminate();
            this.#preloadBitmapWorker = null;
        }
        
        // ✅ 修復：清理 preloadData
        this.clearPreloadData();
        
        if (this.#canvas) {
            const ctx: any = this.#canvas.getContext('2d');
            ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
			this.url = null;
            
            // ✅ 修復：正確釋放 ImageBitmap 資源
            if (this.#thumbBitmap && !this.#thumbBitmapFromWorker) {
                try {
                    this.#thumbBitmap.close();
                } catch(e) {
                    // 忽略已經被 close 的 bitmap
                }
            }
            this.#thumbBitmap = null;
            this.#thumbBitmapFromWorker = false;
            
            // ✅ 修復：釋放 viewport bitmap
            if (this.#viewportBitmap) {
                try {
                    this.#viewportBitmap.close();
                } catch(e) {
                    // 忽略已經被 close 的 bitmap
                }
            }
			this.#viewportBitmap = null;  // 新增：清除 viewport bitmap
            
            // ✅ 修復：釋放所有 tile bitmaps
            if (this.#bitmapTiles && this.#bitmapTiles.length > 0) {
                this.#bitmapTiles.forEach(tile => {
                    if (tile?.tile) {
                        try {
                            tile.tile.close();
                        } catch(e) {
                            // 忽略已經被 close 的 bitmap
                        }
                    }
                });
            }
            
			this.#totalTiles = 0;         // 新增：重置總磁磚數
			this.#imageWidth = 0;         // 新增：重置圖片寬度
			this.#imageHeight = 0;        // 新增：重置圖片高度
			this.#bitmapTiles = [];
			this.#bitmapTileCount = 0;
			this.#viewport = {};
			clearTimeout(this.#renderTimeout);
        }
    }

	isSupportFormat(ext: any) {
		return ['jpg', 'jpeg', 'png', 'webp', 'avif', 'insp', 'jfif', 'jpe', 'jxl', 'bmp', 'svg', 'tif', 'tiff', 'heif', 'heic', 'hif'].includes(ext.toLowerCase());
	}

	clearPreloadData() {
		try {
			Object.keys(this.preloadData).forEach((key) => {
				const preloadData = this.preloadData[key];
				if (preloadData?.tiles) {
					preloadData.tiles.forEach((tile: any) => {
						try {
							tile?.tile?.close();
						} catch(e) {
							// ✅ 忽略已經被 close 或 transfer 的 bitmap
						}
					});
				}
				if (preloadData?.bitmap) {
					try {
						preloadData?.bitmap?.close();
					} catch(e) {
						// ✅ 忽略已經被 close 或 transfer 的 bitmap
					}
				}
			});
		} catch (error) {
			console.error('Error clearing preload data:', error);
		}
		finally {
			this.preloadData = {};
		}
	}

	preload(item: any) {
		if (!this.isSupportFormat(item.ext)) return;
		const url = getRawUrl(item);

		if (this.#preloadBitmapWorker) {
			this.#preloadBitmapWorker.terminate();
			this.#preloadBitmapWorker = null;
		}

		// M0：站点根绝对路径。原写法 'js/workers/bitmapWorker.js' 相对文档 URL 解析，
		// 采集窗（/src/app/collect-window/index.html）下会落到不存在的
		// /src/app/collect-window/js/workers/，worker 静默加载失败。
		// 逐字面量保留（不抽公共常量）：产物闭包门禁只能解析 inline 字面量对应的 Worker URL，
		// 抽成 const 后 minifier 会提升为变量，门禁将看不到这条引用。
		this.#preloadBitmapWorker = new Worker('/src/app/js/workers/bitmapWorker.js');
		this.#setupWorkerNativeHeic(this.#preloadBitmapWorker);  // ✅ 設置原生 HEIC 支持
		const preloadRequest: BitmapWorkerRequest = { url, item: { ...item, url: url }, tileSize: this.#tileSize };
		this.#preloadBitmapWorker.postMessage(preloadRequest);

		this.#preloadBitmapWorker.onmessage = (e: MessageEvent<BitmapWorkerResponse>) => {
			if (e.data.error) {
				this.#preloadBitmapWorker.terminate();
				delete this.preloadData[url];
			} else {
				if (!this.preloadData[url]) return;
				if (e.data.usingImgTag || e.data.bitmap) {
					this.preloadData[url].usingImgTag = e.data.usingImgTag;
					this.preloadData[url].bitmap = e.data.bitmap;
				}
				else if (e.data.tiles) {
					this.preloadData[url].tiles = e.data.tiles;
					this.#preloadBitmapWorker.terminate();
					// ✅ 修復：改進清理邏輯，只保留當前 URL
					const keysToDelete = [];
					for (const key in this.preloadData) {
						// 只保留當前預載的 URL，清理其他所有資源
						if (key !== url) {
							keysToDelete.push(key);
						}
					}
					
					// 批量清理資源
					keysToDelete.forEach(key => {
						const preloadData = this.preloadData[key];
						if (preloadData?.tiles) {
							preloadData.tiles.forEach((tile: any) => {
								try {
									tile?.tile?.close();
								} catch(e) {
									// 忽略已經被 close 的 bitmap
								}
							});
						}
						if (preloadData?.bitmap) {
							try {
								preloadData.bitmap.close();
							} catch(e) {
								// 忽略已經被 close 的 bitmap
							}
						}
						delete this.preloadData[key];
					});
					// console.log(this.preloadData)
				}
			}
		};

		this.#preloadBitmapWorker.onerror = () => {
			this.#preloadBitmapWorker.terminate();
		};

		this.preloadData[url] = {
			url: url
		};
	}

	hideThumbnail() {
		const transparentImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAQSURBVHgBAQUA+v8AAAAAAAAFAAFkeJU4AAAAAElFTkSuQmCC";
		if (getAttr(q("#detail-image"), "src") !== transparentImage) {
			setAttrEl(q("#detail-image"), "src", transparentImage);
		}
	}

	async #loadURLFromWorker(url: any, item: any, onBitmapCallback: any, onTilesCallback: any, requestVersion: any) {
		return new Promise<void>((resolve, reject) => {

			// if preloadData has current url, use it
			const preloadData = this.preloadData[url];
			if (preloadData && preloadData.usingImgTag !== undefined && preloadData.bitmap && preloadData.tiles) {
				// ✅ 檢查版本是否仍然有效
				if (requestVersion !== this.#requestVersion) {
					reject(new Error('Request version outdated'));
					return;
				}
				onBitmapCallback(preloadData);
				onTilesCallback(preloadData.tiles);
				console.log('Using preload data');
				resolve(); // ✅ 修復：必須 resolve Promise
				return;
			}

			if (this.#createBitmapWorker) {
				this.#createBitmapWorker.terminate();
				this.#createBitmapWorker = null;
			}

			this.#createBitmapWorker = new Worker('/src/app/js/workers/bitmapWorker.js');
			this.#setupWorkerNativeHeic(this.#createBitmapWorker);  // ✅ 設置原生 HEIC 支持
			const createRequest: BitmapWorkerRequest = { url, item, tileSize: this.#tileSize };
			this.#createBitmapWorker.postMessage(createRequest);

			this.#createBitmapWorker.onmessage = (e: MessageEvent<BitmapWorkerResponse>) => {
				// ✅ 使用版本控制而不是 URL 比較
				if (requestVersion !== this.#requestVersion) {
					console.log('Request version outdated, ignore');
					this.#createBitmapWorker.terminate();
					reject(new Error('Request version outdated')); // ✅ 修復：reject Promise
					return;
				}
				if (e.data.error) {
					this.#createBitmapWorker.terminate();
					onBitmapCallback({ usingImgTag: true });
					resolve(); // ✅ 修復：resolve Promise
				} else {
					// msg3: viewportBitmap 獨立到達（tiles 之後）
					if (e.data.viewportBitmap && !e.data.bitmap && !e.data.tiles) {
						this.#viewportBitmap = e.data.viewportBitmap;
						this.#createBitmapWorker.terminate();
						return;
					}
					if (e.data.usingImgTag || e.data.bitmap) {
						onBitmapCallback(e.data);
						if (e.data.usingImgTag) {
							resolve(); // ✅ 修復：如果使用 img tag，立即 resolve
						}
					}
					else if (e.data.tiles) {
						onTilesCallback(e.data.tiles);
						// 不立即 terminate — 如果 totalTiles > 50 還會有 viewportBitmap 訊息
						if (this.#totalTiles <= 50) {
							this.#createBitmapWorker.terminate();
						}
						resolve();
					}
				}
			};

			this.#createBitmapWorker.onerror = (error: any) => {
				this.#createBitmapWorker.terminate();
				console.error('BitmapWorker error:', error);
				onBitmapCallback({ usingImgTag: true });
				resolve(); // ✅ 修復：錯誤時也要 resolve（降級處理）
			};
		});
	}

	async loadURL(url: any, item: any) {
		return new Promise<any>((resolve, reject) => {
			try {
				if (this.url === url && this.#bitmapTiles.length > 0) return {};
				this.url = url;
				
				// ✅ 增加請求版本
				const currentVersion = ++this.#requestVersion;

				const thumbnailURL = FileUrlHelper.getLastestThumbnailUrl(item);
				if (getAttr(q("#detail-image"), "src") === "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAQSURBVHgBAQUA+v8AAAAAAAAFAAFkeJU4AAAAAElFTkSuQmCC") {
					setAttrEl(q("#detail-image"), "src", thumbnailURL);
				}

				// 修改後版本 - 傳入版本號
				this.#loadURLFromWorker(url, item, (result: any) => {
					// ✅ 檢查版本是否仍然有效
					if (currentVersion !== this.#requestVersion) {
						reject(new Error('Request version outdated'));
						return;
					}
					
					const bitmap = result.bitmap;
					const usingImgTag = result.usingImgTag;

					if (usingImgTag) {
						return resolve({ usingImgTag: true });
					}

					// 新增：儲存 viewport bitmap 和相關資訊
					this.#viewportBitmap = result.viewportBitmap || null;
					this.#totalTiles = result.totalTiles || 0;
					this.#imageWidth = result.imageWidth || item.width;
					this.#imageHeight = result.imageHeight || item.height;

					this.#height = item.height;
					this.#width = item.width;
					this.#thumbnailMode = false;

					// NOTE: createBitmap 無法考慮 exif orientation，因此如果遇到 thumbBitmap 與 bitmap 的 orientation 不同，則只顯示原圖
					if (bitmap) {
						this.#thumbRatio = 1;
						this.#thumbBitmap = bitmap;
						this.#thumbBitmapFromWorker = true;  // ✅ 記錄來自 Worker
						this.#thumbnailMode = true;
					}

					this.#renderTimeoutDuration = this.#width * this.#height < 16000000 ? 10 : 200;
					this.#initCanvas();
					resolve(undefined);
				}, (tiles: any) => {
					// ✅ 檢查版本是否仍然有效
					if (currentVersion !== this.#requestVersion) {
						return; // 忽略過時的回調
					}
					
					this.#bitmapTiles = tiles ?? [];
					this.#thumbRatio = 1;
					// ✅ 修復：只在安全的情況下 close
					if (this.#thumbBitmap && !this.#thumbBitmapFromWorker) {
						this.#thumbBitmap.close();
					}
					this.#thumbBitmap = null;
					this.#thumbBitmapFromWorker = false;  // 重置標記
					this.#thumbnailMode = false;
					this.#render();
				}, currentVersion);  // ✅ 傳入版本號
			}
			catch (error) {
				throw new Error('Failed to load image');
			}
		});
	}

	// 根據 viewport 取得 bitmap 的 tiles
	getBitmapTiles(viewport: any) {
		const tiles = [];
		for (let i = 0; i < this.#bitmapTiles.length; i++) {
			const tile = this.#bitmapTiles[i];
			const tileLeft = tile.x;
			const tileRight = tile.x + tile.w;
			const tileTop = tile.y;
			const tileBottom = tile.y + tile.h;
			const viewportLeft = viewport.left;
			const viewportRight = viewport.left + viewport.width;
			const viewportTop = viewport.top;
			const viewportBottom = viewport.top + viewport.height;
			if (tileRight > viewportLeft && tileLeft < viewportRight && tileBottom > viewportTop && tileTop < viewportBottom) {
				tiles.push(tile);
			}
		}
		return tiles;
	}

	#initCanvas() {
		if (this.#container.querySelector('canvas')) {
			this.#canvas = this.#container.querySelector('canvas');
		} else {
			this.#canvas = document.createElement('canvas');
			this.#container.appendChild(this.#canvas);
		}

		setCssEl(this.#container, {
			position: 'absolute',
			width: '100%',
			height: '100%',
			top: '0',
			left: '0',
			right: '0',
			bottom: '0',
			zIndex: '1',
			pointerEvents: 'none',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center'

		});

		this.#dpr = window.devicePixelRatio;
		setCssEl(this.#canvas, {
			position: 'absolute',
			top: '0',
			left: '0',
			right: '0',
			bottom: '0',
			width: '100%',
			height: '100%',
			pointerEvents: 'none',
			zoom: 1 / this.#dpr
		});
	}

	update(viewport: any) {
		const containerEl = this.#container;
        if (!containerEl || !this.#canvas || !viewport?.id) return;
		const parentRect = { height: heightOf(containerEl), width: widthOf(containerEl) };
		viewport = {url: this.url, ...viewport};
		
		if (window.devicePixelRatio !== this.#dpr) {
			this.#dpr = window.devicePixelRatio;
		}

		this.#canvas.width = parentRect.width * this.#dpr;
		this.#canvas.height = parentRect.height * this.#dpr;

		this.#viewport = viewport;
		this.#render();
	}

	#getCanvas() {
		const canvas = document.createElement('canvas');
		const ctx: any = canvas.getContext('2d');
		// 設置高品質渲染
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';
		// 將 thumbnail 繪製到 canvas
		if (this.#thumbnailMode) {
			canvas.width = this.#thumbBitmap.width;
			canvas.height = this.#thumbBitmap.height;
			ctx.drawImage(this.#thumbBitmap, 0, 0);
		}
		// 將 tiles 繪製到 canvas
		else {
			canvas.width = this.#width;
			canvas.height = this.#height;
			for (let i = 0; i < this.#bitmapTiles.length; i++) {
				const tile = this.#bitmapTiles[i];
				ctx.drawImage(tile.tile, tile.x, tile.y);
			}
		}
		return canvas;
	}

	async rotate(degree: any) {
		const canvas = this.#getCanvas();
		const rotatedCanvas = this.#rotateCanvas(canvas, degree);
		this.#thumbBitmap = await createImageBitmap(rotatedCanvas);
		this.#thumbBitmapFromWorker = false;  // ✅ 本地創建的 bitmap
		this.#thumbnailMode = true;
		this.#thumbRatio = 1;
	}

	#rotateCanvas(canvas: any, degree: any) {
		const rotatedCanvas = document.createElement('canvas');
		rotatedCanvas.width = canvas.height;
		rotatedCanvas.height = canvas.width;

		const ctx: any = rotatedCanvas.getContext('2d');

		if (degree === 90) {
			ctx.translate(rotatedCanvas.width, 0);
			ctx.rotate(90 * Math.PI / 180);
		} else if (degree === -90) {
			ctx.translate(0, rotatedCanvas.height);
			ctx.rotate(-90 * Math.PI / 180);
		} else {
			console.error('This function only supports rotations of 90 and -90 degrees.');
			return canvas;
		}

		ctx.drawImage(canvas, 0, 0);
		return rotatedCanvas;
	}

	async flip(scaleX = -1, scaleY = 1) {
		const canvas = this.#getCanvas();
		const flippedCanvas = this.#flipCanvas(canvas, scaleX, scaleY);
		this.#thumbBitmap = await createImageBitmap(flippedCanvas);
		this.#thumbBitmapFromWorker = false;  // ✅ 本地創建的 bitmap
		this.#thumbnailMode = true;
		this.#thumbRatio = 1;
	}

	#flipCanvas(canvas: any, scaleX = -1, scaleY = 1) {
		const flippedCanvas = document.createElement('canvas');
		flippedCanvas.width = canvas.width;
		flippedCanvas.height = canvas.height;

		const ctx: any = flippedCanvas.getContext('2d');
		
		// 根據 scaleX 和 scaleY 設定翻轉
		if (scaleX === -1 && scaleY === 1) {
			// 水平翻轉
			ctx.translate(canvas.width, 0);
			ctx.scale(-1, 1);
		} else if (scaleX === 1 && scaleY === -1) {
			// 垂直翻轉
			ctx.translate(0, canvas.height);
			ctx.scale(1, -1);
		} else if (scaleX === -1 && scaleY === -1) {
			// 雙向翻轉
			ctx.translate(canvas.width, canvas.height);
			ctx.scale(-1, -1);
		} else {
			// 沒有翻轉或無效參數，直接繪製
			ctx.scale(1, 1);
		}
		
		ctx.drawImage(canvas, 0, 0);
		return flippedCanvas;
	}

	// 新增：判斷是否應使用 viewport bitmap
	#shouldUseViewportBitmap() {
		// 沒有 viewport bitmap 就用磁磚
		if (!this.#viewportBitmap) {
			return false;
		}
		
		// 方法1：直接計算實際需要渲染的磁磚數量
		const tiles = this.getBitmapTiles(this.#viewport);
		const actualVisibleTiles = tiles.length;
		
		// 方法2：根據 viewport 在原圖中的覆蓋範圍計算
		const viewportCoverageWidth = Math.min(this.#viewport.width, this.#imageWidth);
		const viewportCoverageHeight = Math.min(this.#viewport.height, this.#imageHeight);
		const tilesInViewportX = Math.ceil(viewportCoverageWidth / this.#tileSize);
		const tilesInViewportY = Math.ceil(viewportCoverageHeight / this.#tileSize);
		const calculatedTiles = tilesInViewportX * tilesInViewportY;
		
		// 如果實際要渲染超過 50 個磁磚，改用 viewport bitmap
		return actualVisibleTiles > 50;
	}

	// 新增：動態更新 viewport bitmap（可選，未來優化用）
	async updateViewportBitmap(originalBitmap: any, actualViewportSize: any) {
		// 只在 viewport 變化很大時更新
		if (!this.#lastViewportWidth || 
		    Math.abs(actualViewportSize.width - this.#lastViewportWidth) > 200) {
			
			const newViewportBitmap = await createImageBitmap(originalBitmap, {
				resizeWidth: actualViewportSize.width * 2,  // 2x 以應對小幅放大
				resizeHeight: actualViewportSize.height * 2,
				resizeQuality: 'high'
			});
			
			// 釋放舊的
			if (this.#viewportBitmap) {
				this.#viewportBitmap.close();
			}
			
			this.#viewportBitmap = newViewportBitmap;
			this.#lastViewportWidth = actualViewportSize.width;
		}
	}

	#render() {
		if (this.#thumbnailMode && this.#thumbBitmap) {
			this.#renderThumb();
			return;
		}

		// 新增：檢查是否應使用 viewport bitmap
		if (this.#shouldUseViewportBitmap()) {
			this.#renderViewportBitmap();
			this.hideThumbnail();
			return;
		}

		if (this.#bitmapTiles.length === 0) return;

		const tiles = this.getBitmapTiles(this.#viewport);
		this.#renderRaw(tiles);
		this.hideThumbnail();
	}

	// 新增：使用 viewport bitmap 渲染
	#renderViewportBitmap() {
		const ctx: any = this.#canvas.getContext('2d');
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';
		
		// 使用與 #renderRaw 相同的 ratio 計算方式
		const ratio = this.#viewport.width / this.#canvas.width;
		const viewportWidth = parseInt(String(this.#canvas.width * ratio));
		const viewportHeight = parseInt(String(this.#canvas.height * ratio));
		
		// viewport bitmap 與原圖的比例
		const scaleX = this.#viewportBitmap.width / this.#imageWidth;
		const scaleY = this.#viewportBitmap.height / this.#imageHeight;
		
		// 計算實際可見的圖片區域（裁剪到圖片邊界內）
		const visibleLeft = Math.max(0, this.#viewport.left);
		const visibleTop = Math.max(0, this.#viewport.top);
		const visibleRight = Math.min(this.#imageWidth, this.#viewport.left + viewportWidth);
		const visibleBottom = Math.min(this.#imageHeight, this.#viewport.top + viewportHeight);
		const visibleWidth = visibleRight - visibleLeft;
		const visibleHeight = visibleBottom - visibleTop;
		
		// 如果沒有可見區域，清空畫布
		if (visibleWidth <= 0 || visibleHeight <= 0) {
			ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
			return;
		}
		
		// 計算源圖片的可見區域在 viewport bitmap 中的位置
		const sourceX = visibleLeft * scaleX;
		const sourceY = visibleTop * scaleY;
		const sourceWidth = visibleWidth * scaleX;
		const sourceHeight = visibleHeight * scaleY;
		
		// 使用與 #renderRaw 相同的畫布座標計算方式
		const canvasX = ((visibleLeft - this.#viewport.left) * this.#canvas.width / viewportWidth);
		const canvasY = ((visibleTop - this.#viewport.top) * this.#canvas.height / viewportHeight);
		const canvasWidth = (visibleWidth * this.#canvas.width / viewportWidth);
		const canvasHeight = (visibleHeight * this.#canvas.height / viewportHeight);
		
		// 清空畫布並繪製
		ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
		ctx.drawImage(
			this.#viewportBitmap,
			sourceX, sourceY, sourceWidth, sourceHeight,
			canvasX, canvasY, canvasWidth, canvasHeight
		);
	}

	#renderRaw(tiles: any) {
		const ctx: any = this.#canvas.getContext('2d');
        ctx.imageSmoothingEnabled = (this.#zoomer.rA < 2) || (preferences.habits.renderBehavior !== 'pixelated');
        ctx.imageSmoothingQuality = 'high';
		const ratio = this.#viewport.width / this.#canvas.width;
		const viewportWidth = parseInt(String(this.#canvas.width * ratio));
		const viewportHeight = parseInt(String(this.#canvas.height * ratio));

		for (let i = 0; i < tiles.length; i++) {
			const tile = tiles[i];
			const tileLeft = tile.x;
			const tileTop = tile.y;
			const tileWidth = tile.w;
			const tileHeight = tile.h;
			const viewportLeft = this.#viewport.left;
			const viewportTop = this.#viewport.top;
			const viewportWidth = parseInt(String(this.#canvas.width * ratio));
			const viewportHeight = parseInt(String(this.#canvas.height * ratio));
			const left = tileLeft;
			const top = tileTop;
			const right = tileLeft + tileWidth;
			const bottom = tileTop + tileHeight;
			const x = ((left - viewportLeft) * this.#canvas.width / viewportWidth);
			const y = ((top - viewportTop) * this.#canvas.height / viewportHeight);
			const w = ((right - left) * this.#canvas.width / viewportWidth);
			const h = ((bottom - top) * this.#canvas.height / viewportHeight);
			
			// 計算縮放比例
			const scaleX = w / tile.tile.width;
			const scaleY = h / tile.tile.height;
			const minScale = Math.min(scaleX, scaleY);
			
			// 如果需要大幅縮小（小於原始尺寸的 50%），使用漸進式渲染
			if (minScale < 0.5 && tile.tile.width > 512 && tile.tile.height > 512) {
				// 創建臨時 canvas 進行漸進式縮放
				const tempCanvas = document.createElement('canvas');
				const tempCtx: any = tempCanvas.getContext('2d');
				tempCtx.imageSmoothingEnabled = true;
				tempCtx.imageSmoothingQuality = 'high';
				
				// 計算中間尺寸（原始尺寸的 50%）
				let currentWidth = tile.tile.width;
				let currentHeight = tile.tile.height;
				
				// 先縮小到中間尺寸
				if (minScale < 0.25) {
					// 如果最終尺寸小於 25%，先縮到 50%
					currentWidth = Math.floor(tile.tile.width * 0.5);
					currentHeight = Math.floor(tile.tile.height * 0.5);
					tempCanvas.width = currentWidth;
					tempCanvas.height = currentHeight;
					tempCtx.drawImage(tile.tile, 0, 0, currentWidth, currentHeight);
					
					// 如果還需要進一步縮小
					if (minScale < 0.125) {
						// 再縮小一次
						const temp2Canvas = document.createElement('canvas');
						const temp2Ctx: any = temp2Canvas.getContext('2d');
						temp2Ctx.imageSmoothingEnabled = true;
						temp2Ctx.imageSmoothingQuality = 'high';
						
						currentWidth = Math.floor(currentWidth * 0.5);
						currentHeight = Math.floor(currentHeight * 0.5);
						temp2Canvas.width = currentWidth;
						temp2Canvas.height = currentHeight;
						temp2Ctx.drawImage(tempCanvas, 0, 0, currentWidth, currentHeight);
						
						// 最終繪製
						ctx.drawImage(temp2Canvas, x, y, w, h);
					} else {
						// 從中間尺寸繪製到最終尺寸
						ctx.drawImage(tempCanvas, x, y, w, h);
					}
				} else {
					// 直接從 50% 繪製到最終尺寸
					tempCanvas.width = Math.floor(tile.tile.width * 0.7);
					tempCanvas.height = Math.floor(tile.tile.height * 0.7);
					tempCtx.drawImage(tile.tile, 0, 0, tempCanvas.width, tempCanvas.height);
					ctx.drawImage(tempCanvas, x, y, w, h);
				}
			} else {
				// 小幅縮放或放大，直接繪製
				ctx.drawImage(tile.tile, x, y, w, h);
			}
		}
		// console.log(tiles.length);
	}

	#renderThumb() {
		const ctx: any = this.#canvas.getContext('2d');
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';
		const thumbLeft = parseInt(String(this.#viewport.left * this.#thumbRatio));
        const thumbTop = parseInt(String(this.#viewport.top * this.#thumbRatio));
        const thumbWidth = parseInt(String(this.#viewport.width * this.#thumbRatio));
        const thumbHeight = parseInt(String(this.#viewport.height * this.#thumbRatio));
        const ratio = thumbWidth / this.#canvas.width;
        const viewportWidth = parseInt(String(this.#canvas.width * ratio));
        const viewportHeight = parseInt(String(this.#canvas.height * ratio));
        ctx.drawImage(this.#thumbBitmap, thumbLeft, thumbTop, viewportWidth, viewportHeight, 0, 0, this.#canvas.width, this.#canvas.height);
	}
}
