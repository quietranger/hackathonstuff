var Backbone = require('backbone');

var subscribable = require('./subscribable');

var defaults = {
    initialize: function () {
        this.presenceUsers = []; //array of concerned userIds
        this.presenceUsersMap = {}; //lookup map of userIds

        this.listenForPresenceElementAdded();

        var batchPresenceReq = function () {
            var self = this;

            self.sandbox.getPresenceForId(self.presenceUsers).done(function (rsp) {
                self.presenceRsp(null, rsp);
            });
        };

        this.throttledPresenceReq = _.debounce(batchPresenceReq, 250);

        this._sb_presencePsEvents = {
            'presence:changed': this.presenceRsp.bind(this),
            'presence:requestids': this.getIdsForPresence.bind(this)
        };

        this.bulkSubscribe(this._sb_presencePsEvents);
    },

    presenceRsp: function (context, presenceChangedMap) {
        // For every element with has-presence
        // if presenceMap has something for that id, change the class
        this.$el.find('.has-presence').each(function (i, elem) {
            var $elem = $(elem),
                userId = $elem.attr('data-userid'),
                newPresence = presenceChangedMap[userId];

            if (newPresence) {
                $elem.removeClass('presence-available presence-available-idle presence-busy presence-busy-idle presence-donotdisturb presence-berightback presence-away presence-offline presence-unknown');

                $elem.addClass('presence-' + newPresence.className);
                if ($elem.hasClass('presence-text')) {
                    $elem.text(newPresence.pretty);
                }
            }
        });
    },

    getIdsForPresence: function () {
        var self = this;

        this.presenceUsers = [];
        this.presenceUsersMap = {};

        this.$el.find('.has-presence').each(function (i, elem) {
            var userId = $(elem).attr('data-userid');
            if (userId) {
                self._pushPresenceUser(userId);
            }
        });

        this.throttledPresenceReq();
    },

    _presenceAddedEvent: function (e) {
        var $needPresence = $(e.target),
            userId = $needPresence.attr('data-userid');

        if (e.animationName === 'nodeInserted' && $needPresence && userId) {
            this._pushPresenceUser(userId);
            this.throttledPresenceReq();
        }
    },

    _pushPresenceUser: function(userId) {
        if (!this.presenceUsersMap[userId]) {
            this.presenceUsers.push(userId);
            this.presenceUsersMap[userId] = true;
        }
    },

    listenForPresenceElementAdded: function () {
        var self = this;
        if (this.$el.length != 0) {
            var event = self._presenceAddedEvent.bind(self);
            self.prefixEvent(this.$el[0], 'AnimationStart', event);
        }
    },


    destroy: function () {
        this.bulkUnsubscribe(this._sb_presencePsEvents);

        this.removePrefixEvent(this.$el[0], 'AnimationStart', this._presenceAddedEvent);

        this._sb_presencePsEvents = null;
    }
};

_.extend(defaults, subscribable);

module.exports = function (view) {
    var to = view.prototype;
    _.defaults(to, defaults);
    _.defaults(to.events, defaults.events);
    var oldInitialize = to.initialize,
        oldDestroy = to.destroy;

    to.initialize = function () {
        oldInitialize.apply(this, arguments);
        defaults.initialize.apply(this, arguments);
    };
    to.destroy = function () {
        oldDestroy.apply(this, arguments);
        defaults.destroy.apply(this, arguments);
    };
};