'use strict';

var ReadReceiptQueue = function(sandbox, transport) {
    this.queue = [];
    this.rrMap = {}; //for dedupe
    this.transport = transport;
    this.sandbox = sandbox;

    _.bindAll(this, '_send', 'enqueue'); // always keep _flushQueue's 'this' object as ReadReceiptQueue
    this.flush = _.throttle(this._send, 3000, {
        leading: false
    });

    var self = this;

    this.sandbox.subscribe('message:read', function(ctx, args) {
        self.enqueue(args);
    });
};

ReadReceiptQueue.prototype._send = function() {
    //TODO; deduplicate
    this.transport.send({
        id: 'SEND_READ_RECEIPT',
        payload: {
            content: JSON.stringify(this.queue)
        }
    });
    this.queue = [];
    this.rrMap = {};
};

ReadReceiptQueue.prototype.enqueue = function(msgArray) {
    if(!(msgArray instanceof Array) || !msgArray.length){
        return;
    }

    for(var key in msgArray){
        var message = msgArray[key];
        if (!message.threadId || !message.messageId || this.rrMap[message.messageId]) {
            continue;
        }
        this.rrMap[message.messageId] = message;
        var queueObj = {};
        queueObj[message.threadId] = message.messageId;
        this.queue.push(queueObj);
    }
    this.flush();
};

module.exports = ReadReceiptQueue;
