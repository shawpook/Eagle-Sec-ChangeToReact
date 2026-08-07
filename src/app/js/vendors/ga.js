/*
 * name: nwjs-analytics -Node-Webkit Google Analytics integration
 * version: 1.0.2
 * github: https://github.com/Daaru00/nwjs-analytics
 */

function guid() {
    return (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase();
}

// if (window.isRunningAsElectron) {
    // grab a uuid to identify the session

// set the uuid to local storage

if (!localStorage["gaClientId"] || localStorage["gaClientId"] == 'undefined') {
    localStorage.setItem("gaClientId", guid())
}
// set the cookie storage for google analytics to none, and provide your own client id
clientId = localStorage["gaClientId"];
// }
var preferences = preferences || require(appRoot + '/my_modules/electron-settings').getPreferences() || {};
var locale = preferences.language || "en";
var customDimesion1 = "未激活";


if (!localStorage["gaClientId"] || localStorage["gaClientId"] == 'undefined') {
    localStorage.setItem("gaClientId", crypto.randomUUID())
}

const ga4track = ga4mp(["G-LZFKF8K4LB"], {  
    user_id: localStorage["gaClientId"],
    non_personalized_ads: true,
    debug: false
});

ga4track.setUserProperty('language', preferences.general.language.replace("_", "-").toLowerCase());
ga4track.setEventsParameter('app_version', `${pjson.version} (${pjson.buildVersion})`);
ga4track.setEventsParameter('app_name', `Eagle App`);

var analytics = {
    apiVersion: '1',
    trackID: 'UA-88989101-2',
    clientID: clientId,
    userID: clientId,
	appName: 'Eagle App',
	appVersion: `${pjson.version} (${pjson.buildVersion})`, 
	debug: false,
	performanceTracking: true,
	errorTracking: true,
	userLanguage: locale.replace("_", "-").toLowerCase(),
    currency: "USD",
    lastScreenName: '',

    sendRequest: function(data, callback){

        // 工程模式不需要記錄
        if (pjson.buildVersion === "dev") return;
        // if(!this.clientID || this.clientID == null)
        //     this.clientID = this.generateClientID();

        // if(!this.userID || this.userID == null)
        //     this.userID = this.generateClientID();

        var postData = "v=" + this.apiVersion
                        +"&tid=" + this.trackID
                        +"&cid=" + this.clientID
                        +"&uid=" + this.userID
                        +"&an=" + this.appName
                        +"&av=" + this.appVersion
                        +"&sr=" + this.getScreenResolution()
                        +"&vp=" + this.getViewportSize()
                        +"&sd=" + this.getColorDept()
                        +"&ul=" + this.userLanguage
                        +"&ua=" + this.getUserAgent()
                        +"&cd1=" + customDimesion1  // 自定维度1
                        +"&ds=app";

        Object.keys(data).forEach(function(key) {
            var val = data[key];
            if(typeof val != "undefined")
                postData += "&"+key+"="+val;
        });

        var http = new XMLHttpRequest();
        var url = "https://www.google-analytics.com";
        if(!this.debug)
            url += "/collect";
        else
            url += "/debug/collect";

        http.open("POST", url, true);

        http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

        http.onreadystatechange = function() {
            if(analytics.debug)
                console.log(http.response);

            if(http.readyState == 4 && http.status == 200) {
                if(callback)
                    callback(true);
            }
            else
            {
                if(callback)
                    callback(false);
            }
        }
        http.send(postData);
    },
    generateClientID: function()
    {
        var id = "";
        var possibilities = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for( var i=0; i < 5; i++ )
            id += possibilities.charAt(Math.floor(Math.random() * possibilities.length));
        return id;
    },
    getScreenResolution: function(){
        return screen.width+"x"+screen.height;
    },
    getColorDept: function(){
        return screen.colorDepth+"-bits";
    },
    getUserAgent: function(){
        return navigator.userAgent;
    },
    getViewportSize: function(){
        return window.screen.availWidth+"x"+window.screen.availHeight;
    },

    /*
     * Measurement Protocol
     * [https://developers.google.com/analytics/devguides/collection/protocol/v1/devguide]
     * https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#t
     */

    screenView: throttle(function(screename){
        var data = {
			't' : 'screenview',
			'cd' : screename
		}
		this.sendRequest(data);
        this.lastScreenName = screename;
        ga4track.trackEvent('page_view', {
            page_location: `/${screename}`,
            page_title: screename,
        });
    }, 10000),
    event: function(category, action, label, value){
        var data = {
			't' : 'event',
			'ec' : category,
			'ea' : action,
			'el' : label,
			'ev' : value,
            'cd' : this.lastScreenName,
		}
		this.sendRequest(data);

        let params = {};
        if (action) {
            params[action] = label || "true";
        }
        ga4track.trackEvent(category, params);
    },
    exception: function(msg, fatal){
        var data = {
			't' : 'exception',
			'exd' : msg,
			'exf' : fatal || 0
		}
		this.sendRequest(data);
    },
    timing: function(category, variable, time, label){
        var data = {
			't' : 'timing',
			'utc' : category,
			'utv' : variable,
			'utt' : time,
			'utl' : label,
		}
		this.sendRequest(data);
    },
    ecommerce:{
        transactionID: false,
        generateTransactionID: function()
        {
            var id = "";
            var possibilities = "0123456789";
            for( var i=0; i < 5; i++ )
                id += possibilities.charAt(Math.floor(Math.random() * possibilities.length));
            return id;
        },
        transaction: function(total, items){
            var t_id = "";
            if(!this.ecommerce.transactionID)
                t_id = this.ecommerce.generateTransactionID();
            else
                t_id = this.ecommerce.transactionID;

            var data = {
                't' : 'transaction',
                'ti' : t_id,
                'tr' : total,
                'cu' : this.currency,
            }
            this.sendRequest(data);

            items.forEach(function(item){
                var data = {
                    't' : 'item',
                    'ti' : t_id,
                    'in' : item.name,
                    'ip' : item.price,
                    'iq' : item.qty,
                    'ic' : item.id,
                    'cu' : this.currency
                }
                this.sendRequest(data);
            })
        }
    },
    custom: function(data){
        this.sendRequest(data);
    }
}

/*
 * Performance Tracking
 */

window.addEventListener("load", function() {

    if(analytics.performanceTracking)
    {
        setTimeout(function() {
            var timing = window.performance.timing;
            var userTime = timing.loadEventEnd - timing.navigationStart;

            analytics.timing("performance", "pageload", userTime);

          }, 0);
    }

}, false);

// /*
//  * Error Reporting
//  */

// window.onerror = function (msg, url, lineNo, columnNo, error) {
//     var message = [
//         'Message: ' + msg,
//         'Line: ' + lineNo,
//         'Column: ' + columnNo,
//         'Error object: ' + JSON.stringify(error)
//     ].join(' - ');

//     if(analytics.errorTracking)
//     {
//         setTimeout(function() {
//             analytics.exception(message.toString());
//         }, 0);
//     }

//     return false;
// };
