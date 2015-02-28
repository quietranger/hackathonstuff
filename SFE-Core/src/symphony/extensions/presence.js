"use strict";
var Q = require('q');
var _ = require('underscore');

var presence = function (sandbox, transport) {
    this.transport = transport;
    this.sandbox = sandbox;
    this.presenceMap = {}; // userId -> presence object
    this.idsToFetch = [];
    this.presenceChangedMap = {};
    this.oldestAllowedPresenceMS = 20000; // 20 seconds is the oldest presence we'll keep

    this.sandbox.registerMethod('getPresenceForId', this.getPresenceForId.bind(this), true);

    var self = this;
    setInterval(function () {
        self.updateAllPresence(self);
    }, 30000); // update all presence items every 30 seconds

    setInterval(function () {
        self.cleanCache(self);
    }, 60000); // clean the cache once a minute
};

presence.prototype.updateAllPresence = function (self) {
    // Tell every listening module to re-request presence
    self.sandbox.publish("presence:requestids", null, null);
};

presence.prototype.cleanCache = function (self) {
    var now = new Date().getTime();
    _(self.presenceMap).each(function (value, key) {
        if (now - value.timeEntered > self.oldestAllowedPresenceMS) {
            delete self.presenceMap[key];
        }
    });
};

presence.prototype.getPresenceForId = function (userIds) {
    var users = Object.prototype.toString.call(userIds) === '[object Array]' ? userIds : [userIds],
        presenceRsp = {};

    for(var i = 0, len = users.length; i < len; i++) {
        var presence = this.presenceMap[users[i]];

        if (!presence || (new Date().getTime() - this.presenceMap[users[i]].timeEntered > this.oldestAllowedPresenceMS)) {
            this.getPresenceFromServer(users[i]);
        }

        if(presence) {
            presenceRsp[users[i]] = presence;
        }
    }

    return presenceRsp;
};

presence.prototype.fetchDebounce = _.debounce(function (self) {
    this.transport.send({
        'id': 'GET_PRESENCE',
        'payload': {
            'action': 'get',
            'userids': _.uniq(self.idsToFetch).join()
        }
    }).done(function (rsp) {
        _(rsp.result).each(function (presence) {
            var cachedPresence = self.presenceMap[presence.userId];
            if (cachedPresence) { // we're already tracking this user
                if (!self.presencesEqual(cachedPresence, presence)) {
                    self.triggerPresenceChanged(presence);
                }
            } else {
                self.triggerPresenceChanged(presence);
            }
        });

    });
    self.idsToFetch = [];
}, 250); // Maximum run of once per 1/4 second

presence.prototype.getPresenceFromServer = function (userId) {
    var self = this;
    self.idsToFetch.push(userId);
    this.fetchDebounce(this);
};

presence.prototype.triggerPresenceChanged = function (presence) {
    var self = this;
    // enrich with classname
    var presenceInfo = this.getPresenceInfo(presence);
    presence.className = presenceInfo.className;
    presence.pretty = presenceInfo.pretty;
    // put the new one into the cache
    presence.timeEntered = new Date().getTime();
    this.presenceMap[presence.userId] = presence;
    this.presenceChangedMap[presence.userId] = presence;
    // Send via PubSub
    this.publishDebounce(self);
};

presence.prototype.publishDebounce = _.debounce(function (self) {
    self.sandbox.publish('presence:changed', null, _.extend({}, self.presenceChangedMap));
    self.presenceChangedMap = {};
}, 250); // Maximum run of once per 1/4 second

presence.prototype.getPresenceInfo = function (presence) {
    if (presence.presence >= 18000) {
        return {
            className: "offline",
            pretty: "Offline"
        };
    } else if (presence.presence >= 15000) {
        return {
            className: "away",
            pretty: "Away"
        };
    } else if (presence.presence >= 9000) {
        return {
            className: "donotdisturb",
            pretty: "Do Not Disturb"
        };
    } else if (presence.presence >= 6000) {
        return {
            className: "busy",
            pretty: "Busy"
        };
    } else if (presence.presence >= 3000) {
        return {
            className: "available",
            pretty: "Available"
        };
    } else {
        return {
            className: "unknown",
            pretty: "Unknown"
        };
    }
}

presence.prototype.presencesEqual = function (presence1, presence2) {
    return presence1.presence == presence2.presence;
    // Later expand this to take augmented presence into account
};

module.exports = exports = presence;
