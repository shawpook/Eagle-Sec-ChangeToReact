const url = require('url');
const UAParser = require(appRoot + '/my_modules/ua-parser');
const uaParser = new UAParser();
const {
    JSendSuccessResponse,
    JSendErrorResponse,
    JSendFailResponse,
    ApplicationErrorReponse
} = require('./jsend_response');
const {JSendError, JSendFail} = require('./jsend_exception');

class JsonServerProc {
    constructor(conf) {
        this._conf = conf;
        this.API = {};
        this.handler = {};
        this.steamAPI = {};
    }

    /**
     * Add api
     * @protected
     * @param {string} api entry point (pathname) of api.
     * @param {string} method http method. GET, DELETE, POST, PUT
     * @param {function} callback implementation of server function.
     */
    addAPI(api, method, callback, options) {
        if(this.API[api] == void 0) this.API[api] = {};
        this.API[api][method] = callback;
        if (options?.streaming) {
            this.steamAPI[api] = true
        }
        return this;
    }

    addHandler(api, callback) {
        this.handler[api] = callback;
        return this;
    }

    //////////////////////////////////////////////////////////////////
    // [private] server main proc
    async proc(request, response) {
        var pathname = url.parse(request.url, true).pathname;
        var api = this.API[pathname];
        var handler = this.handler[pathname];
        let responseObject = undefined;
        const usingStream = this.steamAPI[pathname] === true;

        if(api != void 0) {
            if (typeof api[request.method] === 'function') { 
                responseObject = await this._callAPI(api[request.method], request);
            } else {
                // method not allowed.
                responseObject = new JSendErrorResponse(405, new JSendError(405, 'method not allowed'));
            }
        } 
        else if (handler) {
            const args = await this._getArguments(request);
            return await handler(args, response);
        }
        else {
            // 404 not found.
            if(this._conf.ignore404 != true) {
                responseObject = new JSendErrorResponse(404, new JSendError(404, 'method not allowed'));
            }
        }
        if (responseObject) {
            if (usingStream) {
                // reponse buffer to client
                // responseObject is a buffer
                // response.writeHead("200", {'Content-Type': 'application/octet-stream', 'Access-Control-Allow-Origin': '*'});
                // nodejs response image file as buffer to display image
                response.end(responseObject?._data);
            }
            else {
                this._replyJson(response, responseObject);
            }
        }
    }

    async _callAPI(fn, request) {
        let responseBody = undefined;
        try {
            // read args from request
            let args = await this._getArguments(request);
            try {
                let host = request?.headers?.host;
                let hasVaildHost = (host === 'localhost:41595' || host === '127.0.0.1:41595' || host === '0.0.0.0:41595');
				let hasVaildatedToken = args.token && (args.token === $bodyScope.preferences.developer.apiToken);

                console.log(request.url)
                
                // 針對 POST 資料進行日誌記錄
                if (request.method === "POST") {
                    const userAgent = request.headers['user-agent'] || "";
                    uaParser.setUA(userAgent);

                    const uaResult = uaParser.getResult();
                    const uaBroser = uaResult.browser;

                    const fromExtension = args.version !== undefined;
                    let extension = "";
                    if (fromExtension) {
                        extension = `extension: ${args.version}`;
                    }
                    electronLog.info(`[api] [${uaBroser.name}|${uaBroser.version}] ${extension}: ${request.method} ${request.url}`);
                }

                if (hasVaildHost || hasVaildatedToken) {
                    responseBody = new JSendSuccessResponse(await fn(args));
                }
                else {
					responseBody = new JSendErrorResponse(401, new JSendError(401, 'Unauthorized: Access is denied due to invalid token. If you want to obtain your API token, you can find it in the Preferences > Developer option.'));
				}
            } catch(ex) {
                if(ex instanceof JSendFail) {
                    responseBody = new JSendFailResponse(200, ex);
                } else if (ex instanceof JSendError) {
                    responseBody = new JSendErrorResponse(200, ex);
                } else {
                    responseBody = new ApplicationErrorReponse(ex);
                }
            }
        } catch (_) {
            console.log(_);
            responseBody = new JSendErrorResponse(400, new JSendError(400, 'Bad Request'));
        }
        return responseBody;

    }

    //////////////////////////////////////////////////////////////////
    // [private] reply Json 
    _replyJson(response, reponseObject) {
        response.writeHead(reponseObject.getHttpStatus(), {'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*'});
        response.end(JSON.stringify(reponseObject.toJSendResponse()));
    }


    /**
     * Read arguments from URL or body.
     * *`GET` or `DELETE` : from URL
     * *`POST` or `PUT` : from BODY
     * @private
     * @param {IncommingMessage} request Incomming Message from client
     * @returns {object} argument of API
     */
    async _getArguments(request) {
        var ret = void 0;
        try {
            if(request.method == 'GET' || request.method == 'DELETE') {
                // if method GET or DELETE the arguments must be  in query string.
                ret = url.parse(request.url, true).query;
            }
            else if(request.method == 'POST' || request.method == 'PUT'){
                // if method POST or PUT then arguments must be in body of http request..
                ret = await this._readBodyJson(request);
                // 支援從 query string 讀取 token（向後兼容，解決外部客戶端如 Docker 容器透過 query string 傳遞 token 的問題）
                if (!ret.token) {
                    const query = url.parse(request.url, true).query;
                    if (query.token) {
                        ret.token = query.token;
                    }
                }
            }
        }
        catch(error) {
            // if error rethrow.
            throw error;
        }
        return ret;
    }

 
    /**
     * Read JSON from stream.
     * @private
     * @param {IncommingMessage} request Incomming message from HTTP client
     * @returns {Object} JSON from stream
     */
    _readBodyJson(request) {
        return new Promise((resolve, reject)=>{

            var content = '';

            // on reach data: concat chunk
            request.on('data', (chunk)=>{
                content += chunk;
                return content;
            });

            // on end: parse JSON and resolve this Promise
            request.on('end', ()=>{
                try {
                    resolve(JSON.parse(content));
                }
                catch(e) {
                    // on error syntax error
                    reject(new Error('request Json Systax Error.'));
                }
            });
        });
    }
}

module.exports = {
    JsonServerProc: JsonServerProc
}