/**
 * c1：IPCHelper 逐字移植（bundle 3471 起对象字面量提取；bundle 顶层 const 不上 window，
 * React 此前无法直用——本模块补齐）。机械替换：ipcRenderer → eagleGlobals ipcRenderer()；
 * electronLog → window.electronLog 兜底 console。
 */
// @ts-nocheck
import { ipcRenderer as ipcRendererFn } from '../global/eagleGlobals';

const ipcRenderer: any = ipcRendererFn();
const electronLog: any = (window as any).electronLog || console;

export const IPCHelper = {
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
};;
