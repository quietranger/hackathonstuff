var _ = require('underscore');
var Q = require('q');
var util = require('../utils');
var config = require('../../../config');

var DataStore = function (core, sandbox, transport) {
    //data store must be inited by core with transport as passing parameter
    this.core = core;
    this.messages = {};
    this.users = {};
    this.app = {};
    this.drafts = {};
    this.documents = {};
    this.publicKeys = {};
    this.supportedMimeTypes = null;
    this.cacheLimit = 51; //one extra so you know if you should show "load more messages"
    this.transport = transport;
    this.sandbox = sandbox;
    this._getTypes = [ 'supportedMimeTypes', 'publicKeys', 'messages', 'users', 'app', 'roomParticipations', 'pinnedChats', 'filters', 'rooms', 'ims', 'drafts', 'documents' ];
    this._setTypes = [ 'publicKeys', 'messages', 'users', 'app', 'drafts', 'documents' ];

    var self = this;

    this.transport.setCommands({
        MANAGE_DOCUMENT: {
            url: function(params) {
                return config.API_ENDPOINT + '/clientdata/put/' + config.CLIENT_ID +
                    '/' + params.documentId;
            },

            requestType: 'POST'
        },

        GET_DOCUMENTS: {
            url: config.API_ENDPOINT + '/clientdata/get/' + config.CLIENT_ID,
            requestType: 'GET'
        },

        UPLOAD_ALLOWED_TYPES: {
            url: config.API_ENDPOINT + '/attachment/supported_mime_types',
            requestType: 'GET'
        }
    });

    this.sandbox.subscribe('following:change', function(ctx, newFilter){
        var oldFilter = _.find(self.app.account.filters, function(filter){
            return filter._id == newFilter._id;
        });

        if(oldFilter.ruleGroup.rules.length > newFilter.ruleGroup.rules.length){
            //if rules are removed, need to check whether other filters contains invalid rule
            var oldRuleIds = _.pluck(oldFilter.ruleGroup.rules, 'id'), newRuleIds = _.pluck(newFilter.ruleGroup.rules, 'id');

            var removedRuleIds = _.difference(oldRuleIds, newRuleIds);

            //for any filter which contains a user following rule that is not in the new following filter, remove such role. Backend will remove it too.
            _.each(self.app.account.filters, function(f){
                if(f.filterType == 'FILTER'){
                    var validRules = _.reject(f.ruleGroup.rules, function(rule){
                        return _.contains(removedRuleIds, rule.id);
                    });
                    f.ruleGroup.rules = validRules;
                }
            });
        }
        oldFilter.ruleGroup = newFilter.ruleGroup;
    });

    this.sandbox.registerMethod('getData', function() {
        if (/^rooms|^ims/i.test(arguments[0])) {
            return self.get.apply(self, Array.prototype.slice.call(arguments));
        }

        var deferred = Q.defer();

        deferred.resolve(self.get.apply(self, Array.prototype.slice.call(arguments)));

        return deferred.promise;
    });

    this.sandbox.registerMethod('setData', this.upsert.bind(this), true);
    this.sandbox.registerMethod('deleteMessageById', this.deleteMessageById.bind(this), true);
    this.sandbox.registerMethod('deleteMessagesByStream', this.deleteMessagesByStream.bind(this), true);
};

DataStore.prototype.get = function (key) {
    var target = key.split('.'),
        type = target[0],
        context = this[type];

    if (!key) {
        return null;
    }

    if (!_.contains(this._getTypes, type)) {
        return null;
    }

    if (type === 'messages') {
        return this.getHydratedMessages(target[1]);
    }

    if (type === 'rooms') {
        return this.getHydratedRoom(target[1]);
    }

    if (type === 'ims') {
        return this.getHydratedIm(target[1]);
    }

    if (type === 'documents') {
        return this.getHydratedDocuments(_.rest(target, 1));
    }

    if (type === 'publicKeys') {
        var split = target[1].split(',');

        return this.getHydratedPublicKeys(split);
    }

    if (type === 'supportedMimeTypes') {
        return this.getHydratedSupportedMimeTypes();
    }

    for (var i = 1, len = target.length; i <= len; i++) {
        if (i === len) {
            if(Object.prototype.toString.call(context) === '[object Object]') {
                return _.extend({}, context); //dont pass by reference
            } else {
                return context;
            }
        } else {
            if (context.hasOwnProperty([target[i]])) {
                context = context[target[i]];
            } else {
                return null;
            }
        }
    }

    return null;
};

