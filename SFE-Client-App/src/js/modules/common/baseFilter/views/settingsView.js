var Backbone = require('backbone');
var config = require('../../../../config/config');
var errors = require('../../../../config/errors');

var settingsTmpl = require('../templates/settings.handlebars');

var showErrorMessage = require('../../../common/mixins/showErrorMessage');

require('spectrum');

module.exports = Backbone.View.extend({
    className: 'filter-settings module-settings',

    events: {
        'click .close': 'close',
        'click .cancel': 'close',
        'click .save-settings': 'save',
        'change #show-notification': 'toggleNotification',
        'click .try-notification': 'popupNotification'
    },

    keyboardEvents: {
        'shift+enter': 'save'
    },

    initialize: function (opts) {
        this.opts = opts || {};
        this.eventBus = opts.eventBus;
        this.sandbox = opts.sandbox;
        this.viewId = opts.streamId;
        this.isRunningInClientApp = opts.isRunningInClientApp;
        this.channels = [];

        this.settings = {
            viewId: this.viewId,
            viewType: 'FILTER',
            clientType: 'DESKTOP',
            pinnedChat: true,
            config: {}
        };

        var self = this;

        this.sandbox.getData('app.account').then(function (rsp) {
            // To differentiate Channels from Regular Filters...
            _.each(rsp.filters, function(v, k) {
                if (v.filterType === 'FOLLOWING' ||
                    v.filterType === 'KEYWORD' ||
                    v.filterType === 'MENTIONS' ||
                    v.filterType === 'DEPT_FOLLOWING' ||
                    v.filterType === 'LEADERSHIP_FOLLOWING') {
                    self.channels.push(v);
                }
            });

            var options = _.find(rsp.userViewConfigs, function (view) {
                return view.viewId === self.viewId;
            });

            if (options && !_.isEmpty(options.config)) {
                // extend with own customized config
                self.settings.config = _.extend({}, options.config);
            } else {
                var filterIsChannel = _.find(self.channels, function(module) {
                    return self.viewId === module._id;
                });
                if (filterIsChannel) {
                    // it's a Channel module, so grab settings from CHANNEL
                    self.settings.config = _.extend({}, rsp.config.appWideViewConfigs[config.CLIENT_VERSION].CHANNEL);
                } else {
                    // else its just a regular filter
                    self.settings.config = _.extend({}, rsp.config.appWideViewConfigs[config.CLIENT_VERSION].FILTER);
                }
            }

            self.render();

            self.$el.find("#notification-color").spectrum({
                color: self.settings.config.notificationColor,
                clickoutFiresChange: true,
                showPalette: true,
                showPaletteOnly: true,
                palette: config.COLOR_PALETTE
            });
        });
    },

    render: function () {
        this.$el.html(settingsTmpl(_.extend({isRunningInClientApp: this.isRunningInClientApp}, this.settings)));
        return this;
    },

    toggleNotification: function (e) {
        if (this.$el.find(e.currentTarget).prop('checked')) {
            this.$el.find('.show-alerts-toggle').removeClass('disabled');
            this.$el.find('.show-alerts-toggle input').attr('disabled', false);
            this.$el.find("#notification-color").spectrum('enable');
        } else {
            this.$el.find('.show-alerts-toggle').addClass('disabled');
            this.$el.find('.show-alerts-toggle input').attr('disabled', true);
            this.$el.find("#notification-color").spectrum('disable');
        }
    },

    popupNotification: function () {
        this.sandbox.publish('appBridge:fn', null, {
            fnName: 'showSampleAlert',
            param: {
                viewId: this.viewId,
                color: '#' + this.$el.find("#notification-color").spectrum("get").toHex(),
                persist: this.$el.find('#persistent-notification').prop('checked'),
                blink: this.$el.find('#blinking-notification').prop('checked'),
                playSound: this.$el.find('#play-sound').prop('checked')
            }});
    },


    save: function () {
        var self = this;
        var newConfig = {
            showNotification: this.$el.find('#show-notification').prop('checked'),
            notificationColor: '#' + this.$el.find("#notification-color").spectrum("get").toHex(),
            persist: this.$el.find('#persistent-notification').prop('checked'),
            blink: this.$el.find('#blinking-notification').prop('checked'),
            playSound: this.$el.find('#play-sound').prop('checked'),
            showStreamAlerts: this.$el.find('#stream-alerts').prop('checked')
        };

        if (this.settings.config.notificationColor !== newConfig.notificationColor ||
            this.settings.config.showNotification !== newConfig.showNotification ||
            this.settings.config.showStreamAlerts !== newConfig.showStreamAlerts ||
            this.settings.config.playSound !== newConfig.playSound ||
            this.settings.config.blink !== newConfig.blink ||
            this.settings.config.persist !== newConfig.persist) {

            this.settings.config = newConfig;

            this.sandbox.setData('app.account.userViewConfigs', this.settings).done(function (config) {
                //todo successfully saved to server
            }, function (rsp) {
                self.showErrorMessage(errors.COMMON.BASE_FILTER.SETTINGS.VIEW_CONFIG);
            });

            this.eventBus.trigger('settings:change', this.settings.config);
        }
        this.sandbox.publish('modal:hide');
    },

    close: function () {
        this.sandbox.publish('modal:hide');
    }
});

_.extend(module.exports.prototype, showErrorMessage);
