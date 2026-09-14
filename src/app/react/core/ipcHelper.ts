/**
 * c1：IPCHelper 逐字移植（bundle 3471 起对象字面量提取；bundle 顶层 const 不上 window，
 * React 此前无法直用——本模块补齐）。机械替换：ipcRenderer → eagleGlobals ipcRenderer()；
 * electronLog → window.electronLog 兜底 console。
 */
import { ipcRenderer as ipcRendererFn } from '../global/eagleGlobals';

const ipcRenderer: any = ipcRendererFn();
const electronLog: any = (window as any).electronLog || console;

export const IPCHelper = {
	send: function (channel: any, params: any, ignoreLogging: any = false) {
		try {
			ipcRenderer.send(channel, params);
			if (!ignoreLogging) {
				electronLog && electronLog.info(`[ipc] ${channel}`);
			}
		}
		catch (err) {

		}
	},
	sendTo: function (id: any, channel: any, params: any, ignoreLogging: any) {
		try {
			ipcRenderer.sendTo(id, channel, params);
			if (!ignoreLogging) {
				electronLog && electronLog.info(`[ipc] ${channel}`);
			}
		}
		catch (err) {

		}
	}
};;
