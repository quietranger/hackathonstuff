"use strict";
var Q = require('q');
var Backbone = require('backbone');
var _ = require('underscore');

var config = require('../../../config');

var Transport = function(sandbox, ajax) {
    var self = this;

    this._commands = {};
    this.ajax = ajax;
    this.sandbox = sandbox;

    this.sandbox.registerMethod('send', this.send.bind(this));
};

Transport.prototype.setCommands = function(commands) {
    this._commands = _.defaults(this._commands, commands);
};

/**
 * @desc executes a remote command
 * @param opts - the options of your command.
 * opts.id (required)
 * opts.params (optional)
 */
Transport.prototype.send = function(opts) {
    var command = this._commands[opts.id];

    if (command) {
        var request = {
            baseUrl: typeof command.url === "function" ? command.url(opts.params) : command.url,
            requestType: typeof command.requestType === 'function' ? command.requestType(opts.params) : command.requestType,
            payload: opts.payload,
            onProgress: opts.onProgress,
            urlExtension: opts.urlExtension,
            asyncTransforms: opts.asyncTransforms || [],
            id: _.uniqueId(),
            payloadType: command.payloadType || null,
            ajaxOpts: command.ajaxOpts || {},
            jsonRoot: command.jsonRoot || null
        };

        this.trigger('transport:willSendData', opts.id, request);

        var ret = Q.defer(),
            self = this,
            transforms;

        if (request.asyncTransforms.length > 0) {
            //convert array of asyncTransforms promises into one promise
            transforms = Q.all(request.asyncTransforms);
        } else {
            //if no transforms then create an immediately-resolved promise
            var deferred = Q.defer();
            deferred.resolve();

            transforms = deferred.promise;
        }

        //need to use IIFE here to trap promise resolution state
        transforms.then((function(self, ret, request, opts) {
            return function() {
                var req;

                switch (request.requestType) {
                    case 'GET':
                        req = self.ajax.doGet(request);
                        break;
                    case 'POST':
                        req = self.ajax.doPost(request);
                        break;
                    case 'PUT':
                        req = self.ajax.doPut(request);
                        break;
                    case 'DELETE':
                        req = self.ajax.doDelete(request);
                        break;
                    default:
                        ret.reject('Unsupported request type.');
                        return;
                }

                req.then(function(rsp) {
                    self.trigger('transport:didReceiveData', opts.id, rsp);
                    ret.resolve(rsp);
                }, function(rsp) {
                    ret.reject(rsp);
                });
            };
        })(self, ret, request, opts), function(message) {
            ret.reject({
                responseText: message
            });
        });

        ret.promise.abort = function() {
            self.ajax.abortRequest(request.id);
        };

        return ret.promise;
    }

    var badRequest = Q.defer();
    badRequest.reject('No such transport action exists.');
    return badRequest.promise;
};

_.extend(Transport.prototype, Backbone.Events);

module.exports = Transport;
