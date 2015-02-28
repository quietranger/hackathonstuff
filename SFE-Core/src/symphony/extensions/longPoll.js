"use strict";

var _ = require('underscore');
var logger = require('./logger');
var utils = require('../utils');
var config = require('../../../config');
var reconnectView = require('../views/reconnect/index');
var unauthorizedView = require('../views/unauthorized');
var notProvisionedView = require('../views/notProvisioned');
var infoBarrierView = require('../views/infoBarrier');

var LongPoll = function (core, sandbox, transport, dataStore, appBridge, layout) {
    this.core = core;
    this.sandbox = sandbox;
    this.transport = transport;
    this.dataStore = dataStore;
    this.appBridge = appBridge;
    this.layout = layout;
    this.feed = null;
    this.feedTime = null;
    this.feedSeq = null;
    this.realTimeRequestLastComplete = new Date().getTime();
    this.feedErrors = 0;
    this.longpollRandomizer = new Date().getTime()+Math.floor(Math.random()*1000);

    this.sandbox.subscribe("app:kill", this.stopPolling.bind(this));
};

LongPoll.prototype.setCrypto = function(crypto) {
    this.crypto = crypto;
};

LongPoll.prototype.publishPollEvents = function(event, context, data) {
    this.sandbox.publish(event, context, data);

    if(this.core.opts.type === 'widget' && !this.core.opts.existingConnection) { //its the first widget
        localStorage.setItem('widget', JSON.stringify({
            'event' : event,
            'data'  : data
        }));
    }
};

LongPoll.prototype.startPolling = function () {
    var self = this;

    if(this.core.opts.type === 'widget' && this.core.opts.existingConnection) {
        window.addEventListener('storage', function(e){
            if(e.key === 'widget') {
                var receivedData = JSON.parse(e.newValue);
                self.publishPollEvents(receivedData.event, null, receivedData.data);
            }
            if(e.key === 'connectionExists' && e.newValue === '0') {
                localStorage.setItem('widgetId'+self.longpollRandomizer, 'widgetId');

                setTimeout(function(){
                    var existingWidgets = [];

                    for(var key in localStorage) {
                        if(key.match(/^widgetId/)) {
                            existingWidgets.push(key)
                        }
                    }

                    if(existingWidgets.sort()[0] === 'widgetId'+self.longpollRandomizer) {
                        document.location.reload();
                    }
                }, 1000)
            }
        });

        self.startWidgetWatcher();

    } else {
        window.addEventListener('storage', function(e){
            if(e.key.match(/^widgetId/)) {
                localStorage.setItem(e.key, '1');
            }
        });

        if (this.userId == null) {
            this.sandbox.getData('app.account').then(function (rsp) {
                self.userId = rsp.userName;
                self.readRealTimeFeed();
            });
        } else {
            this.readRealTimeFeed();
        }
        this.startWatcher();
    }
};

LongPoll.prototype.stopPolling = function () {
    //abort the current request
    if (this.feed && this.feed.abort && (typeof this.feed.abort === 'function')) {
        this.feed.abort();
    }
    if (this.watcherId) {
        clearInterval(this.watcherId);
    }
};

LongPoll.prototype.startWatcher = function () {
    var self = this;
    this.watcherId = setInterval(function () {
        // if the outstanding request is older than 45 seconds, shoot it
        if (self.feed) {
            var ageOfReq = new Date().getTime() - self.feedTime
            if (ageOfReq > 45000) {
                self.sandbox.info("Request older than 45 seconds active in realtime watcher - active requests count: " + $.active);
                self.sandbox.info("The age of the request is " + ageOfReq + "ms. Aborting it now and removing reference.");
                self.feed.abort();
                self.feed = null;
                self.sandbox.info("Active requests count after abortion: " + $.active);
            }
        }
        // also, if it's been more than 90 seconds since the last req completion
        // we want to refresh the app
        var timeSinceCompletion = new Date().getTime() - self.realTimeRequestLastComplete;
        if (timeSinceCompletion > 90000) {
            // freak out
            self.sandbox.info("The application hasn't completed a request in " + timeSinceCompletion + " ms. Active requests count: " + $.active);
            self.sandbox.info("Prompting the user to refresh.");
            // TODO add a desktop alert notifyClientApp(null, null, "Connection interrupted ", "Please click submit to refresh the app and re-establish connection. Thank you!", img, "", 1);
            // tell the user we're going to refresh
            self.sandbox.publish('modal:show', null, {
                title: 'Connection issue',
                contentView: new reconnectView({
                    dataStore: self.dataStore
                }),
                closable: false,
                isFlat: true
            });
            self.stopPolling();
        }
    }, 20000); // every 20 seconds
};

