// Bilibili hover preview 已移除
// 原因：啟用 site isolation 後，跨 origin iframe 無法直接存取 DOM，
// 而 Bilibili 沒有官方 postMessage API，無法安全控制播放器。
