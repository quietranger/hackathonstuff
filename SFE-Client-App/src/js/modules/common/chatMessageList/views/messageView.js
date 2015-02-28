/**
 * Created by slippm on 5/5/14.
 */
var Backbone = require('backbone');
var Handlebars = require("hbsfy/runtime");
var Symphony = require('symphony-core');
var HasInlineProfiles = require('../../mixins/hasInlineProfiles');

var chatMessageTmpl = require('../templates/chat-message.handlebars');
var maestroMessageTmpl = require('../templates/maestro-message.handlebars');
var readReceiptView = require('./readReceiptView.js');
var contentPreview = require('../../contentPreview/contentPreview');

Handlebars.registerHelper('parseReadReceipts', function (model) {
    var ret = '',
        keys = _.keys(model.imUsers);

    if (!model.isSender) {
        return ret;
    }

    if (keys.length === 2) {
        var otherUser = _.without(_.keys(model.imUsers), model.from.id)[0];
        if (_.contains(model.readBy, otherUser)) {
            ret = '<p class="read-receipt">Read</p>';
        } else if (_.contains(model.deliveredTo, otherUser)) {
            ret = '<p class="read-receipt">Delivered</p>';
        }

        return new Handlebars.SafeString(ret);
    }
});

Handlebars.registerHelper('friendlyFileSize', function(fileSizeInBytes){
    var i = -1,
        byteUnits = ['KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB'];
    do {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    } while (fileSizeInBytes > 1024);

    return Math.max(fileSizeInBytes, 0.1).toFixed(1) + byteUnits[i];
});

Handlebars.registerHelper('urlEncoded', function(messageId){
    return encodeURIComponent(messageId);
});

