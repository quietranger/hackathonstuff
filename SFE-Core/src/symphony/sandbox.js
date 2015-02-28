"use strict";
//The sandbox holds the instance of pubsub for the app as well as gives direct access to the core

var Q = require('q');
var utils = require('./utils');

var Sandbox = function () {
    // ************************************************************************
    // PRIVATE VARIABLES
    // ONLY PRIVELEGED METHODS MAY ACCESS
    // ***********************************************************************
    this.pubsub = require('pubsubjs').create();

    // ************************************************************************
    // PUBLIC PROPERTIES -- ANYONE MAY READ/WRITE
    // ************************************************************************
    this.floaters = {};
    this.iFrames = {};
    this.availFloaterId = 0;
    this.asyncMethods = {
        getData: true,
        setData: true,
        send: true,
        fetchMessages: true,
        isRunningInClientApp: true,
        getPresenceForId: true,
        isFloatingWindow: true
    };
    this.avoidFloatPublish = [/^view:(?!focus|close)/, /^modal:/, /appBridge:fn/, /^click$/];

    this.receiveMessage();

    // set a killed flag to true to prevent published events from propagating
    this.subscribe("app:kill", function() {
      this.killed = true;
    }.bind(this));
};

Sandbox.prototype.registerMethod = function(name, method, async) {
    if (_.isEmpty(name) || typeof name !== 'string') {
        throw new Error('Cannot register sandbox method without a valid name.');
    }

    if (this[name]) {
        throw new Error('Sandbox method already exists.');
    }

    if (!method) {
        throw new Error('Cannot register sandbox method without a valid method to register.');
    }

    var ret;

    if (async) {
        ret = function() {
            var d = Q.defer();

            d.resolve(method.apply({}, arguments));

            return d.promise;
        };
    } else {
        ret = method;
    }

    this[name] = ret;
};

Sandbox.prototype.publish = function (evt, context, args) {
    if (this.killed) {
      return;
    }

    var self = this,
        dontPublishToFloat = null;

    this.pubsub.publish(evt, context, args);

    for (var i = 0, len = this.avoidFloatPublish.length; i < len; i++) {
        if (evt.match(this.avoidFloatPublish[i])) {
            dontPublishToFloat = true;
            break;
        }
    }

    //todo check if cant convert
    if (!dontPublishToFloat) {
        //the main window sandbox also publishes to all the floaters
        for (var floater in self.floaters) {
            if (self.floaters.hasOwnProperty(floater)) {
                console.log('posting to floater', floater);
                self.floaters[floater].floater.postMessage({
                    'method': 'pubsub',
                    'data': [evt, null, args]
                }, '*');
            }
        }

       for(var iFrame in self.iFrames) {
           if(self.iFrames.hasOwnProperty(iFrame)) {
               console.log('posting to floater', iFrame);
               self.iFrames[iFrame].postMessage({
                   'method': 'pubsub',
                   'data': [evt, null, args]
               }, '*');
           }
       }
    }
};

Sandbox.prototype.windowIdentRequest = function () {
    return ++this.availFloaterId;
};

Sandbox.prototype.subscribe = function (evt, cb) {
    this.pubsub.subscribe(evt, cb);
};

Sandbox.prototype.unsubscribe = function (evt, cb) {
    this.pubsub.unsubscribe(evt, cb);
};

Sandbox.prototype.receiveMessage = function () {
    var self = this,
        async = null;

    window.addEventListener('message', function (e) {
        if (e.data !== 'process-tick') {
            console.log('got message:', e.data);
            if (e.data.method === "pubsub") {
                self.publish.apply(self, e.data.data);
                return;
            }

            if (e.data.method === "floaterReady") {
                self.floaters[e.data.floaterId].floaterReady.resolve();
                return;
            }

            if (e.data.method === "floaterClose") {
                console.log('remove floater reference:', e.data.floaterId);
                if (self.floaters[e.data.floaterId]) {
                    self.publish('appBridge:fn', null, {fnName: 'closeWindow', param: {window: self.floaters[e.data.floaterId].floater}});
                    delete self.floaters[e.data.floaterId];
                    //tell leftnav the view is closed
                    for (var i in e.data.viewIds) {
                        self.publish('view:close', null, e.data.viewIds[i]);
                    }
                }
                return;
            }

            var methodRsp = self[e.data.method].apply(self, e.data.data);

            if (self.asyncMethods.hasOwnProperty(e.data.method) && self.asyncMethods[e.data.method]) {
                //for asynchronous methods (core methods that return promises)
                methodRsp.then(function (rsp) {
                    self._sendToAll(e, rsp);
                }, function (err) {
                    if (e.data.method === 'send') {
                        err = JSON.stringify(err);
                    } else {
                        err = err.toString();
                    }

                    e.data.method = 'exception';

                    console.log('Error: ', e, err);

                    self._sendToAll(e, err);
                });
            } else {
                //for synchronous methods
                self._sendToAll(e, methodRsp);
            }
        }
    });
};

Sandbox.prototype._sendToAll = function(e, data) {
    for (var floater in this.floaters) {
        if (this.floaters.hasOwnProperty(floater)) {
            this.floaters[floater].floater.postMessage({
                'method': e.data.method,
                'messageId': e.data.messageId,
                'data': data,
                'windowIdent': e.data.windowIdent
            }, '*');
        }
    }

    for (var iFrame in this.iFrames) {
        if (this.iFrames.hasOwnProperty(iFrame)) {
            this.iFrames[iFrame].postMessage({
                'method': e.data.method,
                'messageId': e.data.messageId,
                'data': data,
                'windowIdent': e.data.windowIdent
            }, '*');
        }
    }
};


module.exports = Sandbox;
