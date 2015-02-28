"use strict";

//The sandbox holds the instance of pubsub for the app as well as gives direct access to the core

var Q = require('q');

var SandboxFloat = function (floaterId) {
    this.floaterId = floaterId;
    this.promises = {};
    this.promiseCounter = 0;
    this.avoidParentPublish = [/^view:(?!focus|close|unfloat|showfromfloat)/, /^modal:/, /^click$/, /^theme:changed$/];
    this.pubsub = require('pubsubjs').create();

    this.receiveMessage();
};

SandboxFloat.prototype.registerMethod = function(name) {
    if (_.isEmpty(name) || typeof name !== 'string') {
        throw new Error('Cannot register sandbox method without a valid name.');
    }

    if (this[name]) {
        throw new Error('Sandbox method already exists.');
    }

    //hack!
    if (name === 'isFloatingWindow') {
        var cb = arguments[1];

        this.isFloatingWindow = function() {
            var d = Q.defer();

            d.resolve(cb.call({}));

            return d.promise;
        };
    }

    this[name] = function () {
        return this.sendMessage({
            'method': name,
            'data': Array.prototype.slice.call(arguments)
        });
    };
};

SandboxFloat.prototype.subscribe = function(evt, cb) {
    this.pubsub.subscribe(evt, cb);
};

SandboxFloat.prototype.unsubscribe = function (evt, cb) {
    this.pubsub.unsubscribe(evt, cb);
};

SandboxFloat.prototype.sendMessage = function (opts) {
    var self = this,
        q = Q.defer();
    self.promises[++self.promiseCounter] = q;
    window.opener.postMessage({
        'method': opts.method,
        'messageId': self.promiseCounter,
        'data': opts.data,
        'windowIdent': self.floaterId
    }, '*');
    return q.promise;
};

/*
 * Really just notifies the main window, which then dispatches to all the windows (including itself)
 * */
SandboxFloat.prototype.publish = function (evt, context, args) {
    var self = this,
        dontPublishToParent = null;

    for (var i = 0, len = this.avoidParentPublish.length; i < len; i++) {
        if (evt.match(this.avoidParentPublish[i])) {
            dontPublishToParent = true;
            break;
        }
    }

    if (dontPublishToParent) {
        this.pubsub.publish(evt, null, args);
    } else {
        return this.sendMessage({
            'method': 'pubsub',
            'data': [evt, context, args]
        });
    }
};

/*
 * Actually notifies the windows pubsub system
 * */
SandboxFloat.prototype.publishLocally = function (evt, context, args) {
    this.pubsub.publish(evt, null, args);
};

SandboxFloat.prototype.receiveMessage = function () {
    var self = this;

    window.addEventListener('message', this._didReceiveMessage.bind(this));
};

SandboxFloat.prototype._didReceiveMessage = function (e) {
    if (e.data === 'process-tick') {
        return;
    }

    console.log('got message:', e.data);

    if (e.data.method === "pubsub") {
        this.publishLocally.apply(this, e.data.data);
    } else if (this.floaterId.toString() === e.data.windowIdent.toString()) {
        var messageId = e.data.messageId;

        if (e.data.method === 'exception') {
            var data;

            try {
                data = JSON.parse(e.data.data); //parse it if it's JSON
            } catch (err) {
                data = e.data.data;
            }

            this.promises[messageId].reject(data);
        } else {
            this.promises[messageId].resolve(e.data.data);
        }
    }
};

module.exports = SandboxFloat;
