eagle.urlEnlargerRemote = {
    load: () =>{
        const scripts = [
            `https://oss-app.eagle.cool/js/url-enlarger.js?v=${Date.now()}`,
            'https://eagleapp.oss-cn-hongkong.aliyuncs.com/js/url-enlarger.js'
        ];

        function loadScript(index) {
            if (index >= scripts.length) return;

            const script = document.createElement('script');
            const src = scripts[index];
            script.src = src;
            script.onload = function() {
                console.log("remote rule loaded.");
            };
            script.onerror = function() {
                // Error occurred loading script. Load next one.
                console.log(`remote rule fail, ${src}`);
                loadScript(index + 1);
            };
            document.head.appendChild(script);
        }

        loadScript(0);
    }
}