DataStore.prototype.upsert = function (key, value, historical) {
    var target = key.split('.'),
        type = target[0],
        context = null,
        configUpdate = key.match(/app.account.config/);

    if (!key) {
        return false;
    }

    if (!_.contains(this._setTypes, type)) {
        return false;
    }

    /*if(type === 'users' && value instanceof Array) {

     }*/

    /*
    * Automatically saves to server if you pass in an object. If its an array we dont save to server
    * because you're restoring defaults and that information is already on the server
    * */
    if(key === 'app.account.userViewConfigs' && Object.prototype.toString.call(value) !== '[object Array]') {
        return this.updateServerConfig(key, value);
    }

    if (type === 'documents') {
        return this.updateDocumentStore(key, value);
    }

    if (type === 'messages') {
        var insertionArray = Object.prototype.toString.call(value) === '[object Array]' ? value : [value],
            threadId = target[1];

        if (!threadId) {
            return false; //thread id is required
        }

        if (insertionArray.length === 0) {
            return this.messages[threadId] = insertionArray;
        }

        return this.upsertMessages(threadId, insertionArray, historical); //historical true means its from dataquery, false from longpoller (determines msg insertion order)
    }

    if (target.length === 1) { //skip the loop and set the value since its top level
        this[type] = value;
        return this.get(key);
    } else {
        context = this[type];
    }

    for (var i = 0, len = target.length; i < len; i++) {
        if (i === len - 2) {
            context[target[i + 1]] = value;  //update the value
            return configUpdate ? this.updateServerConfig(configUpdate[0], value) : this.get(key);
        } else {
            if (context[target[i + 1]]) {
                context = context[target[i + 1]]; //update the context
            } else {
                context = context[target[i + 1]] = {}; //make an empty object and update the context
            }
        }
    }

    return false;
};

DataStore.prototype.deleteMessagesByStream = function(streamId) {
    if(this.messages[streamId]) {
        delete this.messages[streamId];
        return true;
    } else {
        return false;
    }
};

DataStore.prototype.upsertMessages = function (streamId, msgs, historical) {
    var self = this;

    if (!streamId) {
        return;
    }

    if (!this.messages.hasOwnProperty(streamId)) {
        /*
         * If the array of messages does not exist, init it with an empty array, which will be populated below
         * */
        this.messages[streamId] = [];
    }
    if (Object.prototype.toString.call(msgs) !== '[object Array]') {
        msgs = [msgs];
    }

    var formattedMsgs = util.flattenMessageResponse(msgs, this.app.account.userName, historical);
    if (historical && this.messages[streamId] < this.cacheLimit) {
        /*
         * Historical messages are appended to the end (so newest first, oldest last). This operation only
         * needs to be performed if the message count is less than our cache limit, otherwise it's fully
         * hydrated. Slice to the cache limit.
         * */
        this.messages[streamId] = this.messages[streamId].concat(formattedMsgs);
        this.messages[streamId].slice(0, this.cacheLimit);
    } else {
        /*
         * New messages are placed at the start. Slice to the cache limit.
         * */
        formattedMsgs.forEach(function (message) {
            //publish once bcz all modules will get it, insert to multiple stream.
            message.historical = historical; // required by appBridge to decide if to show alert
            message.streamId = streamId;//set streamId, streamId can be different from threadId, e.g. a chat message can go to a filter stream
            self.publishMessages('incoming:message', message);
            // publish it to the specific streamId
            self.publishMessages('incoming:message:' + streamId, message);

        });
        this.messages[streamId] = formattedMsgs.concat(this.messages[streamId]);
        this.messages[streamId].slice(0, this.cacheLimit);
    }

    return this.messages[streamId];
};

