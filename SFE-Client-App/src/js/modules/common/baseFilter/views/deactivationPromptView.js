/**
 * Created by slippm on 5/5/14.
 */
var Backbone = require('backbone');
var Handlebars = require('hbsfy/runtime');
var errors = require('../../../../config/errors');

var deactivationPromptTmpl = require('../templates/deactivation-prompt.handlebars');

var showErrorMessage = require('../../mixins/showErrorMessage');

module.exports = Backbone.View.extend({
    className: 'filter-deactivation-prompt',

    events: {
        'click a.close': 'close',
        'click a.submit': 'deactivate'
    },

    keyboardEvents: {
        'enter': 'deactivate'
    },

    initialize: function(opts) {
        this.opts = opts || {};
        this.sandbox = opts.sandbox;
        this.eventBus = opts.eventBus;
        this.filterId = opts.filterId;
    },

    render: function() {
        this.$el.html(deactivationPromptTmpl());

        return this;
    },

    destroy: function() {
        this.remove();
        this.off();
    },

    deactivate: function() {
        var self = this;

        var query = this.sandbox.send({
            id: 'DELETE_FILTER',
            urlExtension: encodeURIComponent(self.filterId)
        });

        query.done(function(rsp) {
            self.eventBus.trigger('filter:deactivated');

            self.sandbox.getData('app.account.filters').done(function (filters) {
                self.sandbox.setData('app.account.filters', _.reject(filters, function(filter){ return filter._id === self.filterId;}));
            });

            self.close();

        }, function() {
            self.showErrorMessage(errors.COMMON.BASE_FILTER.DEACTIVATION_PROMPT);
        });
    },

    close: function() {
        this.sandbox.publish('modal:hide');
    }
});

_.extend(module.exports.prototype, showErrorMessage);