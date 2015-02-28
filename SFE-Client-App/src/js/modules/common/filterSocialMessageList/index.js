var socialMessageList = require('../socialMessageList/index');
var Utils = require('../../../utils');
var errors = require('../../../config/errors');

module.exports = socialMessageList.extend({
    initialize: function (opts) {
        this.socialConnectors = opts.socialConnectors || null;
        this.activeConnectorIds = null;
        this.calculateActiveConnectors();

        socialMessageList.prototype.initialize.call(this, opts);

        var self = this;

        this.eventBus.on('connector:toggled', function () {
            self.calculateActiveConnectors();
            self.loadInitialMessages();
        });
    },

    calculateActiveConnectors: function () {
        var activeConnectorIds = _.pluck(_.filter(this.socialConnectors, function (con) {
            return con.active;
        }), 'id');

        this.activeConnectorIds = activeConnectorIds;
    },
    loadInitialMessages: function () {
        var eventName = 'incoming:message:' + this.opts.streamId,
            event = this.psEvents[eventName],
            query;

        this.sandbox.unsubscribe(eventName, event);

        if (this.socialConnectors) {
            if (this.activeConnectorIds.length == this.socialConnectors.length) {
                query = this.sandbox.getData('messages.' + this.opts.streamId)
            } else {
                query = this.sandbox.send({
                    id: 'QUERY_FILTER',
                    payload: {
                        from: 0,
                        to: (new Date()).getTime(),
                        maxrow: 51,
                        filterid: this.streamId,
                        connectorid: this.activeConnectorIds.join(',')
                    }
                });
            }
        } else {
            query = this.sandbox.getData('messages.' + this.opts.streamId);
        }

        var self = this;

        query.then(function (rsp) {
            var results;
            if (_.isArray(rsp)) {
                results = rsp;
            } else if (rsp.queryResults && rsp.queryResults[0] && rsp.queryResults[0].socialMessages) {
                results = Utils.flattenMessageResponse(rsp.queryResults[0].socialMessages, self.opts.currentUserId, true);
            }

            self.didLoadInitialMessages(results);
            self.sandbox.subscribe(eventName, event);
        }, function () {
            self.showErrorMessage(errors.COMMON.FILTER_SOCIAL_MESSAGE_LIST.LOAD_ERROR, 5000);
        });
    },

    onReceiveMessage: function (context, message) {
        if (!this.messageCollection.get(message.messageId)) {
            //specify message is new
            var msgSource = message.sendingApp;
            if(!_.contains(this.activeConnectorIds, msgSource)){
                return;
            }
            var model = this.messageCollection.add(message);
            if (!model.get('isRead') && model.get('version') == 'SOCIALMESSAGE' && !model.get('externalOrigination')) {
                this.unreadMsgs[model.get('messageId')] = model;
            }
            if (this.messageCollection.length > this.reaperAllowance) {
                var toRemove;

                if (this.newestBottom) {
                    toRemove = this.messageCollection.first();
                } else {
                    toRemove = this.messageCollection.last();
                }

                this.onDeleteMessage(null, toRemove.get('messageId'));
            }

            this.renderNewMessage(model);
        }
    }
});