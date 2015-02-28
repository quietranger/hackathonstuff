var Backbone = require('backbone');

var config = require('../../../config/config');
var errors = require('../../../config/errors');
var viewTmpl = require('../templates/onbehalf.handlebars');
var Q = require('q');
var textInput = require('./textInput');
module.exports = Backbone.View.extend({
    className: 'onbehalfView',
    moduleName: 'onbehalf',
    sizeX: 12,
    sizeY: 8,
    events: {
        'click .post-onbehalf-submit': 'submit',
        'click .post-onbehalf-close': 'close'
    },
    initialize: function (opts) {
        var self = this;

        self.opts = opts || {};
        self.sandbox = opts.sandbox;
        self.$body = $('body');
        self.viewId = 'onbehalfView';
        self.userInfo = opts.userInfo;
        self.myId = opts.myId;
        self.eventBus = opts.eventBus;
        this.listenTo(this.eventBus, 'input:overcount:change', this.onInputOverCountChange);
    },

    render: function () {
        this.$el.html(viewTmpl(this.userInfo));
        this.textInput = new textInput({
            eventBus: this.eventBus,
            showButton: false,
            placeholderText: 'Compose a message...',
            sandbox: this.sandbox,
            /*threadId: this.streamId,
            userId: self.userId,*/
            className: 'post-on-behalfof-input',
            rteActions: ['emoticons', 'attach', 'disable'],
            sendOnEnter: false
        });
        this.$el.find('.obo-compose').append(this.textInput.render().$el);
        return this;
    },
    postRender: function () {
        this.textInput.postRender();
    },
    destroy: function(){
      if(this.textInput && this.textInput.destroy)
          this.textInput.destroy();
    },
    onInputOverCountChange: function(){
        this.$el.find('.post-onbehalf-submit').toggleClass('disabled', this.textInput.overCount);
    },
    submit: function () {
        var self = this,
            inputText = this.textInput.getValue(),
            payload = null,
            threads = $('.post-onbehalf-target').val(),
            requests = [];

        if (inputText === '') {
            return;
        }

        for (var idx in threads) {
            if (self.textInput.uploadFiles.length) {
                payload = _.extend(self.formatMessage(inputText, threads[idx]), {
                    'attachments': self.textInput.uploadFiles
                });
            } else {
                payload = self.formatMessage(inputText, threads[idx]);
            }

            requests[idx] = this.sandbox.send({
                'id': 'SEND_CHAT',
                'payload': payload
            });
        }
        Q.all(requests)
            .then(function () {
                self.eventBus.trigger('profile:obosent');
                self.textInput.mentionsCache = {};
                self.close();
            })
            .fail(function (error) {
                console.error(error + errors.ON_BEHALF.OBO + inputText);
            });
    },
    formatMessage: function (messageText, threadId) {
        var entities = this.textInput.getEntitiesFromText(messageText);
        var ingestibleMessage = {
            sendingApp: "lc",
            messageDate: new Date().getTime(),
            externalOrigination: false,
            isPrivate: false,
            from: {
                userType: config.USER_TYPE.GS_USER,
                id: this.userInfo.person.id
            },
            oboDelegate: {
                userType: config.USER_TYPE.GS_USER,
                id: this.myId
            },
            text: messageText,
            entities: entities,
            version: "SOCIALMESSAGE",
            threadId: threadId,
            media: null
        };

        return ingestibleMessage;
    },
    close: function () {
        this.sandbox.publish('modal:hide');
    },
    exportJson: function () {
        return _.extend({}, {
            module: 'onbehalf',
            sizeX: this.sizeX,
            sizeY: this.sizeY
        });
    }

});
