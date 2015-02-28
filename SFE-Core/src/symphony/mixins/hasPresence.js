var PrefixEvents = require('../utils/prefixEvents');

/**
 * Mixin for presence updates.
 *
 * @requires module:Utils/PrefixEvents
 * @requires Subscribable
 * @deprecated
 * @mixin
 */
var HasPresence = {
    /**
     * Internal map of PubSub events required for presence.
     *
     * @private
     */
    _presencePsEvents: {
        'presence:changed': 'presenceDidChange',
        'presence:requestids': 'presenceDidRequestIds'
    },

    /**
     * Array of users that require presence updates within this class.
     *
     * @private
     */
    _presenceUsers: [],

    /**
     * Map of users that require presence updates.
     *
     * @private
     */
    _presenceUsersMap: {},

    /**
     * Initialize presence for this view. Prefixes events to the nodeInserted animation and batches a request
     * to the backend to grab initial presence data. Also sets up some throttled update functions.
     */
    initPresence: function () {
        var self = this;

        PrefixEvents.addPrefixEvent(this.el, 'AnimationStart', this._presenceElementAdded.bind(this));

        var batchPresenceReq = function () {
            self.sandbox.getPresenceForId(self._presenceUsers).then(function (rsp) {
                self.presenceDidChange(null, rsp);
            });
        };

        this.throttledPresenceReq = _.debounce(batchPresenceReq, 250);
        this.subscribeAll(this._presencePsEvents);
    },

    /**
     * Callback function for when presence changes.
     *
     * @param context
     * @param presenceChangedMap
     */
    presenceDidChange: function (context, presenceChangedMap) {
        // For every element with has-presence
        // if presenceMap has something for that id, change the class
        this.$el.find('.has-presence').each(function (i, elem) {
            var $elem = $(elem),
                userId = $elem.attr('data-userid'),
                newPresence = presenceChangedMap[userId];

            if (newPresence) {
                $elem.removeClass('presence-available presence-available-idle presence-busy presence-busy-idle ' +
                    'presence-donotdisturb presence-berightback presence-away presence-offline presence-unknown');

                $elem.addClass('presence-' + newPresence.className);
                if ($elem.hasClass('presence-text')) {
                    $elem.text(newPresence.pretty);
                }
            }
        });
    },

    /**
     * Callback function to reset tracked users.
     */
    presenceDidRequestIds: function () {
        var self = this;

        this._presenceUsers = [];
        this._presenceUsersMap = {};

        this.$el.find('.has-presence').each(function (i, elem) {
            var userId = $(elem).attr('data-userid');
            if (userId) {
                self._pushPresenceUser(userId);
            }
        });

        this.throttledPresenceReq();
    },

    /**
     * Callback function for when a presence element is added to the DOM.
     *
     * @param e
     * @private
     */
    _presenceElementAdded: function (e) {
        var $needPresence = $(e.target),
            userId = $needPresence.attr('data-userid');

        if (e.animationName === 'nodeInserted' && $needPresence && userId) {
            this._pushPresenceUser(userId);
            this.throttledPresenceReq();
        }
    },

    /**
     * Push a user into the presence users array and map. Essentially register a user for presence tracking.
     *
     * @param userId
     * @private
     */
    _pushPresenceUser: function(userId) {
        if (!this._presenceUsersMap[userId]) {
            this._presenceUsers.push(userId);
            this._presenceUsersMap[userId] = true;
        }
    },

    /**
     * Unbind all presence events and erase tracked user data.
     */
    destroyPresence: function () {
        this.unsubscribeAll(this._presencePsEvents);

        PrefixEvents.removePrefixEvent(this.el, 'AnimationStart', this._presenceElementAdded);

        this._presenceUsers = [];
        this._presenceUsersMap = {};
    }
};

module.exports = HasPresence;
