/**
 * This mixin provides convenience methods for subscribing to/unsubscribing from
 * PubSub events in bulk. Meant to be mixed into another class.
 *
 * @mixin
 */
var Subscribable = {
    /**
     * Subscribe to all passed in events. Events should be passed in as a key-value hash where
     * values are either functions or a string corresponding to a class instance method.
     *
     * @param {object} events
     */
    subscribeAll: function(events) {
        var keys = _.keys(events),
            self = this;

        /**
         * Internal dictionary of events and their associated handlers.
         */
        if (!this._subscribed) {
            this._subscribed = {};
        }

        _.each(keys, function(event) {
            if (self._subscribed[event]) {
                return;
            }

            var handler = events[event];

            if (_.isString(handler)) {
                handler = self[handler];

                if (!_.isFunction(handler)) {
                    throw new Error('Attempted to subscribe event to' +
                        ' a non-existent or invalid handler');
                }

                handler = handler.bind(self);
            }

            self.sandbox.subscribe(event, handler);
            self._subscribed[event] = handler;
        });
    },

    /**
     * Unsubscribe from all passed in events. If no arguments provided, will
     * unsubscribe from all events in the _subscribed dictionary.
     *
     * @param {object} events
     */
    unsubscribeAll: function(events) {
        if (!this._subscribed) {
            return;
        }

        events = _.isEmpty(events) ? this._subscribed : events;

        var keys = _.keys(events),
            self = this;

        _.each(keys, function(event) {
            if (!self._subscribed[event]) {
                return;
            }

            self.sandbox.unsubscribe(event, self._subscribed[event]);
            delete self._subscribed[event];
        });
    }
};

module.exports = Subscribable;
