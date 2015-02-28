"use strict";

var Q = require('q');

var unauthorizedView = require('../views/unauthorized');
var notProvisionedView = require('../views/notProvisioned');
var infoBarrierView = require('../views/infoBarrier');

var Ajax = function(sandbox) {
    this.sandbox = sandbox;
    this.requests = {};
};

/**
 * @desc make a GET request
 * @param opts the options of your request
 * opts.baseUrl is required and opts.payload is optional
 * @returns a Q promise
 */
Ajax.prototype.doGet = function(opts) {
    return this.makeRequest(opts, 'GET');
};

/**
 * @desc make a POST request
 * @param opts the options of your request
 * opts.baseUrl is required and opts.payload is optional
 * @returns a Q promise
 */
Ajax.prototype.doPost = function(opts) {
    return this.makeRequest(opts, 'POST');
};

Ajax.prototype.doPut = function(opts) {
    return this.makeRequest(opts, 'PUT');
};

Ajax.prototype.doDelete = function(opts) {
    return this.makeRequest(opts, 'DELETE');
};

Ajax.prototype.abortRequest = function(id) {
    var request = this.requests[id];

    if (request) {
        request.abort();
        delete this.requests[id];
    }
};

Ajax.prototype.makeRequest = function(opts, requestType){
    var self = this,
        urlExtension = opts.urlExtension || '',
        data = opts.payloadType === 'json' || opts.jsonRoot ? JSON.stringify(opts.payload) : opts.payload;

    if (opts.jsonRoot) {
        var tmp = {};
        tmp[opts.jsonRoot] = data;
        data = tmp;
    }

    var ajaxOpts = {
        type: requestType,
        url: opts.baseUrl + urlExtension,
        data: data,
        xhrFields: {
            withCredentials: true
        }
    };

    if (opts.onProgress) {
        ajaxOpts.xhr = function() {
            var xhr = $.ajaxSettings.xhr();
            xhr.upload.onprogress = opts.onProgress;
            return xhr;
        };
    }

    _.extend(ajaxOpts, _.omit(opts.ajaxOpts, function(value, key) {
        return ajaxOpts.hasOwnProperty(key);
    }));

    return Q.promise(function (resolve, reject, notify) {
        var ajaxResult = $.ajax(ajaxOpts);
        
        ajaxResult.then(function (data, textStatus, jqXHR) {
            resolve(data);
        }, function (jqXHR, textStatus, errorThrown) {
            delete jqXHR.then; // treat xhr as a non-promise

            if(jqXHR.status === 401) {
                //user not authenticated
                self.sandbox.publish('modal:show', null, {
                    title: 'Unauthorized',
                    closable: false,
                    contentView: new unauthorizedView({
                        sandbox: self.sandbox
                    })
                });

                self.sandbox.warn('Authorization check failed. User must login.');

                self.sandbox.publish('app:kill', null, {
                    'error'     : 'Unauthorized'
                });
            }

            if(jqXHR.status === 403) {
                //user not provisioned
                self.sandbox.publish('modal:show', null, {
                    title: 'Not provisioned',
                    contentView: new notProvisionedView({
                        sandbox: self.sandbox
                    })
                });

                self.sandbox.warn('User not provisioned for this application.');

                self.sandbox.publish('app:kill', null, {
                    'error'     : 'Not provisioned'
                });
            }

            if(jqXHR.status === 411) {
                self.sandbox.publish('modal:show', null, {
                    title: 'Info barrier alert',
                    contentView: new infoBarrierView({
                        sandbox: self.sandbox,
                        msg: jqXHR.responseJSON.message,
                        isRoom: opts.payload.action === 'adduser' && opts.payload.threadid,
                        threadId: opts && opts.payload ? opts.payload.threadid : false,
                        requestorId: opts && opts.payload ?  opts.payload.userid : false
                    })
                });

                self.sandbox.warn('Info barrier alert.');
            }

            reject(jqXHR);
        }).always(function() {
            delete self.requests[opts.id];
        });

        self.requests[opts.id] = ajaxResult;
    });
};

module.exports = Ajax;
