var Backbone = require('backbone');
var config = require('../../../config/config');
var errors = require('../../../config/errors');
var Q = require('q');
require('../helpers/index');
var showErrorMessage = require('../../common/mixins/showErrorMessage');
var messageCollection = require('./collections/messages');

module.exports = Backbone.View.extend({
    /*
     * @description: initialize message list view which can be used by modules to render a list of messages
     * @param opts: the options to init the view, e.g. {streamId: xxx}
     * */
    initialize: function (opts) {
        this.opts = opts || {};
        this.streamId = opts.streamId;
        this.parentViewId = opts.parentViewId || null;
        this.messageCollection = opts.messageCollection || new messageCollection();
        this.unreadMsgs = {};
        this.sandbox = opts.sandbox;
        this.eventBus = opts.eventBus || _.extend({}, Backbone.Events);
        this.isLoadingMoreMessages = (opts.isLoadingMoreMessages === undefined) ? false : opts.isLoadingMoreMessages;
        this.moreMessagesAvailable = (opts.moreMessagesAvailable === undefined) ? true : opts.moreMessagesAvailable;
        this.newestBottom = opts.newestBottom === undefined ? true : opts.newestBottom;
        this.autoLoadPx = opts.autoLoadPx || 16;
        this.type = opts.type;
        this.reaperAllowance = config.MSG_REAPER_ALLOWANCE;
        this.psEvents = {
            'delete:message': this.onDeleteMessage.bind(this)
        };
        this.psEvents['module:beforeResize:' + this.parentViewId ] = this.beforeModuleResize.bind(this);
        this.psEvents['module:afterResize:' + this.parentViewId ] = this.afterModuleResize.bind(this);
        if (opts.streamId) {
            this.psEvents['incoming:message:' + opts.streamId] = this.onReceiveMessage.bind(this);
        }

        this.messageViews = {};
        for (var subEvent in this.psEvents) {
            if (this.psEvents.hasOwnProperty(subEvent)) {
                this.sandbox.subscribe(subEvent, this.psEvents[subEvent]);
            }
        }

        if (!this.newestBottom) {
            this.messageCollection.comparator = function (model) {
                return -model.get('ingestionDate');
            }
        }

        _.bindAll(this, 'scrollTo');
        this.qLoadInitialMessages = Q.defer();
        this.loadInitialMessages();
        this.events = _.defaults({}, this.defaultEvents, this.events);
    },

    postRender: function () {
        if (!this.$scrollArea) {
            this.$scrollArea = this.$el.find('.messages-scroll');
        }

        this.$scrollArea.scroll(_.throttle(this.onScroll.bind(this), 100));
    },

    destroy: function () {
        for (var subEvent in this.psEvents) {
            if (this.psEvents.hasOwnProperty(subEvent)) {
                this.sandbox.unsubscribe(subEvent, this.psEvents[subEvent]);
                delete this.psEvents[subEvent];
            }
        }

        this.messageCollection.reset();
        this.destroyAllMessageViews();

        this.off();
        this.$scrollArea.off();
        this.remove();
    },
    destroyAllMessageViews: function () {
        for (var key in this.messageViews) {
            if (this.messageViews.hasOwnProperty(key)) {
                this.messageViews[key].destroy();
            }
        }

        this.messageViews = [];
    },
    isInViewPort: function ($element) {
        if (!$element || !($element instanceof jQuery))
            return false;
        var top = $element.position().top;
        return (top >= 0 && top <= this.$scrollArea.height());
    },
    onScroll: function (e) {
        var self = this;

        if(this.messageHistoryCleared) {
            this.messageHistoryCleared = false; //immediately clear this flag so new messages
            //scroll event fires when chat history is cleared, so don't repopulate the messages
            return;
        }

        //console.log('scrolling: '+self.messageCollection.models.length);
        if (!self.scrollToCalled && ((self.newestBottom && self.moreMessagesAvailable && self.isAtTop()) ||
            (!self.newestBottom && self.moreMessagesAvailable && self.isAtBottom()))) {
            self.loadMoreMessages();
        }
        self.scrollToCalled = false;

        var readReceipts = [], readMsgViews = [];
        Object.keys(self.unreadMsgs).forEach(function (msgId) {
            var view = self.messageViews[msgId];
            if (view && self.isInViewPort(view.$el)) {
                self.unreadMsgs[msgId].set('isRead', true, {silent: true});
                if (self.unreadMsgs[msgId].get('sendingApp') === 'lc') {
                    readReceipts.push({
                        messageId: msgId,
                        threadId: self.unreadMsgs[msgId].get('threadId')
                    });
                }
                readMsgViews.push(view);
                self.unreadMsgs[msgId] = null;
                delete self.unreadMsgs[msgId];
            }
        });
        self.sandbox.publish('message:read', null, readReceipts);
        setTimeout(function () {
            var view;
            while (view = readMsgViews.pop()) {
                view.$el.removeClass('unread');
            }
        }, 5000);
        var $newMsgIndicator = self.$el.find('.new-message-indicator'), quickMoveButton = self.$el.find('div.quick-move-button');
        if ((self.newestBottom && self.isAtBottom() || (!self.newestBottom && self.isAtTop()))) {
            $newMsgIndicator.addClass('hidden');
            $newMsgIndicator.find('.count').html('0');
            quickMoveButton.addClass('hidden');
            self.$scrollArea.removeClass('contrast-scroll-bar');
        } else {
            self.$scrollArea.addClass('contrast-scroll-bar');
            if (readReceipts.length > 0) {
                //update new message count if necessary
                var newCount = 0;
                for (var length = self.messageCollection.length - 1; length > 0; length--) {
                    if (self.messageCollection.at(length).get('isRead'))
                        break;
                    else
                        newCount++;
                }
                $newMsgIndicator.find('.count').html(newCount);
            }
            quickMoveButton.toggleClass('hidden', !$newMsgIndicator.hasClass('hidden'));
        }
    },
    /**
     * @description: scroll to top/bottom/DOM element
     * @param opts: an object contains 1. target: could be a string specify "top" or "bottom" or a jQuery DOM element.
     *  (optional) animate: animate or not
     */
    scrollTo: function (opts) {
        var scrollHeight = this.$scrollArea.prop('scrollHeight'),
            oldScrollTop = this.$scrollArea.scrollTop(),
            newScrollTop;

        if (opts.target === "bottom") {
            newScrollTop = scrollHeight;
        } else if (opts.target === "top") {
            newScrollTop = 0;
        } else if (opts.target instanceof jQuery) {
            var distToBottom, scrollAreaHeight = this.$scrollArea.height(), targetTop = opts.target.position().top;
            var lastMsg = this.$el.find('.chat-message:last');
            if (!lastMsg.length)
                lastMsg = this.$el.find('.message:last');
            if (scrollHeight > scrollAreaHeight && lastMsg.length) {
                //distToBottom should be the distance to the last message
                distToBottom = lastMsg.position().top - targetTop + lastMsg.height() + opts.target.height();
            } else {
                distToBottom = scrollAreaHeight - targetTop;
            }
            newScrollTop = scrollHeight - distToBottom;
        } else if (typeof(opts.target) === 'number') {
            newScrollTop = opts.target;
        } else {
            //invalid option, return
            return;
        }

        this.scrollToCalled = true;
        if (oldScrollTop === newScrollTop || scrollHeight === this.$scrollArea.prop('clientHeight')) {
            //1. jQuery won't trigger any event because the value doesn't change
            this.$scrollArea.scroll();
        } else {
            if (opts.animate) {
                this.$scrollArea.animate({
                    scrollTop: newScrollTop
                }, 300);
            } else {
                this.$scrollArea.scrollTop(newScrollTop);
            }
        }
    },
    isAtBottom: function () {
        var $scrollArea = this.$scrollArea,
            scrollHeight = $scrollArea.prop('scrollHeight'),
            clientHeight = $scrollArea.prop('clientHeight'),
            scrollPos = $scrollArea.scrollTop();

        return (scrollHeight - scrollPos - clientHeight <= 16);
    },
    isAtTop: function () {
        var $scrollArea = this.$scrollArea;
        return $scrollArea.scrollTop() <= this.autoLoadPx;
    },
    setAutoloadIndicator: function (state) {
        var $loadMore = this.$el.find('.load-more');

        if (state === 'loading') {
            $loadMore.children().addClass('hidden');
            $loadMore.children('.load-more-available').removeClass('hidden').toggleClass('loading', true);
        }

        if (state === 'available') {
            $loadMore.children().addClass('hidden');
            $loadMore.children('.load-more-available').removeClass('hidden').removeClass('loading');
        }

        if (state === 'unavailable') {
            //or should we hide the whole thing?
            $loadMore.children().addClass('hidden');
            $loadMore.children('.load-more-unavailable').removeClass('hidden');
        }
    },
    loadInitialMessages: function () {
        var self = this,
            query = this.sandbox.getData('messages.' + this.opts.streamId);
        self.messageCollection.reset();
        self.isLoadingMoreMessages = true;
        //store the result in our local cache (its already been added to the global ds)
        query.done(function (rsp) {
            self.didLoadInitialMessages(rsp);
            self.qLoadInitialMessages.resolve();
        }, function (error) {
            self.showErrorMessage(errors.COMMON.BASE_MESSAGES.LOAD_ERROR, 5000);
            self.qLoadInitialMessages.reject();
        });
    },
    didLoadInitialMessages: function (rsp) {
        if (rsp.length > 50) {
            this.setAutoloadIndicator('available');
            this.moreMessagesAvailable = true;
        } else {
            this.setAutoloadIndicator('unavailable');
            this.moreMessagesAvailable = false;
        }
        this.messageCollection.reset(rsp);
        var self = this;
        this.messageCollection.models.forEach(function (model) {
            if (!model.get('isRead') && model.get('version') == 'SOCIALMESSAGE' && !model.get('externalOrigination')) {
                self.unreadMsgs[model.get('messageId')] = model;
            }
        });
        for (var key in this.messageViews) {
            this.messageViews[key].destroy();
            this.messageViews[key] = null;
            delete this.messageViews[key];
        }
        this.renderMessages();
        self.isLoadingMoreMessages = false;
    },
    onReceiveMessage: function (context, message) {
        if (!this.messageCollection.get(message.messageId)) {
            //specify message is new
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
    },
    onDeleteMessage: function (context, msgId) {
        if (this.messageViews[msgId]) {
            this.messageViews[msgId].destroy();
            delete this.messageViews[msgId];
        }

        var msg = this.messageCollection.get(msgId);

        if (msg) {
            this.messageCollection.remove(msg);

            if (!msg.get('isRead')) {
                delete this.unreadMsgs[msgId];
            }
        }
    },
    scrollToBottom: function (e) {
        this.scrollTo({target: 'bottom'});
    },
    scrollToTop: function (e) {
        this.scrollTo({target: 'top'});
    },
    //the following are all no-ops by default, need to be override by sub-class
    render: function () {
        //render the main frame, should only be called once by layout.
        //All the DOM update should happen in other render function which will be called by this module
        return this;
    },
    beforeModuleResize: function (ctx, id) {
    },

    afterModuleResize: function (ctx, id) {
    },
    loadMoreMessages: function () {
    },
    renderMessages: function () {
        //render messages in the collection
    },
    renderNewMessage: function (message) {
        //render newly added message
    },
    renderPreviousMessages: function (opts) {
        //render newly added historical messages
    }
});

_.extend(module.exports.prototype, showErrorMessage);