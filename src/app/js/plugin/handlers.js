const { ipcRenderer } = require('electron');

const handlers = {};

function registerHandler(name, fn) {
	handlers[name] = fn;
}

async function callHandler(name, data) {
	const fn = handlers[name];
	if (!fn) throw new Error(`Handler not found: ${name}`);
	return await fn(data);
}

/**
 * 將已註冊的 handler 橋接到 ipcRenderer，自動處理 try/catch 與回傳。
 * @param {string} name - handler 名稱（同時也是 IPC channel 名稱）
 * @param {*} fallback - 錯誤時回傳的預設值
 */
function bridgeIPC(name, fallback) {
	ipcRenderer.on(name, async (event, params) => {
		try {
			const result = await callHandler(name, params.data);
			ipcRenderer.sendTo(params.windowID, params.channel, result);
		} catch (err) {
			console.error(`[Handler] ${name} error:`, err);
			ipcRenderer.sendTo(params.windowID, params.channel,
				typeof fallback === 'function' ? fallback(err) : fallback
			);
		}
	});
}

module.exports = { registerHandler, callHandler, bridgeIPC, handlers };
