var Backbone = require('backbone');
var config = require('../../../../config/config');
var showErrorMessage = require('../../../common/mixins/showErrorMessage');
var readReceiptTmpl = require('../templates/read-receipt.handlebars');

module.exports = Backbone.View.extend({
    className: 'read-receipt-modal',

    events: {
        'click .submit': 'close'
    },

    initialize: function(opts) {
        this.messageId = opts.messageId;
        this.sandbox = opts.sandbox;
        this.currentUserId = opts.currentUserId;
        this.states = {
            sent: [],
            delivered: [],
            read: []
        };

        this._index = {};

        var states = ['sent', 'delivered', 'read'],
            self = this;

        _.each(states, function(state) {
            var index = _.indexBy(opts[state], 'userId');

            self._index[state + 'Index'] = index;
            self._index[state + 'Ids'] = _.keys(index);
        });

        this._index.deliveredIds = _.difference(this._index.deliveredIds, this._index.readIds);
        this._index.sentIds = _.difference(this._index.sentIds, this._index.deliveredIds, this._index.readIds);

        _.each(states, function(state) {
            var obj = self.states[state],
                idx = self._index[state + 'Index'],
                ids = self._index[state + 'Ids'];

            _.each(ids, function(id) {
                var rr = idx[id];

                rr.timestamp = parseInt(rr.timestamp);

                obj.push(rr);
            });
        });

        this.render();
    },

    render: function() {
        this.$el.html(readReceiptTmpl(this.states));
        return this;
    },

    close: function() {
        this.sandbox.publish('modal:hide');
    }
});