var socialMessageList = require('../socialMessageList/index');
var Utils = require('../../../utils');
var errors = require('../../../config/errors');

module.exports = socialMessageList.extend({
    initialize: function(opts) {
        this.connectorId = opts.connectorId || null;
        this.userId = opts.userId || null;

        socialMessageList.prototype.initialize.call(this, opts);
    },

    loadInitialMessages: function() {
        var query = this.sandbox.send({
            id: 'MESSAGE_SEARCH',
            payload: {
                action: 'getFromPost',
                from: 0,
                to: (new Date()).getTime(),
                maxrow: 51,
                fromuserid: this.userId,
                fromconnectorid: this.connectorId
            }
        });

        var self = this;
        query.then(function(rsp) {
            var messages = self._formatRsp(rsp);

            self.didLoadInitialMessages(messages);
        }, function() {
            self.showErrorMessage(errors.COMMON.EXTERNAL_SOCIAL_MESSAGE_LIST.LOAD_ERROR, 5000);
        });
    },

    loadMoreMessages: function() {
        var toTime = this.messageCollection.last() ? this.messageCollection.last().get('ingestionDate') - 1
                : new Date().getTime(),
            self = this;

        this.setAutoloadIndicator('loading');

        this.sandbox.send({
            id: 'MESSAGE_SEARCH',
            payload: {
                action: 'getFromPost',
                from: 0,
                to: toTime,
                maxrow: 51,
                fromuserid: this.userId,
                fromconnectorid: this.connectorId
            }
        }).then(function (rsp) {
            var messages = self._formatRsp(rsp);

            self.didLoadMoreMessages(messages);
        }, function () {
            //fail
            self.moreMessagesAvailable = false;
            self.setAutoloadIndicator('unavailable');
            self.showErrorMessage(errors.COMMON.EXTERNAL_SOCIAL_MESSAGE_LIST.LOAD_ERROR, 5000);
        });
    },

    didLoadMoreMessages: function (messages) {
        var self = this;

        if (!messages) {
            self.moreMessagesAvailable = false;
            self.setAutoloadIndicator('unavailable');
            return;
        }

        self.moreMessagesAvailable = (messages.length === 50);

        var models = self.messageCollection.add(messages);
        self.renderPreviousMessages(models);

        self.isLoadingMoreMessages = false;
    },

    _formatRsp: function(rsp) {
            var results = rsp.queryResults;
            if (results && results[0] && results[0].socialMessages) {
                results = Utils.flattenMessageResponse(results[0].socialMessages, '', true);
            }

        return results;
    }
});