DataStore.prototype.publishMessages = function(name, message) {
    this.sandbox.publish(name, null, message);

    if(this.core.opts.type === 'widget' && !this.core.opts.existingConnection) { //its the first widget
        localStorage.setItem('widget', JSON.stringify({
            'event' : name,
            'data'  : message
        }));
    }
};

DataStore.prototype.getHydratedSupportedMimeTypes = function() {
    var q = Q.defer(),
        self = this;

    if (!this.supportedMimeTypes) {
        this.transport.send({
            id: 'UPLOAD_ALLOWED_TYPES'
        }).then(function(rsp) {
            self.supportedMimeTypes = rsp.supportedMimeTypes;
        }, function() {
            self.supportedMimeTypes = [];
        }).done(function() {
            q.resolve(self.supportedMimeTypes);
        });
    } else {
        q.resolve(this.supportedMimeTypes);
    }

    return q.promise;
};

DataStore.prototype.getHydratedMessages = function (streamId) {
    var streamType = null,
        q = Q.defer(),
        roomParticipations = this.app.account.roomParticipations,
        pinnedChats = this.app.account.pinnedChats,
        filters = this.app.account.filters,
        self = this,
        dataQuery = null,
        currentMsgCount = this.messages[streamId] ? this.messages[streamId].length : 0; //the message array does not exist yet (never before requested or never updated via longpoll)

    for (var p in roomParticipations) {
        if (roomParticipations.hasOwnProperty(p)) {
            if (roomParticipations[p].threadId === streamId) {
                streamType = 'roomParticipations';
                break;
            }
        }
    }

    if (!streamType) {
        for (var p in pinnedChats) {
            if (pinnedChats.hasOwnProperty(p)) {
                if (pinnedChats[p].threadId === streamId) {
                    streamType = 'pinnedChats';
                    break;
                }
            }
        }
    }
    if (!streamType) {
        for (var p in filters) {
            if (filters.hasOwnProperty(p)) {
                if (filters[p]._id === streamId) {
                    streamType = 'filters';
                    break;
                }
            }
        }
    }

    if (currentMsgCount > 50) {
        q.resolve(this.messages[streamId]);
    } else {
        if (streamType === 'roomParticipations' || streamType === 'pinnedChats' || !streamType) {
            //if streamType is undefined, it's profile
            var payload = {
                'from': '0',
                //'to': currentMsgCount ? this.messages[streamId][currentMsgCount - 1].ingestionDate - 1 : new Date().getTime(),
                'limit': 51 - currentMsgCount,
                'id': streamId
            };

            if (streamType === 'pinnedChats') {
                payload.includestatus = true;
            }

            dataQuery = this.transport.send({
                'id': 'QUERY_THREAD_HISTORY',
                'payload': payload
            });
        }

        if (streamType === 'filters') {
            dataQuery = this.transport.send({
                'id': 'QUERY_FILTER',
                'payload': {
                    'from': '0',
                    //'to': currentMsgCount ? this.messages[streamId][currentMsgCount - 1].ingestionDate - 1 : new Date().getTime(),
                    maxrow: 51 - currentMsgCount,
                    filterid: streamId
                }
            });
        }

        dataQuery.done(function (rsp) {
            var resolveVal,
                messages = null;

            if (streamType === 'roomParticipations' || streamType === 'pinnedChats' || !streamType) {
                messages = rsp.envelopes;
            }

            if (streamType === 'filters') {
                messages = rsp.queryResults[0].socialMessages;
            }
            /*
             * Dont use this.get('messages.streamId'), imagine the case where a thread has less than 51 messages (like a new
             * chatroom): this function would continuously loop since it wants to find 51 messages.
             * */
            resolveVal = self.upsertMessages(streamId, messages, true);

            q.resolve(resolveVal); //the previously stored and newly requested
        }, function (error) {
            q.reject(error);
        });
    }

    return q.promise;
};

DataStore.prototype.getHydratedDocuments = function(target) {
    var walked = this._walkDocuments(target),
        self = this,
        q = Q.defer();

    if (_.isEmpty(this.documents)) {
        this._hydrateDocuments().then(function() {
            q.resolve(self._walkDocuments(target));
        });
    } else {
        q.resolve(walked);
    }

    return q.promise;
};

