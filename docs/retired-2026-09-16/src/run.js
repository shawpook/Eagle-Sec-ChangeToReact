const bytenode = require('bytenode');
const v8 = require('v8');
v8.setFlagsFromString('--no-lazy');
require(__dirname + '/run.jsc');
require(__dirname + '/main.jsc');