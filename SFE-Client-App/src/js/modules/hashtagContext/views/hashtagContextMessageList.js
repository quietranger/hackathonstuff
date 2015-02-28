var filterSocialMessageList = require('../../common/filterSocialMessageList/index');

var Utils = require('../../../utils/index');
var errors = require('../../../config/errors');

module.exports = filterSocialMessageList.extend({
    initialize: function(opts) {
        this.hashtag = opts.hashtag;

        filterSocialMessageList.prototype.initialize.call(this, opts);
    },

    loadInitialMessages: function() {
        var query = this.sandbox.send({
            id: 'MESSAGE_SEARCH',
            payload: {
                action: 'getmsgwithkeyword',
                from: 0,
                to: (new Date()).getTime(),
                maxrow: 51,
                connector: this.activeConnectorIds.join(','),
                keyword: this.hashtag
            }
        }), self = this;

        query.then(function(rsp) {
            var results;
            if (_.isArray(rsp)) {
                results = rsp;
            } else if (rsp.queryResults && rsp.queryResults[0] && rsp.queryResults[0].socialMessages) {
                results = Utils.flattenMessageResponse(rsp.queryResults[0].socialMessages, self.opts.currentUserId, true);
            }

            self.didLoadInitialMessages(results);
        }, function() {
            self.showErrorMessage(errors.HASHTAG_CONTEXT.LOAD_ERROR, 5000);
        });
    },

    loadMoreMessages: function() {
        if (this.isLoadingMoreMessages || !this.moreMessagesAvailable) {
            return;
        }

        this.isLoadingMoreMessages = true;
        this.setAutoloadIndicator('loading');

        var toTime = this.messageCollection.last() ? this.messageCollection.last().get('ingestionDate')-1 : new Date().getTime();
        var query = this.sandbox.send({
            id: 'MESSAGE_SEARCH',
            payload: {
                action: 'getmsgwithkeyword',
                from: 0,
                to: toTime,
                maxrow: 50,
                connector: this.activeConnectorIds.join(','),
                keyword: this.hashtag
            }
        }), self = this;

        query.then(function (messages) {
            self.didLoadMoreMessages(messages.queryResults[0].socialMessages);
        }, function (error) {
            self.moreMessagesAvailable = false;
            self.setAutoloadIndicator('unavailable');
            self.showErrorMessage(errors.HASHTAG_CONTEXT.LOAD_ERROR, 5000);
        });
    }
});