LongPoll.prototype.startWidgetWatcher = function() {
    var self = this;

    setInterval(function(){
        self.core.checkLongpollExistence().then(function(rsp){
            console.log('long poll watch', rsp);
            if(!rsp) {
                document.location.reload();
            }
        }).done();
    }, 10000);
};

LongPoll.prototype.readRealTimeFeed = function () {
    var self = this;

    if (this.feed) {
        // this should never happen
        this.sandbox.error("Existing ajax reference exists inside realTimeFeed - Active requests count: " + $.active);
        this.sandbox.error("There's already an active ajax request that was sent " + new Date().getTime() - this.feedTime + "ms ago. Aborting it now and removing reference.");
        this.feed.abort();
        this.feed = null;
        this.sandbox.error("Active requests count after abortion: " + $.active);
    }

    var clientInfo = this.appBridge.getClientInfo();
    this.feed = this.transport.send({
        id: 'LONG_POLL',
        payload: {
            '_clientVersion':  self.core.opts.type === 'widget' ? self.longpollRandomizer : self._clientVersion,
            '_clientip': clientInfo.ip,
            '_userId': this.userId
        }
    });
    self.feedTime = new Date().getTime();

    this.feed.then(function (rsp) {
        if (rsp.statusText === "TIMEOUT") {
            self.delayPolling(rsp.statusText);
        }


        if (self.feedSeq != null) {
            if (rsp.seq != (self.feedSeq + 1)) {
                // we've missed something
                // failover!
                self.sandbox.publish("usage-event", null, {
                    action: "LP_FAILOVER",
                    details: {
                        reason: "SEQUENCE_INCORRECT",
                        expectedSeq: self.feedSeq + 1,
                        rspSeq: rsp.seq
                    },
                    immediate: true
                });
                self.stopPolling();
                // tell the user we're going to refresh
                self.sandbox.publish('modal:show', null, {
                    title: 'Connection issue',
                    contentView: new reconnectView({
                        dataStore: self.dataStore
                    }),
                    closable: false,
                    isFlat: true
                });
            }
        }
        self.feedSeq = rsp.seq;
        self.realTimeRequestLastComplete = new Date().getTime();
        self.feed = null; // de-reference it to prevent it from looking active
        if (self.expectedHost != null && rsp.host != self.expectedHost) {
            self.sandbox.publish("usage-event", null, {
                action: "LP_FAILOVER",
                details: {
                    reason: 'HOST_CHANGED',
                    expectedHost: self.expectedHost,
                    rspHost: rsp.host
                },
                immediate: true
            });
            self.stopPolling();
            // tell the user we're going to refresh
            self.sandbox.publish('modal:show', null, {
                title: 'Connection issue',
                contentView: new reconnectView({
                    dataStore: self.dataStore
                }),
                closable: false,
                isFlat: true
            });
        } else {
            self.expectedHost = rsp.host;
        }


        self.feedErrors = 0;
        var streamIdsForUnreadCount = [];
        // instead of looking at triggers, we should just deal with the messages now!
        if (rsp.messages && rsp.messages.length) {
            for (var i = 0, len = rsp.messages.length; i < len; i++) {
                var messageWrapper = rsp.messages[i];
                if (messageWrapper.message !== null && messageWrapper.message.version !== "MAESTRO"
                    && messageWrapper.message.from.id !== self.dataStore.get('app.account.userName')) {
                    streamIdsForUnreadCount.push(messageWrapper.message.threadId);
                }
                if (messageWrapper.message.chatType === 'INSTANT_CHAT') {
                    //handleInstantChat will upsertMessage in callback
                    self.handleInstantChat(messageWrapper);
                } else if (messageWrapper.message.version === 'MAESTRO') {
                    self.handleMaestroEvent(messageWrapper);
                    self.dataStore.upsertMessages(messageWrapper.message.threadId, messageWrapper, false);
                } else if (messageWrapper.message.chatType === 'CHATROOM') {
                    self.dataStore.upsertMessages(messageWrapper.message.threadId, messageWrapper, false);
                } else if(messageWrapper.message.chatType === 'POST') {
                    self.dataStore.upsertMessages(messageWrapper.message.threadId, messageWrapper, false);
                }

                if (messageWrapper.filterIds !== null && messageWrapper.filterIds != null && messageWrapper.filterIds.length !== 0) {
                    for (var j = 0, len1 = messageWrapper.filterIds.length; j < len1; j++) {
                        var filterId = messageWrapper.filterIds[j];
                        self.dataStore.upsertMessages(filterId, messageWrapper, false);
                        streamIdsForUnreadCount.push(filterId);
                    }
                }
            }

            self.incrementNewMessageCounts(streamIdsForUnreadCount);
        }

        // handle typing messages
        if (rsp.typing && rsp.typing.length) {
            for (var i = 0, len = rsp.typing.length; i < len; i++) {
                self.publishPollEvents('typing:' + rsp.typing[i].threadId, null, rsp.typing[i]);
            }
        }

        if (rsp.readReceipts && rsp.readReceipts.length) {
            var unique = _.uniq(rsp.readReceipts, function (obj) {
                return obj.messageId + obj.threadId;
            });

            var grouped = _.groupBy(unique, function (rr) {
                return rr.messageId;
            });

            _.each(_.keys(grouped), function (key) {
                var data = grouped[key];
                self.publishPollEvents('message:readreceipt', null, data);
            });
        }
        //continue the long poll immediately
            self.readRealTimeFeed();
    }, function (jqXHR) {
        self.sandbox.error('error in long poll:', jqXHR);
        if(jqXHR.status === 401) {
            //user not authenticated
            self.sandbox.publish('modal:show', null, {
                title: 'Unauthorized',
                closable: false,
                contentView: new unauthorizedView({
                    sandbox: self.sandbox
                }),
                isFlat: true
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
                }),
                isFlat: true
            });

            self.sandbox.warn('User not provisioned for this application.');

            self.sandbox.publish('app:kill', null, {
                'error'     : 'Not provisioned'
            });
        }

        if(jqXHR.status === 411) {
            //todo this is not tested
            //info barrier error
            self.sandbox.publish('modal:show', null, {
                title: 'Info barrier alert',
                contentView: new infoBarrierView({
                    sandbox: self.sandbox,
                    msg: jqXHR.responseJSON.message
                })
            });

            self.sandbox.warn('Info barrier alert.');
        }

        if (jqXHR.status !== 401 && jqXHR.status !== 403 && jqXHR.status !== 411) { //These errors are handled above
            self.delayPolling(jqXHR.statusText); //we dont know so just delay
        }
    });
};

