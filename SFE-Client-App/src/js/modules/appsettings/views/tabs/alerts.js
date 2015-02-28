// symphony dependencies
var config = require("../../../../config/config");
var utils = require("../../../../utils");

// 3rd party dependencies
var _s = require("underscore.string");
require("spectrum");

// templates
var alertsTmpl = require("../../templates/alerts/index.handlebars");
var categoryTmpl = require("../../templates/alerts/category.handlebars");
var exceptionTmpl = require("../../templates/alerts/exception.handlebars");

// views
var BaseTabView = require("./base");
var BreadcrumbsView = require("../tools/breadcrumbs");


module.exports = BaseTabView.extend({

    // backbone methods

    initialize: function (opts) {
        this._baseClientDataPath = "app.account";
        BaseTabView.prototype.initialize.apply(this, arguments);

        // view properties
        this._isDesktopClient = config.CLIENT_VERSION === "DESKTOP" && window.appbridge != undefined;

        // set up module name map
        this._createModuleNameMap();

    },

    render: function () {
        this._renderPromise.then(function (response) {
            this.$el.html(alertsTmpl({
                notificationsOn: this._tabSettingsData.config.notificationsOn,
                isDesktopClient: this._isDesktopClient
            }));
            this.delegateEvents();
        }.bind(this));
        return BaseTabView.prototype.render.apply(this, arguments);
    },

    postRender: function () {
        var self = this;
        this._renderPromise.then(function (response) {
            self._resetCategoriesBreadcrumbsView();
            self._resetCategories();
        });
        return BaseTabView.prototype.postRender.apply(this, arguments);
    },

    destroy: function () {
        if (this._categoriesBreadcrumbsView) {
            this._categoriesBreadcrumbsView.destroy();
        }
        BaseTabView.prototype.destroy.apply(this, arguments);
    },


    // event handlers

    events: {
        "change .field-notifications-on input[type=checkbox]": "_toggleNotificationsOn",
        "click .field-configure-desktop-alerts button:not(:disabled)": "_showDesktopAlertsSettingsWindow",
        "click .alerts-category[data-category] .field-show-example button:not(:disabled)": "_showCategoryDesktopAlertExample",
        "click .alerts-exception[data-category][data-id] .field-show-example button:not(:disabled)": "_showExceptionDesktopAlertExample",
        "click .alerts-category[data-category] .field-exceptions button:not(:disabled)": "_showExceptions",
        "click .alerts-category[data-category] .field-restore-defaults button": "_restoreCategoryDefaults",
        "click .alerts-category[data-category] .field[data-path-name] input[type=checkbox]": "_updateCategoryBooleanSetting",
        "click .alerts-exception[data-category][data-id] .field[data-path-name] input[type=checkbox]": "_updateExceptionBooleanSetting",
        "click .alerts-exception[data-category][data-id] .field-remove-exception button": "_removeException"
    },

    _toggleNotificationsOn: function (event) {
        var path = utils.dotify(this._baseClientDataPath, "config", "notificationsOn");
        var value = !event.currentTarget.checked;
        this._persistUpdate(path, value);
    },

    _showDesktopAlertsSettingsWindow: function (event) {
        if (this._isDesktopClient) {
            window.appbridge.ShowAlertSettings();
        }
    },

    _showCategoryDesktopAlertExample: function (event) {
        if (this._isDesktopClient) {
            var $elem = $(event.currentTarget);
            var categoryName = $elem.closest("[data-category]").data("category");
            var categoryData = this._tabSettingsData.config.appWideViewConfigs[config.CLIENT_VERSION][categoryName];
            var alertOptions = {
                title: "Example " + _s.capitalize(categoryName) + " alert",
                message: "This is what an example desktop alert would look like with your settings",
                color: categoryData.notificationColor,
                persistent: categoryData.persist,
                blink: categoryData.blink,
                blinkColor: config.BLINKING_COLOR_MAP[categoryData.notificationColor],
                playSound: categoryData.playSound
            };

            this.sandbox.publish('appBridge:fn', null, {
                fnName: 'showSampleAlert',
                param: alertOptions
            });
        }
    },

    _showExceptionDesktopAlertExample: function (event) {
        if (this._isDesktopClient) {
            var $elem = $(event.currentTarget);
            var categoryName = $elem.closest("[data-category]").data("category");
            var categoryData = this._tabSettingsData.config.appWideViewConfigs[config.CLIENT_VERSION][categoryName];
            var exceptionId = $elem.closest("[data-id]").data("id");
            var exceptionData = _.findWhere(this._tabSettingsData.userViewConfigs, {viewId: exceptionId});
            var alertOptions = {
                title: "Example " + _s.capitalize(this._getModuleName(exceptionId)) + " alert",
                message: "This is what an example desktop alert would look like with your settings",
                color: exceptionData.config.notificationColor || categoryData.notificationColor,
                persistent: exceptionData.config.persist || categoryData.persist,
                blink: exceptionData.config.blink || categoryData.blink,
                blinkColor: exceptionData.config.notificationColor ? config.BLINKING_COLOR_MAP[exceptionData.config.notificationColor] : config.BLINKING_COLOR_MAP[categoryData.notificationColor],
                playSound: exceptionData.config.playSound || categoryData.playSound
            };

            this.sandbox.publish('appBridge:fn', null, {
                fnName: 'showSampleAlert',
                param: alertOptions
            });
        }
    },

    _restoreCategoryDefaults: function (event) {
        var $elem = $(event.currentTarget);
        var category = $elem.closest("[data-category]").data("category");
        this._persistUpdate(utils.dotify(this._baseClientDataPath, "config", "appWideViewConfigs", config.CLIENT_VERSION, category), config.DEFAULT_SETTINGS[config.CLIENT_VERSION][category]);
    },

    _showExceptions: function (event) {
        var $elem = $(event.currentTarget);
        var category = $elem.closest("[data-category]").data("category");
        var exceptions = this._getExceptions(category);
        var html = "";

        // update the breadcrumbs
        this._categoriesBreadcrumbsView._add({
            name: category == "IM" ? category + " Exceptions" : category.toLowerCase() + " Exceptions",
            action: this._showExceptions.bind(this, event)
        });
        this._categoriesBreadcrumbsView.render();

        if (exceptions.length) {
            // create the html for exceptions & insert into DOM
            exceptions.forEach(function (exception) {
                html = html + exceptionTmpl(_.extend({
                    category: category,
                    id: exception.viewId,
                    name: this._getModuleName(exception.viewId),
                    isDesktopClient: this._isDesktopClient
                }, this._tabSettingsData.config.appWideViewConfigs[config.CLIENT_VERSION][category], exception.config));
            }.bind(this));
            this.$el.find(".categories-container").html(html);

            // load color pickers
            exceptions.forEach(function (exception, index) {
                var $element = this.$el.find(".alerts-exception[data-category=\"" + category + "\"][data-id=\"" + exception.viewId + "\"] .field-notification-color input");
                var color = exception.config.notificationColor || this._tabSettingsData.config.appWideViewConfigs[config.CLIENT_VERSION][category].notificationColor;
                var clientDataPath = utils.dotify(this._baseClientDataPath, "userViewConfigs");
                this._renderColorPicker($element, color, clientDataPath);
            }.bind(this));
        } else {
            this.$el.find(".categories-container").html("<span class=\"message\">You don\'t have any " + category.toLowerCase() + " exceptions</span>");
        }
    },

    _updateCategoryBooleanSetting: function (event) {
        var $elem = $(event.currentTarget);
        var category = $elem.closest("[data-category]").data("category");
        var pathName = $elem.closest(".field").data("path-name");
        var value = event.currentTarget.checked;
        this._persistUpdate(utils.dotify(this._baseClientDataPath, "config", "appWideViewConfigs", config.CLIENT_VERSION, category, pathName), value);
    },

    _updateExceptionBooleanSetting: function (event) {
        var $elem = $(event.currentTarget);
        var exceptionId = $elem.closest("[data-id]").data("id");
        var pathName = $elem.closest(".field").data("path-name");
        var value = event.currentTarget.checked;
        var exception = _.findWhere(this._tabSettingsData.userViewConfigs, {viewId: exceptionId});
        exception.config[pathName] = value;
        this._persistUpdate(utils.dotify(this._baseClientDataPath, "userViewConfigs"), exception, true);
    },

    _removeException: function (event) {
        var $elem = $(event.currentTarget);
        var category = $elem.closest("[data-category]").data("category");
        var exceptionId = $elem.closest("[data-id]").data("id");
        var exceptionData = _.findWhere(this._tabSettingsData.userViewConfigs, {viewId: exceptionId});
        exceptionData.config = {};
        this._persistUpdate(utils.dotify(this._baseClientDataPath, "userViewConfigs"), exceptionData);
    },


    // helpers

    _resetCategoriesBreadcrumbsView: function () {
        var opts = {
            sandbox: this.sandbox,
            eventBus: this.eventBus
        };

        if (this._categoriesBreadcrumbsView) {
            this._categoriesBreadcrumbsView._resetView(opts);
        } else {
            this._categoriesBreadcrumbsView = new BreadcrumbsView(opts);
        }

        this._categoriesBreadcrumbsView._add({
            name: "Category Settings",
            action: this._resetCategories.bind(this)
        });

        this._categoriesBreadcrumbsView.setElement(this.$el.find(".categories-breadcrumbs"));
        this._categoriesBreadcrumbsView.render();
  },

  _resetCategories: function() {
    var html = "";
    var categories = _.keys(this._tabSettingsData.config.appWideViewConfigs[config.CLIENT_VERSION]);

      if (!process.env.ENABLE_APPLICATIONS) {
        categories = _.without(categories, 'APPLICATION');
      }


    // create html for categories and insert into DOM
        categories.forEach(function (category) {
            var exceptions = this._getExceptions(category);
            html = html + categoryTmpl(_.extend({
                category: category,
                prettyCategory: category == "IM" ? category : category.toLowerCase(),
                hasExceptions: exceptions.length > 0,
                isDesktopClient: this._isDesktopClient
            }, this._tabSettingsData.config.appWideViewConfigs[config.CLIENT_VERSION][category]));
        }.bind(this));
        this.$el.find(".categories-container").html(html);

        // load color pickers
        categories.forEach(function (category) {
            var $element = this.$el.find(".alerts-category[data-category=" + category + "] .field-notification-color input")
            var color = this._tabSettingsData.config.appWideViewConfigs[config.CLIENT_VERSION][category].notificationColor;
            var clientDataPath = utils.dotify(this._baseClientDataPath, "config", "appWideViewConfigs", config.CLIENT_VERSION, category, "notificationColor");
            this._renderColorPicker($element, color, clientDataPath);
        }.bind(this));
    },

    _getExceptions: function (category) {
        var exceptions = _.where(this._tabSettingsData.userViewConfigs, {viewType: category});
        if (exceptions && exceptions.length) {
            exceptions = _.filter(exceptions, function (ex) {
                return ex.config && !_.isEmpty(ex.config) && this._getModuleName(ex.viewId);
            }.bind(this));
        }
        return exceptions && exceptions instanceof Array ? exceptions : [];
    },

    _renderColorPicker: function ($element, color, clientDataPath) {
        var self = this;
        $element.spectrum({
            showPalette: true,
            showPaletteOnly: true,
            color: color,
            palette: config.COLOR_PALETTE,
            change: function (color) {
                if (clientDataPath.indexOf("userViewConfigs") != -1) {
                    var exception = _.findWhere(self._tabSettingsData.userViewConfigs, {viewId: $element.closest("[data-id]").data("id")});
                    exception.config.notificationColor = color.toHexString();
                    self._persistUpdate(clientDataPath, exception, true);
                } else {
                    self._persistUpdate(clientDataPath, color.toHexString(), true);
                }
            }
        });
    },

    _createModuleNameMap: function () {
        this._moduleNameMap = {};
        for (var i in this._accountData.filters) {
            var filter = this._accountData.filters[i];
            this._moduleNameMap[filter._id] = filter.name;
        }
        for (var i2 in this._accountData.pinnedChats) {
            var im = this._accountData.pinnedChats[i2];
            this._moduleNameMap[im.threadId] = utils.getShortenedChatName(im.userPrettyNames, this._accountData.prettyName);
        }
        for (var i3 in this._accountData.roomParticipations) {
            var room = this._accountData.roomParticipations[i3];
            this._moduleNameMap[room.threadId] = room.name;
        }
    },

    _getModuleName: function (id) {
        return this._moduleNameMap[id] || "";
    }

});
