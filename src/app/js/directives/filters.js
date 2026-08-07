EagleApp.filter('substring', function() {
    return function(input, start, end) {
        if (!input || !input?.substring) return '';
        return input.substring(start, end);
    };
});

EagleApp.filter('sortHSL', function () {
    return function (palettes) {
        try {
            if (!palettes) return;
            const getHSL = (color) => {
                const [r, g, b] = [color[0], color[1], color[2]];
                const hsl = colorConvert.rgb.hsl(r, g, b);
                const [h, s, l] = [hsl[0], hsl[1], hsl[2]];
                return [h, s, l];
            };

            // 將最大 ratio 的顏色放在最前面，其它維持原本的順序
            const maxRatioPalette = palettes.reduce((prev, curr) => {
                return prev.ratio > curr.ratio ? prev : curr;
            });
            const maxRatio = maxRatioPalette.ratio;
            const maxRatioHSL = getHSL(maxRatioPalette.color);
            let others = palettes.filter((color) => color.ratio !== maxRatio);

            // sort others base on maxRatioHSL
            others = others.sort((a, b) => {
                const hslA = getHSL(a.color);
                const hslB = getHSL(b.color);

                const hADiff = Math.abs(hslA[0] - maxRatioHSL[0]);
                const hBDiff = Math.abs(hslB[0] - maxRatioHSL[0]);
                const sADiff = Math.abs(hslA[1] - maxRatioHSL[1]);
                const sBDiff = Math.abs(hslB[1] - maxRatioHSL[1]);
                const lADiff = Math.abs(hslA[2] - maxRatioHSL[2]);
                const lBDiff = Math.abs(hslB[2] - maxRatioHSL[2]);

                if (Math.abs(hADiff - hBDiff) >= 30) {
                    return hADiff - hBDiff;
                }
                else if (Math.abs(sADiff - sBDiff) >= 10) {
                    return sADiff - sBDiff;
                }
                else {
                    return lADiff - lBDiff;
                }
            });

            const result = [maxRatioPalette, ...others];
            return result;
        }
        catch (err) {
            return palettes.sort((a, b) => {
                return a.ratio - b.ratio;
            });
        }
    };
});

EagleApp.filter('numberAbbreviate', function () {
    return function (input) {
        if (isNaN(input)) return null;
        if (input < 1000) {
            return input;
        }
        if (input >= 1000 && input < 1000000) {
            return (input / 1000).toFixed(1) + 'K';
        }
        if (input >= 1000000 && input < 1000000000) {
            return (input / 1000000).toFixed(1) + 'M';
        }
        if (input >= 1000000000) {
            return (input / 1000000000).toFixed(1) + 'B';
        }
    };
});

EagleApp.filter('shortcuts', function ($window) {
    return function (key) {
        if (!key) return '';
        if (process.platform != 'darwin') {
            return key.replace('CommandOrControl', 'Ctrl').replace('CmdOrCtrl', 'Ctrl').replace('⌘', 'Ctrl');
        } else {
            return key.replace(/\+/g, ' ').replace('CommandOrControl', '⌘').replace('CmdOrCtrl', '⌘').replace('Command', '⌘').replace('Ctrl', '⌘').replace('Shift', '⇧').replace('Alt', '⌥').replace('Delete', '⌫').replace('Control', '⌃').replace('Option', '⌥').replace('Backspace', '⌫');
        }
    }
});

EagleApp.filter('shortcutsWrapper', function () {
    return function (shortcut) {
        if (!shortcut) return '';
        
        // Check if already wrapped with <key> tags
        if (shortcut.includes('<key>') && shortcut.includes('</key>')) {
            return shortcut;
        }
        
        // Remove + signs and split by spaces, then wrap each key
        return shortcut.replace(/\+/g, '')
            .split(' ')
            .filter(key => key.trim().length > 0)
            .map(key => '<key>' + key.trim() + '</key>')
            .join(' ');
    }
});

EagleApp.filter('filesize', function () {
    var units = [
        'bytes',
        'KB',
        'MB',
        'GB',
        'TB',
        'PB'
    ];

    return function (bytes, precision) {
        if (isNaN(parseFloat(bytes)) || !isFinite(bytes)) {
            return '?';
        }

        var unit = 0;
        var k = 1024;
        if (process.platform === 'darwin') k = 1000;

        while (bytes >= k) {
            bytes /= k;
            unit++;
        }
        return bytes.toFixed(+2) + ' ' + units[unit];
        // return bytes.toFixed(+precision) + ' ' + units[unit];
    };
});

EagleApp.filter('themePath', function () {
    return function (theme) {
        if (theme === 'light' || theme === 'lightgray') {
            return 'light';
        }
        else {
            return 'dark';
        }
    };
});