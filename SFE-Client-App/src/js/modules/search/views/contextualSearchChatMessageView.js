var Backbone = require('backbone');
var Symphony = require('symphony-core');

var messageModel = require('../../common/baseMessages/models/message');

var messageView = require('../../common/chatMessageList/views/messageView');

var contextualSearchChatMessageTmpl = require('../templates/contextual-search-chat-message.handlebars');

require('../../common/helpers');

module.exports = Symphony.View.extend({
    className: 'contextual-search-chat-message',

    events: {
        'click .show-context': 'showContext'
    },

    initialize: function(opts) {
        Symphony.View.prototype.initialize.call(this, opts);

        if (!opts.match) {
            throw 'Contextual search chat message view instantiate without matching message.';
        }

        this.match = new messageModel(opts.match);
        this.before = opts.before || null;
        this.after = opts.after || null;
        this.messageViews = [];
        this.showContextLink = false;

        if (this.before) {
            this.before = new messageModel(this.before);
        }

        if (this.after) {
            this.after = new messageModel(this.after);
        }

        var self = this;
        this.accountDataPromise.then(function(rsp) {
            var collection = self.match.get('chatType') == 'INSTANT_CHAT' ? rsp.pinnedChats : rsp.roomParticipations;

            self.showContextLink = _.find(collection, function(item) {
                return item.threadId == self.match.get('threadId');
            });
        });
    },

    render: function() {
        this.$el.html(contextualSearchChatMessageTmpl({
            roomName: this.match.get('chatRoomName'),
            matchTimestamp: this.match.get('ingestionDate'),
            before: this.before,
            after: this.after,
            showContextLink: this.showContextLink
        }));

        var opts = {
            currentUserId: this.opts.currentUserId,
            sandbox: this.sandbox,
            streamId: this.match.get('threadId'),
            showPresence: false,
            showReadReceipt: false
        }, self = this;

        _.each([ this.before, this.match, this.after ], function(item) {
            if (item) {
                var view = new messageView(_.extend(opts, {
                    model: item,
                    highlight: item == self.match,
                    isSender: self.opts.currentUserId == item.get('from').id
                }));

                view.render();

                self.messageViews.push(view);
                self.$el.find('.messages').append(view.el)
            }
        });

        return Symphony.View.prototype.render.call(this);
    },

    showContext: function() {
        var module = this.match.get('chatType') === "INSTANT_CHAT" ? 'im' : 'chatroom';

        this.sandbox.publish('view:show', null, {
            module: module,
            streamId: this.match.get('threadId'),
            messageId: this.match.get('messageId'),
            action: 'showContext'
        });
    },

    destroy: function(){
        _.each(this.messageViews, function(view) {
            view.destroy();
        });

        Symphony.View.prototype.destroy.call(this);
    }
});
