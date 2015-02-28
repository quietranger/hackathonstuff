var Backbone = require('backbone');
var config = require('../../../config/config');
var errors = require('../../../config/errors');
var utils = require('../../../utils');

var settingsTmpl = require('../templates/settings.handlebars');

var showErrorMessage = require('../../common/mixins/showErrorMessage');

require('spectrum');

module.exports = Backbone.View.extend({
    className: 'chatroom-settings module-settings',

    events: {
        'click .close': 'close',
        'click .cancel': 'close',
        'click .save-settings': 'save',
        'click .try-notification': 'popupNotification',
        'change #show-notification': 'toggleNotification'
    },

    keyboardEvents: {
        'shift+enter': 'save'
    },

    initialize: function(opts) {
        var self = this;
        this.opts = opts || {};
        this.eventBus = opts.eventBus;
        this.sandbox = opts.sandbox;
        this.viewId = opts.viewId;
        this.isRunningInClientApp = opts.isRunningInClientApp;

        var viewType = opts.isIM ? 'IM' : 'CHATROOM';
        this.settings = {
            viewId: this.viewId,
            viewType: viewType,
            clientType: 'DESKTOP',
            pinnedChat: true,
            config: {},
            roomData: {}
        };

        self.sandbox.getData('app.account').then(function (rsp) {
            var options = _.find(rsp.userViewConfigs, function (view) {
                return view.viewId === self.viewId;
            });

            if (options && !_.isEmpty(options.config)) {
                self.settings.config = _.extend({}, options.config);
            } else {
                self.settings.config = _.extend({}, rsp.config.appWideViewConfigs[config.CLIENT_VERSION][viewType]);
            }

            if(!self.opts.isIM) {
                self.settings.roomData = _.find(rsp.roomParticipations, function (item) {
                    return self.viewId === item.threadId;
                });
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
        this.$el.html(settingsTmpl(_.extend({
            isRunningInClientApp: this.isRunningInClientApp,
            isIM: this.opts.isIM
        }, this.settings)));

        var $roomName = this.$el.find('#room-name');

        if (this.settings.roomData.userIsOwner) {
            $roomName.focus();
        }

        $roomName.val(this.settings.roomData.name);

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
            }
        });
    },

    save: function () {
        if (!this.opts.isIM) {
            //room attribute
            var curData = this.settings.roomData;

            var $roomname = this.$el.find('#room-name');
            var $roomdescription = this.$el.find('#room-description');

            $roomname.removeClass('error');
            $roomdescription.removeClass('error');

            if(!utils.isValidString($roomname.val())) {
                $roomname.addClass('error');
                return;
            }

            if (!utils.isValidString($roomdescription.val())) {
                $roomdescription.addClass('error');
                return;
            }

            var newData = {
                name: utils.escapeHtml($roomname.val()),
                description: utils.escapeHtml($roomdescription.val())
            };

            if (curData.userIsOwner) {
                // The room description has changed -- can't be null
                if (newData.description !== curData.description && newData.description.length === 0) {
                    self.showErrorMessage(errors.CHATROOM.SETTINGS.ROOM_DESCRIPTION);
                    return;
                }
                var dataChanged = false;
                // Only make call to update room data if there are changes. If private room, check for these two configs as well
                if (curData.name !== newData.name || curData.description !== newData.description) {
                    dataChanged = true;
                } else if (!curData.publicRoom) {
                    newData.memberAddUserEnabled = this.$el.find('#membership-invite').prop('checked');
                    newData.discoverable = this.$el.find('#room-searchable').prop('checked');
                    if (curData.memberAddUserEnabled !== newData.memberAddUserEnabled || curData.discoverable !== newData.discoverable) {
                        dataChanged = true;
                    }
                }

                if (dataChanged) {
                    //save the attribute changes
                    this.sandbox.send({
                        id: 'ROOM_MANAGER',
                        payload: {
                            action: 'update',
                            threadid: this.viewId,
                            room: JSON.stringify(newData)
                        }
                    });
                }
            }
        }

        var newConfig = {
            showNotification: this.$el.find('#show-notification').prop('checked'),
            disableInput: this.$el.find('#disable-input').prop('checked'),
            notificationColor: '#' + this.$el.find("#notification-color").spectrum("get").toHex(),
            persist: this.$el.find('#persistent-notification').prop('checked'),
            blink: this.$el.find('#blinking-notification').prop('checked'),
            playSound: this.$el.find('#play-sound').prop('checked'),
            showStreamAlerts: this.$el.find('#stream-alerts').prop('checked')
        };

        if(_.isEqual(newConfig, this.settings.config)){
            this.sandbox.publish('modal:hide');
        } else {
            // Update disable input and placeholder text on the fly if it changed, for readonly change, will get maestro message
            if(newConfig.disableInput !== this.settings.config.disableInput){
                var inputOption = {};
                //need to change
                if(newConfig.disableInput){
                    inputOption.placeholderText = 'Input disabled.';
                    inputOption.disableInputOption = true;
                } else if (curData && curData.readOnly && !curData.isOwner) {
                    inputOption.placeholderText = 'This room is read-only. Only owners of the room can post a message to this room.';
                    inputOption.disableInputOption = true;
                } else {
                    inputOption.placeholderText = 'Compose a message...';
                    inputOption.disableInputOption = false;
                }
                inputOption.showRejoinButton = false;
                inputOption.streamId = this.viewId;
                this.eventBus.trigger('textinput:change', inputOption);
            }

            this.settings.config = newConfig;

            var self = this;
            this.sandbox.setData('app.account.userViewConfigs', this.settings).done(function (config) {
                //successfully saved to server
                self.eventBus.trigger('settings:change', self.settings.config);
                self.sandbox.publish('modal:hide');
            }, function (rsp) {
                self.showErrorMessage(errors.CHATROOM.SETTINGS.VIEW_CONFIG);
            });

        }
    },

    close: function () {
        this.sandbox.publish('modal:hide');
    }
});

_.extend(module.exports.prototype, showErrorMessage);