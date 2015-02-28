//dependencies
var Symphony = require('symphony-core');
var Q = require('q');
var Handlebars = require('hbsfy/runtime');

//templates
var easyPostTmpl = require("../templates/easy-post.handlebars");

//views
var TextInputView = require("../../common/textInput/textInput");

module.exports = Symphony.View.extend({
    id: "easy-post",

    initialize: function (opts) {
        Symphony.View.prototype.initialize.apply(this, arguments);
        this.streamId = opts.streamId;
        this.userId = opts.userId;
        this.eventBus = opts.eventBus;

        this.textInputView = new TextInputView({
            eventBus: this.eventBus,
            showButton: true,
            placeholderText: "Message...",
            sandbox: this.sandbox,
            userId: this.userId,
            streamId: this.streamId,
            className: 'post-compose textarea-input',
            rteActions: ['emoticons', 'attach'],
            expandDirection: 'l',
            maxlengthplacement: 'bottom'
        });

        this.listenTo(this.eventBus, 'textinput:sent', this.destroy);
    },

    render: function () {
        this.$el.html(easyPostTmpl());
        this.$el.find(".easy-post-editor").html(this.textInputView.render().postRender().el);
        Symphony.View.prototype.render.apply(this, arguments);
    },

    postRender: function () {
        this._showEasyPost();

        Symphony.View.prototype.postRender.apply(this, arguments);
    },

    destroy: function () {
        console.log('destroy');
        this.eventBus.trigger("easyPost:destroy");
        this.textInputView.destroy();
        Symphony.View.prototype.destroy.apply(this, arguments);
    },

    // events

    events: {
        "click #easy-post-cancel": "destroy",
        "click #easy-post-submit": "_postMessage"
    },

    _postMessage: function () {
        this.eventBus.trigger('input:send');
    },

    _showEasyPost: function () {
        this.$el.css("display", "block");
        this._focusTextInput();
    },

    _focusTextInput: function () {
        this.textInputView.qRendered.promise.done(function () {
            this.textInputView.$el.find("[contenteditable=true]").first().focus();
        }.bind(this));
    }
});
