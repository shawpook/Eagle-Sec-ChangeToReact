let ipcRenderer;
module.exports = {
    init: (ipc) => {
        ipcRenderer = ipc;
    },
    debug: (plugin, object) => { console.log(object); ipcRenderer.send('logger.debug', `[plugin] [${plugin.manifest.name}${plugin.manifest.version}] ${object.stack || JSON.stringify(object)}`) },
    info: (plugin, object) => { console.info(object); ipcRenderer.send('logger.info', `[plugin] [${plugin.manifest.name}${plugin.manifest.version}] ${object.stack || JSON.stringify(object)}`) },
    warn: (plugin, object) => { console.warn(object); ipcRenderer.send('logger.warn', `[plugin] [${plugin.manifest.name}${plugin.manifest.version}] ${object.stack || JSON.stringify(object)}`) },
    error: (plugin, object) => { console.error(object); ipcRenderer.send('logger.error', `[plugin] [${plugin.manifest.name}${plugin.manifest.version}] ${object.stack || JSON.stringify(object)}`) },
    insert: (obj, nickname, whitelist) => {
        let name, fn;
        for (name in obj) {
            fn = obj[name];
            if (typeof fn === 'function' && whitelist.includes(name)) {
                obj[name] = ((name, fn) => {
                    return function () {
                        try {
                            eagle.log.info(`Calling ${nickname}.${name}(${arguments[0]}, ${arguments[1]}, ${arguments[2]})`);
                        }
                        catch (err) {}
                        return fn.apply(this, arguments);
                    }
                })(name, fn);
            }
        }
    }
}