DataStore.prototype.getHydratedPublicKeys = function(userIds) {
    var q = Q.defer(),
        self = this;

    if (!userIds) {
        q.resolve(null);
        return;
    }

    var keys = _.keys(this.publicKeys),
        intersection = _.intersection(keys, userIds);

    if (intersection.length === userIds.length) {
        q.resolve(this._formatPublicKeys(userIds));
    } else {
        this._hydratePublicKeys(userIds).then(function() {
            q.resolve(self._formatPublicKeys(userIds))
        });
    }

    return q.promise;
};

DataStore.prototype._hydratePublicKeys = function(userIds) {
    var self = this;

    return this.sandbox.send({
        id: 'GET_PUBLIC_KEYS',
        payload: {
            ids: userIds.join(',')
        }
    }).then(function(rsp) {
        _.extend(self.publicKeys, rsp.publicKeys);
    });
};

DataStore.prototype._formatPublicKeys = function(userIds) {
    var self = this,
        ret = {};

    _.each(userIds, function(id) {
        ret[id] = self.publicKeys[id];
    });

    return ret;
};

DataStore.prototype._walkDocuments = function(target) {
    var ret;

    if (target.length === 0) {
        return $.extend(true, {}, this.documents);
    }

    try {
        var ret = this.documents[target[0]];

        for (var i = 1; i < target.length; i++) {
            ret = ret[target[i]];
        }
    } catch(e) {
        ret = null;
    }

    if(Object.prototype.toString.call(ret) === '[object Object]') {
        return $.extend(true, {}, ret);
    } else {
        return ret;
    }
};

DataStore.prototype._hydrateDocuments = function() {
    var self = this, q = Q.defer();

    this.transport.send({
        id: 'GET_DOCUMENTS'
    }).then(function(rsp) {
        if (rsp && rsp.document) {
            _.extend(self.documents, rsp.document);
        }

        q.resolve();
    }, function() {
        q.resolve();
    });

    return q.promise;
};

//get room/im info from backend in case local data is outdated
DataStore.prototype._hydrateRoom = function(threadId, isIm, forceUpdate) {
    if (!threadId) {
        return;
    }

    var q = Q.defer(),
        self = this,
        requestObj = {};

    if(isIm) {
        requestObj.id = 'IM_MANAGER_THREAD';
        requestObj.payload = {
            threadid: threadId
        }
    } else {
        requestObj.id = 'GET_ROOM_MANAGER';
        requestObj.payload = {
            action: 'roominfo',
            threadid: threadId
        }
    }

    if(forceUpdate === false){
        var field = isIm ? 'pinnedChats' : 'roomParticipations',
            rooms = this.app.account[field];
        for (var i = 0; i < rooms.length; i++) {
            var room = rooms[i];
            if (room.threadId == threadId) {
                //if local copy is found, return directly. Otherwise, fetch from server
                q.resolve(room);
                return q.promise;
            }
        }
    }

    this.transport.send(requestObj).then(function(rsp) {
        var acc = self.get('app.account'), found = false;

        var field = isIm ? 'pinnedChats' : 'roomParticipations',
            rooms = acc[field];

        for (var i = 0; i < rooms.length; i++) {
            var room = rooms[i];

            if (room.threadId == threadId) {
                found = true;

                _.extend(room, rsp.result);
            }
        }

        if (!found) {
            rooms.push(rsp.result);
        }

        self.upsert('app.account.' + field, rooms);

        q.resolve(rsp.result);
    }, function() {
        q.fail();
    });

    return q.promise;
};

/*
 * @param: threadId, threadId of the stream
 * @param: forceUpdate, force front end to fetch the latest from server
 * */
DataStore.prototype.getHydratedRoom = function(threadId, forceUpdate) {
    return this._hydrateRoom(threadId, false, forceUpdate);
};

DataStore.prototype.getHydratedIm = function(threadId, forceUpdate) {
    return this._hydrateRoom(threadId, true, forceUpdate);
};

