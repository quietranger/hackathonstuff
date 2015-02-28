// symphony dependencies
var config = require("../../../../config/config");
var utils = require("../../../../utils");

// templates
var generalTmpl = require("../../templates/general/index.handlebars");
// views
var BaseTabView = require("./base");

module.exports = BaseTabView.extend({

    // backbone methods
    initialize: function (opts) {
        this._baseClientDataPath = "app.account.config";
        BaseTabView.prototype.initialize.apply(this, arguments);
    },

    render: function () {
        this._renderPromise.then(function (response) {
            var data = this._tabSettingsData || {};

            this.$el.html(generalTmpl({
                show24HrTime      : data.show24HrTime,
                showCompactMode   : data.showCompactMode,
                removeInactiveIM  : data.removeInactiveIM,
                hideMessagesIM    : data.hideMessagesIM,
                sortLeftNavByUnread: data.sortLeftNavByUnread,
                enableEmailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
                notifyMentions: data.offlineNotifications ? data.offlineNotifications.mentions : false,
                notifyIMs: data.offlineNotifications ? data.offlineNotifications.IM : false
            }));
        }.bind(this));
        return BaseTabView.prototype.render.apply(this, arguments);
    },

    resetLayout: function() {
        //temporary method to reset layout until we can fix the bug =[
        this.sandbox.setData('documents.layout', {}).done(function(){
            document.location.reload();
        })
    },

    // event handlers
    events: {
        "change .field-show-24-hr-time input[type=checkbox]": "_toggleShow24HrTime",
        "change .field-show-compact-mode input[type=checkbox]": "_toggleCompactMode",
        "change .field-remove-inactive-im input[type=checkbox]": "_toggleRemoveInactiveIM",
        "change .field-hide-messages-im input[type=checkbox]": "_toggleHideMessagesIM",
        "change .field-sort-left-nav-by-unread input[type=checkbox]": "_toggleSortLeftNavByUnread",
        "change #settings-notify-mentions, #settings-notify-ims": "_toggleEmailSettings",
        "click .layout-reset" : 'resetLayout'
    },

    _toggleShow24HrTime: function (event) {
        var path = utils.dotify(this._baseClientDataPath, "show24HrTime");
        var value = event.currentTarget.checked;
        this._persistUpdate(path, value).then(function (success) {
            if (success) {
                this.sandbox.publish("bodyStyle", null, {
                    method: "show24HrTime",
                    choice: value
                });
            };
        }.bind(this));
    },

    _toggleCompactMode: function (event) {
        var path = utils.dotify(this._baseClientDataPath, "showCompactMode");
        var value = event.currentTarget.checked;
        this._persistUpdate(path, value).then(function (success) {
            if (success) {
                this.sandbox.publish("bodyStyle", null, {
                    method: "showCompactMode",
                    choice: value
                });
            };
        }.bind(this));
    },

    _toggleRemoveInactiveIM: function(e) {
        var path = utils.dotify(this._baseClientDataPath, "removeInactiveIM"),
            value = e.currentTarget.checked;

        this._persistUpdate(path, value).then(function (rsp) {
            this.sandbox.publish("removeInactiveIM", null, value);
        }.bind(this));
    },

    _toggleHideMessagesIM: function(e) {
        var path = utils.dotify(this._baseClientDataPath, "hideMessagesIM"),
            value = e.currentTarget.checked;

        this._persistUpdate(path, value).then(function (rsp) {
            this.sandbox.publish("hideMessagesIM", null, value);
        }.bind(this));
    },

    _toggleSortLeftNavByUnread: function(e) {
        var path = utils.dotify(this._baseClientDataPath, "sortLeftNavByUnread"),
            value = e.currentTarget.checked;

        this._persistUpdate(path, value).then(function (rsp) {
            this.sandbox.publish("sortLeftNavByUnread", null, value);
        }.bind(this));
    },

    _toggleEmailSettings: function(e) {
        var map = {
            'settings-notify-mentions': 'mentions',
            'settings-notify-ims': 'IM'
        };

        var key = map[e.currentTarget.id];

        if (!key) {
            return;
        }

        var value = e.currentTarget.checked,
            path = utils.dotify(this._baseClientDataPath + '.offlineNotifications', key);

        this._persistUpdate(path, value);
    }
});
