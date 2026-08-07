const IPCHelper = {
	send: function (channel, params, ignoreLogging) {
		try {
			ipcRenderer.send(channel, params);
			if (!ignoreLogging) {
				electronLog && electronLog.info(`[ipc] ${channel}`);
			}
		}
		catch (err) {

		}
	},
	sendTo: function (id, channel, params, ignoreLogging) {
		try {
			ipcRenderer.sendTo(id, channel, params);
			if (!ignoreLogging) {
				electronLog && electronLog.info(`[ipc] ${channel}`);
			}
		}
		catch (err) {

		}
	}
};