module.exports = Backbone.View.extend({
    className: 'chat-message',
    model: null,

    events: {
        'click .chat-time': 'getMessageReadState',
        'click .msg-entity.link': 'openLink',
        'click .attachment.content-preview': 'openLink',
        'click .msg-entity.hashtag': 'showHashtagContext',
        'click .chat-username, .msg-entity.person': 'openProfile',
        'mousedown .msg-entity.link': 'middleClickLink'
    },

    initialize: function (opts) {
        this.symphony = opts.symphony;
        this.sandbox = opts.sandbox;
        this.streamId = opts.streamId;
        this.eventBus = opts.eventBus || _.extend({}, Backbone.Events);
        this.imUsers = opts.imUsers || null;
        this.highlight = opts.highlight === undefined ? false : opts.highlight;
        this.currentUserId = opts.currentUserId || null;
        this.currentUserPrettyName = opts.currentUserPrettyName || null;
        this.canCall = opts.canCall;
        this.showName = true;
        this.showReadReceipt = opts.showReadReceipt === undefined ? true : opts.showReadReceipt;
        this.isSender = opts.isSender === undefined ? false : opts.isSender;
        this.showPresence = opts.showPresence === undefined ? true : opts.showPresence;
        this.oneToOneUserId = opts.oneToOneUserId;
        this.viewWidth = opts.viewWidth;
        this.viewId = opts.viewId;
        this.richContentViews = [];

        if (this.symphony && this.symphony.module) {
            delete this.events['click .msg-entity.hashtag'];
            delete this.events['click .chat-username, .msg-entity.person'];
        }

        this.initInlineProfiles();

        this._indexCache = null;

        this.calculateDisplayAttributes();

        this.listenTo(this.model, 'change:readBy', this.readByDidChange.bind(this));

        this.sandbox.subscribe('message:readreceipt', this.didReceiveReadReceipt.bind(this));
    },

    readByDidChange: function() {
        this.calculateDisplayAttributes();
        this.render();

        this.eventBus.trigger('message:readreceipt:rendered', this.model);
    },
    // Note: middle click seems to only happen in the wrapper app
    middleClickLink: function (e) {
        e.preventDefault();
        if (e.which === 2) {
            this.sandbox.publish('appBridge:fn', null, {
                fnName: 'openLink',
                param: {url: $(e.currentTarget).attr('href')}
            });
        }
    },
    didReceiveReadReceipt: function (ctx, data) {
        var rrMessageId = data[0].messageId,
            rrThreadId = data[0].threadId;

        if (rrThreadId === this.model.get('threadId')) {
            if (rrMessageId !== this.model.get('messageId')) {
                var didChange = this.calculateDisplayAttributes();

                if (didChange) {
                    this.render();
                }

                return;
            }

            var readBy = this.model.get('readBy') || [],
                deliveredTo = this.model.get('deliveredTo') || [];

            _.each(data, function (receipt) {
                if (receipt.readBy) {
                    readBy.push(receipt.readBy);
                }

                if (receipt.deliveredTo) {
                    deliveredTo.push(receipt.deliveredTo);
                }
            });

            this.model.set({
                readBy: readBy,
                deliveredTo: deliveredTo
            });
        }
    },

    getIndex: function() {
        var collection = this.model.collection, index;

        if (this._indexCache === null) {
            this._indexCache = index = collection.indexOf(this.model);
        } else {
            index = this._indexCache;
        }

        if (collection.at(index) !== this.model) { //in case of sort or load more
            this._indexCache = index = collection.indexOf(this.model);
        }

        return index;
    },

    calculateDisplayAttributes: function() {
        var collection = this.model.collection;

        if (!collection) {
            return;
        }

        var index = this.getIndex(),
            isSenderCache = this.isSender,
            showReadReceiptCache = this.showReadReceipt,
            showNameCache = this.showName,
            ret = false;

        if (collection && this.model.get('version') === 'SOCIALMESSAGE') {
            var prev = this.model.get('previousMessage') || collection.at(index - 1),
                next = collection.at(index + 1);

            if (this.currentUserId === this.model.get('from').id) {
                this.isSender = true;
            } else {
                this.showReadReceipt = false;
            }

            if (prev) {
                if (prev.get('version') === 'SOCIALMESSAGE'
                    && prev.get('from').id === this.model.get('from').id
                    && this.model.get('ingestionDate') < (prev.get('ingestionDate') + 40000)) {
                    this.showName = false;
                }
            }

            if (next) {
                if (next.get('version') === 'SOCIALMESSAGE'
                    && next.get('from').id === this.currentUserId
                    && next.get('from').id === this.model.get('from').id) {
                    this.showReadReceipt = false;
                }
            }
        }

        if (isSenderCache !== this.isSender || showReadReceiptCache !== this.showReadReceipt
            || showNameCache !== this.showName) {
            ret = true;
        }

        return ret;
    },

    render: function () {
        var template,
            self = this;

        //TODO: This is very inefficient, should use template to handle rendering. Every time we change class will cause browser to redraw the dom element
        if (this.model.get('version') === 'MAESTRO') {
            this.$el.addClass('maestro');
            template = maestroMessageTmpl;
        } else {
            if(this.model.get('isChime')) {
                this.$el.addClass('chime');
            }
            var fromId = this.model.get('from').id;

            if (!this.imUsers || _.keys(this.imUsers).length > 2) {
                this.$el.attr('data-userid', fromId).addClass('background-colorable');
            }

            template = chatMessageTmpl;
        }

        this.$el.attr('data-message-id', this.model.get('messageId'));
        this.$el.toggleClass('unread', !this.model.get('isRead'));
        this.$el.toggleClass('highlighted', this.highlight);

        this.$el.html(template(_.extend(this.model.toJSON(), {
            imUsers: this.imUsers,
            showName: this.showName,
            showPresence: this.showPresence,
            showReadReceipt: this.showReadReceipt,
            isSender: this.isSender,
            oneToOneUserId: this.oneToOneUserId,
            apiUrl: Symphony.Config.API_ENDPOINT
        })));

        if (this.model.toJSON().media != null)
        {
            var richCode = this.model.toJSON().media;
            if (richCode.mediaType = 'CODE')
            {
                var elem = this.$el.find('.richToken').eq(0);
                //todo:whinea - to support multiple tables, we need to iterate here
                try{
                    var richText = JSON.parse(richCode.content);
                    var opts = {
                        viewId: self.viewId,
                        viewWidth: self.viewWidth,
                        data: JSON.parse(richText[0].text)};
                    this.sandbox.renderUsingRichContentPlugins(elem.attr('plugin-name'), opts).then(function(response){
                        elem.append(response.el);
                        self.richContentViews.push(response);
                        self.eventBus.trigger('richContent:PostRender:' + self.viewId);
                    });
                } catch(e) {

                }
            }
        }
        return this;
    },

    getMessageReadState: function (evt) {
        var self = this;

        this.sandbox.send({
            id: 'GET_MESSAGE_READ_STATE',
            payload: {
                msgid: this.model.attributes.messageId
            }
        }).done(function (rsp) {
            var contentView = new readReceiptView({
                messageId: rsp.messageId,
                delivered: rsp.delivered,
                read: rsp.read,
                sent: rsp.sent,
                sandbox: self.sandbox,
                currentUserId: self.currentUserId
            });

            self.sandbox.publish('modal:show', null, {
                title: 'Message Status',
                contentView: contentView
            });
        });
    },

    showHashtagContext: function(e) {
        var $target = $(e.currentTarget);

        this.sandbox.publish('view:show', null, {
            module: 'hashtag-context',
            hashtag: $target.attr('data-value')
        });
    },

    openLink: function (e) {
        e.preventDefault();
        var url = $(e.currentTarget).attr('href');
        if (e.currentTarget.classList.contains('content-preview')) {
            this.sandbox.publish('modal:show', null, {
                'contentView': new contentPreview({
                    'url': url,
                    'filetype':url.split('.').pop(),
                    'download':$(e.currentTarget).attr('download'),
                    'sandbox': this.sandbox}),
                'isFlat': true,
                title: 'Preview'
            });
        }
        else {
            this.sandbox.publish('appBridge:fn', null, {
                fnName: 'openLink',
                param: {url: url}
            });
        }
    },

    openProfile: function(e) {
        var userId = null;

        if (e.currentTarget.dataset && e.currentTarget.dataset.userid) {
            userId = e.currentTarget.dataset.userid;
        } else if (this.el.dataset && this.el.dataset.userid) {
            userId = this.el.dataset.userid;
        } else if (this.model.get('from')) {
            userId = this.model.get('from').id;
        }

        if (!userId) {
            return;
        }

        this.sandbox.publish('view:show', null, {
            module: 'profile',
            userId: userId
        });
    },

    destroy: function () {
        this.model.set('previousMessage', null, { silent: true });
        _.each(this.richContentViews, function(view){
            view.destroy();
        });
        this.sandbox.unsubscribe('message:readreceipt');
        this.destroyInlineProfiles();
        this.remove();
    }
});

_.extend(module.exports.prototype, HasInlineProfiles);