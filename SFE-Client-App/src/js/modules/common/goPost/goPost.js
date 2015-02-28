var Backbone = require('backbone');
var Handlebars = require('hbsfy/runtime');
var Utils = require('../../../utils');
var config = require('../../../config/config');
var Q = require('q');
var _ = require('underscore');

var textInputView = require('../textInput/textInput');
var goPostTmpl = require('./templates/go-post.handlebars');

module.exports = Backbone.View.extend({
    events: {
        'click .cancel': 'close',
        'click .close-errors': 'didClickCloseErrors',
        'click .send': 'send'
    },

    keyboardEvents: {
        'esc': 'close'
    },

    initialize: function(opts) {
        var self = this;

        this.sandbox = opts.sandbox;
        this.eventBus = opts.eventBus || _.extend({}, Backbone.Events);
        this.isDisabled = true;
        this.opts = opts || {};
        this.qProfileInfo = Q.defer();

        self.sandbox.getData('app.account').then(function (rsp) {
            self.didGetAccountData(rsp);
        });

        this.listenTo(this.eventBus, 'input:event', _.debounce(this.toggleDisabled.bind(this)));
        this.listenTo(this.eventBus, 'textinput:sent', this.close.bind(this));
    },

    didGetAccountData: function(rsp) {
        _.extend(this.opts, {account: rsp});

        this.qProfileInfo.resolve();
    },

    render: function() {
        var self = this;

        this.qProfileInfo.promise.then(function () {
            self.textInputView = new textInputView({
                sandbox: self.sandbox,
                eventBus: self.eventBus,
                showButton: false,
                placeholderText: "What's on your mind?",
                maxLength: 140,
                enableFileUpload: true,
                sendOnEnter: true,
                threadId: self.opts.account.myCurrentThreadId,
                userId: self.opts.account.userName,
                rteActions: []
            });

            self.$el.html(goPostTmpl());
            self.textInputView.setElement(self.$el.find('.message'));
            self.textInputView.render().postRender();
        });

        return this;
    },

    postRender: function() {
        var self = this;

        this.qProfileInfo.promise.then(function() {
            self.eventBus.trigger('textinput:parent:focused');
        });
    },

    toggleDisabled: function() {
        if(this.textInputView) {
            this.isDisabled = this.textInputView.getValue().trim().length === 0;
            this.$el.find('.send').toggleClass('disabled', this.isDisabled).toggleClass('positive', !this.isDisabled);
        }
    },
    send: function() {
        this.eventBus.trigger('input:send');
    },
    destroy: function() {
        this.textInputView.destroy();
        this.textInputView = null;

        this.remove();
    },
    close: function() {
        this.sandbox.publish('modal:hide');
    }
});
