var Symphony = require('symphony-core');
var Backbone = require('backbone');
var config = Symphony.Config;

var template = require('./templates/alias-color-code-picker.handlebars');

require('../helpers/index');

module.exports = Backbone.View.extend({
    className: 'alias-color-code-picker',

    events: {
        'change .color-selector, .enable-background': 'save',
        'click .save': 'save',
        'input .alias-input': 'aliasDidInput',
        'keydown .alias-input': 'aliasDidKeydown',
        'click .reset': 'reset'
    },

    keyboardEvents: {
        'enter': 'save'
    },

    initialize: function(opts) {
        this.sandbox = opts.sandbox;
        this.model = opts.model;
        this.eventBus = opts.eventBus || _.extend({}, Backbone.Events);
        this.data = {};

        this._documentUrl = 'documents.' + config.PER_USER_METADATA_DOCUMENT_ID + '.' + this.model.person.id;

        this.listenTo(this.eventBus, 'popover:will-show', this.refresh.bind(this));

        this.refresh();
    },

    render: function() {
        this.$el.html(template(this.data));

        return this;
    },

    refresh: function() {
        var self = this;

        this.sandbox.getData(this._documentUrl).then(function(rsp) {
            if (rsp) {
                self.data = rsp;
                self.data.hasAlias = !_.isEmpty(rsp.alias);
                self.render();
            }
        });
    },

    aliasDidInput: function(e) {
        var $target = $(e.currentTarget);

        $target.closest('.input').removeClass('resettable');
        $target.siblings('.save').toggleClass('disabled', $target.val().length == 0);
    },

    aliasDidKeydown: function(e) {
        if (e.which == 13) {
            this.save();
            this.eventBus.trigger('popover:hide');
        }
    },

    reset: function() {
        var $input = this.$el.find('.alias-input');
        $input.val('');

        this.aliasDidInput({
            currentTarget: $input[0]
        });

        this.save();
    },

    save: function() {
        var aliasValue = this.$el.find('.alias-input').val(),
            colorValue = parseInt(this.$el.find('.color-selector:checked').val());

        var payload = {
            color: isNaN(colorValue) ? null : colorValue,
            showBackgroundColor: this.$el.find('.enable-background').is(':checked'),
            alias: _.isEmpty(aliasValue) ? null : aliasValue
        };

        var sandboxPayload = {};
        sandboxPayload[this.model.person.id] = payload;

        this.sandbox.setData(this._documentUrl, payload);
        this.sandbox.publish('alias-color-code:changed', null, sandboxPayload);

        if (payload.alias) {
            this.$el.find('.alias .input').addClass('resettable');
        }
    },

    destroy: function() {
        this.remove();
    }
});
