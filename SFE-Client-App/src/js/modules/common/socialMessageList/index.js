/**
 * Created by slippm on 4/18/14.
 */

var Backbone = require('backbone');
var Handlebars = require('hbsfy/runtime');
var baseMessages = require('../baseMessages/index');
var Message = require('../baseMessages/models/message.js');
var messageView = require('./views/messageView');

var Q = require('q');
var socialMsgTmpl = require('./templates/social-message.handlebars');
var enumSocialMsgTmpl = require('./templates/enum-social-messages.handlebars');
var SocialMsgContainerTmpl = require('./templates/social-messages-container.handlebars');
var utils = require('../../../utils');
var moment = require('moment');
var errors = require('../../../config/errors');

Handlebars.registerPartial('social-message', socialMsgTmpl);
Handlebars.registerPartial('enum-social-messages', enumSocialMsgTmpl);

module.exports = baseMessages.extend({
    className: 'social-messages',
    events: {
        'click .new-message-indicator': 'scrollToTop',
        'click .quick-move-button': 'scrollToTop',
        'click .load-more-available': 'loadMoreMessages'
    },

    /*
     * @description: Initialize socialmessage list view which can be used by modules to render a list of social messages
     *               for filters/profile/channel
     * @param opts: the options to init the view, e.g. {streamId: xxx, sandbox: sandbox, type: {social-filter, social-thread}}
     * */
    initialize: function (opts) {
        opts.newestBottom = false;
        baseMessages.prototype.initialize.call(this, opts);
        this.sandbox = opts.sandbox;
        this.streamMap = opts.streamMap || {};
        var self = this;

        this.eventBus.on('settings:saved', function (changed) {
            if (changed === true || changed === undefined) {
                self.messageCollection.reset();
                self.loadInitialMessages();
            }
        });
        this.updateElemRelativeTime = this.startTimeUpdater.bind(this);
    },
    beforeModuleResize: function (ctx, args) {
//        console.log('before resize:'+this.parentViewId);
        this.isAtTopBeforeResize = this.isAtTop();
    },

    afterModuleResize: function (ctx, args) {
//        console.log('after resize:'+this.parentViewId);
        if (this.isAtTopBeforeResize) {
            _.delay(this.scrollTo, 250, {target: 'top'});
        }
    },
    scrollToTop: function () {
        this.scrollTo({target: 'top'});
    },
    render: function () {
        this.$el.html(SocialMsgContainerTmpl({ messages: null }));
        this.$scrollArea = this.$el.find('.messages-scroll');
        return this;
    },
    postRender: function () {
        baseMessages.prototype.postRender.call(this);
        this.startTimeUpdater();
    },
    destroy: function () {
        clearTimeout(this.timeUpdater);
        this.updateElemRelativeTime = null;

        baseMessages.prototype.destroy.call(this);
    },
    renderNewMessage: function (message) {
        var elements = this._renderItemViews([message]);
        this.$el.find('.messages-scroll .content').prepend(elements);
        if (!this.isAtTop()) {
            //update new message count
            var $newMsgIndicator = this.$el.find('div.new-message-indicator'),
                $countSpan = $newMsgIndicator.find('.count');
            var count = parseInt($countSpan.text(), 10);
            count += 1;
            $countSpan.html(count);
            $newMsgIndicator.removeClass('hidden');
            this.$el.find('div.quick-move-button').addClass('hidden');
        } else {
            this.scrollTo({
                target: 'top'
            });
        }
    },
    renderMessages: function () {
        //messages ordered properly via opts.newestBottom
        var elements = this._renderItemViews(this.messageCollection.models);
        this.$el.find('.messages-scroll .content').html(elements);
        if (this.moreMessagesAvailable) {
            this.setAutoloadIndicator('available');
        } else {
            this.setAutoloadIndicator('unavailable');
        }
        this.scrollTo({target: 'top'});
    },
    _renderItemViews: function (messages) {
        var fragment = document.createDocumentFragment(),
            self = this;

        _.each(messages, function (model) {
            //enrich message model to add stream
            var localStream = self.streamMap[model.get('threadId')];
            model.set('localStream', localStream);
            if (localStream || model.get('chatType') === "INSTANT_CHAT")
                model.set('hasContext', true);
            var view = new messageView({
                model: model,
                sandbox: self.sandbox,
                currentUserId: self.opts.currentUserId,
                canCall: self.opts.canCall,
                viewId: self.parentViewId
            });

            // if it's a social feed message
            if (self.opts.socialConnectors) {
                var shouldRenderMessage = _.find(self.opts.socialConnectors, function (connector) {
                    if (model.get('sendingApp') === connector.id && connector.active) {
                        return connector;
                    }
                });

                if (shouldRenderMessage) {
                    self.messageViews[model.get('messageId')] = view;

                    view.render();

                    fragment.appendChild(view.el);
                }
            } else {
                self.messageViews[model.get('messageId')] = view;

                view.render();

                fragment.appendChild(view.el);
            }
        });

        return fragment;
    },
    renderPreviousMessages: function (messages) {
        var elements = this._renderItemViews(messages);
        this.$el.find('.messages-scroll .content').append(elements);

        if (this.moreMessagesAvailable) {
            this.setAutoloadIndicator('available');
        } else {
            this.setAutoloadIndicator('unavailable');
        }
        //trigger scroll event, don't need to adjust scroll bar position
        this.$scrollArea.scroll();
    },
    startTimeUpdater: function () {
        _(this.$el.find('div.content div.social-message time')).each(function (elem) {
            var dateString = moment(parseInt($(elem).attr('data-timestamp'))).fromNow();
            $(elem).text(dateString);
        });
        this.timeUpdater = setTimeout(this.updateElemRelativeTime, 60000); // updateTimes each minute
    },

    loadMoreMessages: function () {
        var self = this;
        if (this.isLoadingMoreMessages || !this.moreMessagesAvailable) {
            return;
        }
        this.isLoadingMoreMessages = true;
        this.setAutoloadIndicator('loading');
        var qMsgReceived = Q.defer(),
            toTime = this.messageCollection.last() ? this.messageCollection.last().get('ingestionDate') - 1 : new Date().getTime();

        var activeConnectorIds = _.map(_.filter(this.socialConnectors, function(con) {
            return con.active;
        }), function(con) {
            return con.id;
        });

        if (this.opts.type === "social-thread") {
            this.sandbox.send({
                'id': 'QUERY_THREAD_HISTORY',
                'payload': {
                    'from': '0',
                    'to': toTime,
                    'limit': 50,
                    'id': this.streamId
                }
            }).then(function (rsp) {
                qMsgReceived.resolve(rsp.envelopes);
            }, function (error) {
                qMsgReceived.reject(error);
            });
        } else {
            this.sandbox.send({
                id: 'QUERY_FILTER',
                payload: {
                    maxrow: 50,
                    filterid: this.streamId,
                    from: 0,
                    to: toTime,
                    connectorid: activeConnectorIds.join(',')
                }
            }).then(function (rsp) {
                qMsgReceived.resolve(rsp.queryResults[0].socialMessages);
            }, function (error) {
                qMsgReceived.reject(error)
            });
        }

        qMsgReceived.promise.then(function (messages) {
            self.didLoadMoreMessages(messages);
        }, function (error) {
            //fail
            self.moreMessagesAvailable = false;
            self.setAutoloadIndicator('unavailable');
            self.showErrorMessage(errors.COMMON.SOCIAL_MESSAGE_LIST.LOAD_ERROR, 5000);
        });

    },

    didLoadMoreMessages: function (messages) {
        var self = this;

        if (!messages) {
            self.moreMessagesAvailable = false;
            self.setAutoloadIndicator('unavailable');
            return;
        }
        self.moreMessagesAvailable = (messages.length == 50);
        //de-dup messages
        var msgs = _.uniq(messages, true, function (msgWrapper, idx, list) {
            return msgWrapper.message.messageId;
        });
        msgs = utils.flattenMessageResponse(msgs, self.opts.currentUserId, true);
        var models = self.messageCollection.add(msgs);
        models.forEach(function (model) {
            if (!model.get('isRead') && model.get('version') == 'SOCIALMESSAGE') {
                self.unreadMsgs[model.get('messageId')] = model;
            }
        });
        self.renderPreviousMessages(models);
        self.isLoadingMoreMessages = false;
    }
});
