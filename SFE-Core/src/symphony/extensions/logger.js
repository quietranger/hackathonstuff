"use strict";

var inBrowser = true;

var Logger = function (sandbox) {
    var self = this;

    this.sandbox = sandbox;

    _.each(['debug', 'info', 'warn', 'error'], function(level) {
        self.sandbox.registerMethod(level, self[level].bind(self));
    });

    this.determineBrowserOrDesktop();
};

Logger.prototype.logger = function () {
    var self = this;

    var loggers = {
        'debug': function(msg) {
            console.log.apply(console, msg);
        },
        'info': function(msg) {
            console.log.apply(console, msg);
        },
        'warn': function(msg){
            console.warn.apply(console, msg);
        },
        'error': function(msg){
            console.error.apply(console, msg);
            self.logErrorRemotely(msg);
        }
    };

    var args = Array.prototype.slice.call(arguments);   //an array of the arguments

    if(!loggers[args[0]]) {     //any log level matches?
        args.unshift('debug');  //well then default to debug
    }

    var specifiers = this.stringifyParams(args.slice(1)),    //the first is the logging level
        formatted = specifiers.concat(args.slice(1));   //the specifiers like %s or %f

    loggers[args[0]](formatted);
};

Logger.prototype.determineBrowserOrDesktop = function () {
    try {
        if (appbridge != null) {
            inBrowser = false;
        }
    } catch (err) {
    }
    inBrowser = true;
};

Logger.prototype.logToDesktop = function (msg) {
    if (!inBrowser) {
        try {
            appbridge.Log(msg);
        } catch (e) {
            console.log(msg);
        }
    } else {
        console.log(msg);
    }
};

Logger.prototype.logErrorRemotely = function (msg) {
    this.sandbox.publish("usage-event", null, {
        action: "CLIENT_ERROR",
        details: {
            msg: msg
        },
        immediate: false
    });
}


Logger.prototype.stringifyParams = function (msgs) {
    var msg = "";

    for(var i = 0, len = msgs.length; i < len; i++) {
        if(Object.prototype.toString.call(msgs[i]) === '[object String]') {
            msg += '%s';
        }
        if(Object.prototype.toString.call(msgs[i]) === '[object Number]') {
            msg += '%f';
        }
        if(Object.prototype.toString.call(msgs[i]) === '[object Object]') {
            msg += '%O';
        }
    }
    return [msg];
};

//convenience methods below
Logger.prototype.debug = function () {
    if (inBrowser) {
        this.logger.apply(this, ['debug'].concat(Array.prototype.slice.call(arguments)));
    } else {
        this.logToDesktop(Array.prototype.slice.call(arguments));
    }
};

Logger.prototype.info = function () {
    if (inBrowser) {
        this.logger.apply(this, ['info'].concat(Array.prototype.slice.call(arguments)));
    } else {
        this.logToDesktop(Array.prototype.slice.call(arguments));
    }
};

Logger.prototype.warn = function () {
    if (inBrowser) {
        this.logger.apply(this, ['warn'].concat(Array.prototype.slice.call(arguments)));
    } else {
        this.logToDesktop(Array.prototype.slice.call(arguments));
    }
};

Logger.prototype.error = function () {
    if (inBrowser) {
        this.logger.apply(this, ['error'].concat(Array.prototype.slice.call(arguments)));
    } else {
        this.logToDesktop(Array.prototype.slice.call(arguments));
    }
    this.logErrorRemotely(arguments);
};

module.exports = Logger;