LongPoll.prototype.incrementNewMessageCounts = function (streamIds) {
    for (var i = 0, len = streamIds.length; i < len; i++) {
        var streamId = streamIds[i];
        this.sandbox.publish('messagecounts:increment:' + streamId, null, streamId);
    }
};

LongPoll.prototype.delayPolling = function (msg) {
    this.feedErrors++;

    var waitTimeSeconds = 15 + Math.floor((Math.random() * 75) + 1); // random 15 - 90seconds

    this.sandbox.warn('Error in function readRealTimeFeed(), waiting ', waitTimeSeconds , ' seconds:', msg);

    this.sandbox.publish('error:feed', null, {
        'error': msg,
        'waitTime': waitTimeSeconds
    });

    setTimeout(this.readRealTimeFeed.bind(this), waitTimeSeconds*1000);
};

LongPoll.prototype.impactsCurrentUser = function (affectedUsers) {
    var acctData = this.dataStore.get('app.account'),
        impactsCurrentUser = false;

    for (var i = 0, len = affectedUsers.length; i < len; i++) {
        if (affectedUsers[i].id === acctData.userName) {
            impactsCurrentUser = true;
            break;
        }
    }

    return impactsCurrentUser;
};

LongPoll.prototype.isCurrentUser = function (user) {
    var acctData = this.dataStore.get('app.account');
    return acctData.userName === user.id;
};