DataStore.prototype.deleteMessageById = function (messageId) {
    var isFound = null,
        msgArray = null;

    for (var thread in this.messages) {                                         //loop over each thread
        if (!isFound && this.messages.hasOwnProperty(thread)) {                  //make sure it has the property
            msgArray = this.messages[thread];                                   //cache it for faster access
            for (var i = 0, len = msgArray.length; i < len; i++) {               //loop over each message
                if (msgArray[i].messageId === messageId) {                       //did we find matching ids?
                    this.messages[thread] = msgArray.splice(i, i + 1);            //then splice it out
                    return this.messages[thread];                               //return the modified array
                }
            }
        }
    }

    return false;
};

DataStore.prototype.updateServerConfig = function (configUpdate, value) {
    var self = this,
        deferred = Q.defer(),
        userViewConfigExists = false,
        requestObject = {
            userId: this.app.account.userName,
            viewId: value.viewId,
            viewType: value.viewType,
            clientType: config.CLIENT_VERSION,
            pinnedChat: value.pinnedChat || false,
            config: value.config
        };

    if (configUpdate === 'app.account.config') {
        return this.transport.send({
            'id': 'UPDATE_CONFIG',
            'payload': {
                action: 'updateconfig',
                userconfig: JSON.stringify(this.app.account.config)
            }
        }).done(function (rsp) {
            if (rsp.status === "OK") {
                deferred.resolve(rsp);
                self.app.account.config = rsp.result
            } else {
                deferred.reject(rsp);
            }
        });
    }

    if (configUpdate === 'app.account.userViewConfigs') {
        return this.transport.send({
            'id': 'UPDATE_CONFIG',
            'payload': {
                action: 'updateviewconfig',
                userviewconfig: JSON.stringify(requestObject)
            }
        }).done(function (rsp) {
            if (rsp.status === "OK") {

                var updatedConfigArray = _.map(self.app.account.userViewConfigs, function (item) {
                    if (item.viewId === rsp.result.viewId) {
                        userViewConfigExists = true;
                        return _.extend(item, {'config': rsp.result.config});
                    } else {
                        return item;
                    }
                });

                if (!userViewConfigExists) {
                    updatedConfigArray.push(rsp.result);
                }

                self.app.account.userViewConfigs = updatedConfigArray;
                deferred.resolve(rsp);


            } else {
                deferred.reject(rsp);
            }
        });
    }

    return deferred.promise;
};

DataStore.prototype.updateDocumentStore = function(key, value) {
    var deferred = Q.defer(),
        split = key.split('.'),
        documentId = split.slice(1, split.length).join('/'),
        self = this;

    this.transport.send({
        id: 'MANAGE_DOCUMENT',
        payload: {
            document: JSON.stringify(value)
        },
        params: {
            documentId: documentId
        }
    }).then(function(rsp) {
        var obj = self.documents;

        for (var i = 1; i < split.length; i++) {
            var levelUp = obj[split[i]];

            if (!_.isObject(levelUp)) {
                if (levelUp === undefined) {
                    obj[split[i]] = {};
                } else {
                    deferred.reject();
                    return;
                }
            }

            if (i === split.length - 1) {
                if (_.isArray(value)) {
                    obj[split[i]] = value.slice(0);
                } else if(_.isObject(value)) {
                    _.extend(obj[split[i]], value);
                }
            } else {
                obj = obj[split[i]];
            }
        }

        deferred.resolve(rsp);
    }, function(rsp) {
        deferred.reject(rsp);
    });

    return deferred.promise;
};

DataStore.prototype.getStream = function (streamId) {
    var stream = _.findWhere(this.app.account.pinnedChats, {'threadId': streamId});

    if (!stream) {
        stream = _.findWhere(this.app.account.roomParticipations, {'threadId': streamId});
    }

    if (!stream) {
        stream = _.findWhere(this.app.account.filters, {'_id': streamId});
    }

    return stream;
};

DataStore.prototype.getStreamConfig = function (streamId) {
    return _.findWhere(this.app.account.userViewConfigs, {'viewId': streamId});
};

module.exports = exports = DataStore;
