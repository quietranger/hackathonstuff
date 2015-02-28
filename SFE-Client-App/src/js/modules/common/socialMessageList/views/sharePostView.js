var Backbone = require('backbone');
var config = require('../../../../config/config');
var Handlebars = require("hbsfy/runtime");

var mixinPresence = require('../../mixins/presenceMixin');
var sharePostTmpl = require('../templates/sharePost.handlebars');
var showErrorMessage = require('../../mixins/showErrorMessage');
var textInput = require('../../textInput/textInput');

module.exports = Backbone.View.extend({
    className: 'share-post',
    initialize: function (opts) {
        this.opts = opts || {};
        this.sandbox = opts.sandbox;
        this.eventBus = _.clone(Backbone.Events);
    },
    events: {
        'click .cancel'     : 'close',
        'click .share'      : 'submit',
        'click .add-comment': 'addComment'
    },

    render: function () {
        var MessageView = require('./messageView');
        this.msgView = new MessageView({model: this.opts.message, sandbox: this.sandbox});

        this.msgView.render();

        this.$el.html(sharePostTmpl({})).find('.message-to-share').html(this.msgView.el);

        this.commentInput = new textInput({
            eventBus: this.eventBus,
            buttonText: 'SEND',
            placeholderText: 'Your comment',
            sandbox: this.sandbox,
            el: this.$el.find('.share-comment'),
            showButton: false,
            rteActions: [],
            sendOnEnter: false,
            maxlengthplacement: 'bottom'
        }).render().postRender();

        return this;
    },

    destroy: function(){
        this.msgView.destroy();
        this.remove();
    },
    close: function () {
        this.sandbox.publish('modal:hide');
    },
    submit: _.debounce(function(e) {
        var self = this;
        this.$el.find('.share').prop('disabled', true);


        this.sandbox.send({
        'id': 'SEND_CHAT',
        'payload': this.formatMessage(this.opts.message)
        }).then(function(){
            //TODO: Update message locally
            //self.sandbox.publish('delete:message', null, self.opts.message.get('messageId'));
            self.close();
        }, function(error){
            self.showErrorMessage(error.responseJSON.message);
            self.$el.find('.share').prop('disabled', false);
        });
    }, 1000, true),
    formatMessage: function (message) {
        var text = this.commentInput.getValue(), entities = this.commentInput.getEntitiesFromText(text);
        var ingestibleMessage = {
            sendingApp: "lc",
            messageDate: new Date().getTime(),
            externalOrigination: false,
            isPrivate: false,
            from: {
                userType: config.USER_TYPE.GS_USER,
                id: this.opts.userId
            },
            text: text,
            entities: entities,
            version: "SOCIALMESSAGE",
            threadId: this.opts.myProfileId,
            share: {
                previousMsgId: message.get('messageId'),
                message: {
                    /*if this is not first share, messageId= messageToShare.share.message.messageId, otherwise use messageToShare.id*/
                    messageId: message.get('share') ? message.get('share').message.messageId : message.get('messageId'),
                    version: "SOCIALMESSAGE"
                }
            }
        };
        return ingestibleMessage;
    },
    addComment: function() {
        this.$el.find('.share-comment').removeClass('hidden');
        this.$el.find('.title-wrap').addClass('hidden');
        this.eventBus.trigger('textinput:show');
        this.eventBus.trigger('textinput:parent:focused');
    }
});

_.extend(module.exports.prototype, showErrorMessage);
mixinPresence(module.exports);