LongPoll.prototype.handleMaestroEvent = function (msg) {
    //i dont like fall through
    switch (msg.message.event) {
        case "JOIN_ROOM":
            if (this.impactsCurrentUser(msg.message.affectedUsers)) {
                this.publishPollEvents('view:created', null, msg.message.maestroObject);
                var currentRooms = this.dataStore.get('app.account.roomParticipations');
                this.dataStore.upsert('app.account.roomParticipations', currentRooms.concat(msg.message.maestroObject));
            }else
                this.publishPollEvents('room:membersUpdate:'+msg.message.maestroObject.threadId, null, msg.message.maestroObject);
            break;
        case "ACTIVATE_ROOM":
            this.publishPollEvents('view:created', null, msg.message.maestroObject);
            var currentRooms = this.dataStore.get('app.account.roomParticipations');
            this.dataStore.upsert('app.account.roomParticipations', currentRooms.concat(msg.message.maestroObject));
            this.publishPollEvents('view:show', null, {
                'streamId': msg.message.maestroObject.threadId,
                'module': 'chatroom'
            });
            break;
        case "CREATE_ROOM":
            var currentRooms = this.dataStore.get('app.account.roomParticipations');
            this.dataStore.upsert('app.account.roomParticipations', currentRooms.concat(msg.message.maestroObject));

            this.publishPollEvents('view:created', null, msg.message.maestroObject);
            this.publishPollEvents('view:show', null, {
                'streamId': msg.message.maestroObject.threadId,
                'module': 'chatroom'
            });
            break;
        case "LEAVE_ROOM":
            if (this.impactsCurrentUser(msg.message.affectedUsers)) {
                this.publishPollEvents('view:removed', null, msg.message.maestroObject.threadId);
                this.publishPollEvents('user:kicked', null, msg.message.maestroObject);

                var filteredRooms = _.reject(this.dataStore.get('app.account.roomParticipations'), function(room){ return room.threadId === msg.message.threadId; });
                this.dataStore.upsert('app.account.roomParticipations', filteredRooms);

            } else {
                this.publishPollEvents('room:membersUpdate:' + msg.message.maestroObject.threadId, null, msg.message.maestroObject);
            }
            break;
        case "DEACTIVATE_ROOM":
            this.publishPollEvents('view:removed', null, msg.message.threadId);
            if (this.isCurrentUser(msg.message.requestingUser)) {
                this.publishPollEvents('view:close', null, 'chatroom'+msg.message.threadId);
            }
            this.publishPollEvents('room:deactivated', null, msg.message);
            break;
        case "MEMBER_MODIFIED":
            // promote/demote user to owner
            if (this.impactsCurrentUser(msg.message.affectedUsers)) {
                var roomData = this.dataStore.get('app.account.roomParticipations'),
                    updatedRoomData = _.map(roomData, function (room) {
                        if (room.threadId === msg.message.maestroObject.threadId) {
                            return msg.message.maestroObject;
                        } else {
                            return room;
                        }
                    });

                this.dataStore.upsert('app.account.roomParticipations', updatedRoomData);
            }
            this.publishPollEvents('room:membermodified:'+msg.message.threadId, null, msg.message);
            break;
        case "UPDATE_ROOM":
            //seriously the sever cant return the full object?
            var roomData = this.dataStore.get('app.account.roomParticipations'),
                updatedRoomData = _.map(roomData, function (room) {
                    if (room.threadId === msg.message.maestroObject.threadId) {
                        return _.extend(room, {
                            name: msg.message.maestroObject.name,
                            readOnly: msg.message.maestroObject.readOnly,
                            discoverable: msg.message.maestroObject.discoverable,
                            copyDisabled: msg.message.maestroObject.copyDisabled,
                            memberAddUserEnabled: msg.message.maestroObject.memberAddUserEnabled,
                            description: msg.message.maestroObject.description
                        });
                    } else {
                        return room;
                    }
                });

            this.dataStore.upsert('app.account.roomParticipations', updatedRoomData);
            this.publishPollEvents('room:update', null, msg.message);
            break;
    }
};

LongPoll.prototype.handleInstantChat = function (msgWrapper) {
    var acct = this.dataStore.get('app.account'),
        haveChatData = _.findWhere(acct.pinnedChats, {threadId: msgWrapper.message.threadId}),
        imViewConfig = null,
        self = this;

    if (haveChatData) {
        self.dataStore.upsertMessages(msgWrapper.message.threadId, msgWrapper, false);
        return;
    }

    if (msgWrapper.message.from.id == acct.userName) {
        return;
    }

    //get the info, set the userViewConfig pinned status to true
    var roomData = this.transport.send({
        'id': 'IM_MANAGER_THREAD',
        'payload': {
            'threadid': msgWrapper.message.threadId
        }
    });

    roomData.done(function (rsp) {
        imViewConfig = _.findWhere(acct.userViewConfigs, {viewId: rsp.result.threadId});

        if (imViewConfig && imViewConfig.pinnedChat === true) {
            //this should never happen since it wasnt in the pinnedChats check above
            return;
        }

        if (!imViewConfig) {
            imViewConfig = {};
            imViewConfig.viewId = rsp.result.threadId;
            imViewConfig.viewType = 'IM';
            imViewConfig.clientType = config.CLIENT_VERSION;
            imViewConfig.config = {};
        }

        imViewConfig.pinnedChat = true; //no matter what

        //also update the pinnedChat array (it shouldnt be there yet)
        if (!_.findWhere(acct.pinnedChats, {'threadId': rsp.result.threadId})) {
            acct.pinnedChats.push(rsp.result);
            self.sandbox.setData('app.account.pinnedChats', acct.pinnedChats);
        }

        self.sandbox.setData('app.account.userViewConfigs', imViewConfig);

        self.sandbox.publish('view:created', null, rsp.result);
        //since previously the view is not created we need to publish increase count event again
        self.incrementNewMessageCounts([msgWrapper.message.threadId]);

        // decrypt will have always failed by this point so we need to re-call, see: SFE-180
        // note: this method will modify argument and contain decrypted text message
        
        self.crypto && self.crypto.decryptMessage(msgWrapper.message);        

        self.dataStore.upsertMessages(msgWrapper.message.threadId, msgWrapper, false);
    }, function (rsp) {

    });
};

module.exports = LongPoll;
