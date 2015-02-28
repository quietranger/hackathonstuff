/**
 * Created by slippm on 5/5/14.
 */
var Symphony = require('symphony-core');
var HasInlineProfiles = require('../../mixins/hasInlineProfiles');
var socialMessageTmpl = require('../templates/social-message.handlebars');
var twitterMessageTmpl = require('../templates/twitter-message.handlebars');
var sharedByListView = require('./sharedByListView');
var sharePostView = require('./sharePostView');
var deletePostView = require('./deletePostView');
var contentPreview = require('../../contentPreview/contentPreview');

require('../../helpers/index');

module.exports = Symphony.View.extend({
    className: 'message social-message',

    model: null,

    requiresAccountData: false,

    events:{
        'click .msg-entity.link': 'openLink',
        'click .attachment.content-preview': 'openLink',
        'mousedown .msg-entity.link': 'middleClickLink',
        'click .msg-entity.hashtag': 'showHashtagContext',
        'click .person': 'openProfile',
        'click .stream-link': 'showStream',
        'click .context': 'showContext',
        'click .shared_by': 'sharedBy',
        'click .share': 'sharePost',
        'click .like': 'likePost',
        'click .delete': 'deletePost'
    },

    initialize: function(opts) {
        Symphony.View.prototype.initialize.apply(this, arguments);

        this.opts = opts;
        this.listenTo(this.model, 'change', this.render);
        this.viewWidth = opts.viewWidth;
        this.initInlineProfiles();
    },

    render: function() {
        this.$el.attr('data-message-id', this.model.get('messageId'));
        var isTwitterMsg = (this.model.get('sendingApp') === 'tw');
        if(!this.model.get('isRead') && !(isTwitterMsg && this.model.get('historical'))){
            //don't show unread for twitter historical message (since we don't send rr for twitter messages)
            this.$el.addClass('unread');
        }else{
            this.$el.removeClass('unread');
        }
        var template = isTwitterMsg ? twitterMessageTmpl : socialMessageTmpl;

        var tmplOpts = _.extend({ apiUrl: Symphony.Config.API_ENDPOINT }, this.opts, this.model.toJSON()), shareCount = this.model.get('shareCount');
        if(shareCount > 99){
            shareCount = '99+';
        }
        if(shareCount) {
            //control the width of the sharecount circle
            tmplOpts.shareCount = shareCount;
            tmplOpts.shareCountWidth = shareCount.toString().length;
        }
        this.$el.html(template(tmplOpts));

        this.initTooltips();

        var richCode = this.model.attributes.media;
        if (!richCode && !!this.model.attributes.share)
        {
            richCode = this.model.attributes.share.message.media;
        }
        if (richCode != null)
        {
            if (richCode.mediaType = 'CODE')
            {
                var elem = this.$el.find('.richToken').eq(0);
                //todo:whinea - to support multiple tables, we need to iterate here
                try{
                    var richText = JSON.parse(richCode.content);
                    var opts = {
                        viewId: this.viewId,
                        data: JSON.parse(richText[0].text),
                        viewWidth: self.viewWidth,
                        renderOnlyToken: true};
                    this.sandbox.renderUsingRichContentPlugins(elem.attr('plugin-name'), opts).then(function(response){
                        elem.append(response.el);
                    });
                } catch(e) {

                }
            }
        }

        return Symphony.View.prototype.render.apply(this, arguments);
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

    showStream: function(e) {
        var target = $(e.currentTarget);

        this.sandbox.publish('view:show', null, {
            'streamId': target.attr('data-streamId'),
            'module': target.attr('data-module')
        });
    },
    showContext: function() {
//        this.sandbox.publish('view:show', null, {
//            module: 'message-context',
//            streamId: this.model.get('threadId'),
//            messageId: this.model.get('messageId'),
//            isIm: this.model.get('chatType') === "INSTANT_CHAT"
//        });
        var isIm = this.model.get('chatType') === "INSTANT_CHAT", module = isIm ? 'im' : 'chatroom';
        this.sandbox.publish('view:show', null, {
            module: module,
            streamId: this.model.get('threadId'),
            messageId: this.model.get('messageId'),
            action: 'showContext'
        });
    },
    
    destroy: function() {
        this.destroyTooltips();
        this.destroyInlineProfiles();
        
        Symphony.View.prototype.destroy.apply(this, arguments);
    },

    openProfile: function(e) {
        var target = $(e.currentTarget),
            userId = target.attr('data-userid');

        var map = {
            lc: 'profile',
            system: 'profile',
            tw: 'twitter-profile'
        }, module = map[target.attr('data-usertype')];

        if (!module || !userId) {
            return;
        }

        this.sandbox.publish('view:show', null, {
            'userId': userId,
            'module': module
        });
    },

    showHashtagContext: function(e) {
        var $target = $(e.currentTarget);

        this.sandbox.publish('view:show', null, {
            module: 'hashtag-context',
            hashtag: $target.attr('data-value')
        });
    },

    sharedBy: function (e) {
        var self = this,
            messageId = $(e.currentTarget).parents('.message').attr('data-message-id');
        this.sandbox.publish('modal:show', null, {
            title: 'Message shares',
            contentView: new sharedByListView({
                'messageId': messageId,
                'sandbox': self.sandbox
            })
        });

    },

    sharePost: function (e) {
        this.sandbox.publish('modal:show', null, {
            isFlat: true,
            title: 'Share this Post',
            contentView: new sharePostView({
                'message': this.model,
                'sandbox': this.sandbox,
                'userId': this.opts.currentUserId,
                'myProfileId': this.opts.currentUserProfileId
            })
        });
    },

    deletePost: function (e) {
        this.sandbox.publish('modal:show', null, {
            title: 'Delete Message',
            contentView: new deletePostView({
                'message': _.extend({}, this.model),
                'sandbox': this.sandbox
            })
        });
    },

    likePost: function() {
        //send the like request
        //update the count manually by one
    }
});

_.extend(module.exports.prototype, HasInlineProfiles);
_.extend(module.exports.prototype, Symphony.Mixins.Tooltipable);
