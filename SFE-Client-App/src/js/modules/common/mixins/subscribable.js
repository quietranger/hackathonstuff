module.exports = {
    bulkSubscribe: function (events) {
        if (!this._sb_psEvents) {
            this._sb_psEvents = {};
        }

        var keys = _.keys(events),
            self = this;

        _.each(keys, function (event) {
            if (self._sb_psEvents[event]) { //keep track of handlers to avoid double-subscribes
                self.sandbox.unsubscribe(event, self._sb_psEvents[event])
            }

            var handler = events[event];

            self.sandbox.subscribe(event, handler);

            self._sb_psEvents[event] = handler
        });
    },

    bulkUnsubscribe: function (events) {
        if (!this._sb_psEvents) {
            return;
        }

        var events = _.isEmpty(events) ? this._sb_psEvents : events, //unsub from all if no arguments
            keys = _.keys(events),
            self = this;

        _.each(keys, function (event) {
            // do nothing if already unsubscribed. pubsub.js will unsubscribe ALL handlers for the event if the
            // supplied handler is falsy. since bulkUnsubscribe shouldn't care how many times it is called, this
            // check is required.
            if (!self._sb_psEvents[event]) {
                return;
            }

            self.sandbox.unsubscribe(event, self._sb_psEvents[event]);

            delete self._sb_psEvents[event];
        });
    },

    prefixEvent: function (element, type, callback) {
        var pfx = ["webkit", "moz", "MS", "o", ""];

        for (var p = 0; p < pfx.length; p++) {
            if (!pfx[p]) type = type.toLowerCase();
            element.addEventListener(pfx[p] + type, callback, false);
        }
    },

    removePrefixEvent: function (element, type, cb) {
        var pfx = ["webkit", "moz", "MS", "o", ""];

        for (var p = 0; p < pfx.length; p++) {
            if (!pfx[p]) type = type.toLowerCase();
            element.removeEventListener(pfx[p] + type, cb);
        }
    }
};