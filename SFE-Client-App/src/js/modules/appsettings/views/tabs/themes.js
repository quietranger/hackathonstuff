// symphony dependencies
var Symphony = require('symphony-core');
var config = require("../../../../config/config");
var utils = require("../../../../utils");

// templates
var themesTmpl = require("../../templates/themes/index.handlebars");
require("../../helpers/ifEqual");

// views
var BaseTabView = require("./base");


module.exports = BaseTabView.extend({

    // backbone methods

    initialize: function (opts) {
        this._baseClientDataPath = "documents.themes";

        BaseTabView.prototype.initialize.apply(this, arguments);

        this.activeTheme = this._accountData.config.activeTheme || _.keys(Symphony.Config.THEMES)[0].key;
        this.themes = $.extend(true, [], Symphony.Config.THEMES);

        this._boundThemeDidChange = this._themeDidChange.bind(this);

        this.sandbox.subscribe('theme:changed', this._boundThemeDidChange);
    },

    render: function () {
        this._renderPromise.then(function () {
            this.$el.html(themesTmpl({
                themes: this.themes,
                activeTheme: this.activeTheme
            }));
        }.bind(this));

        return BaseTabView.prototype.render.apply(this, arguments);
    },


    // event handlers

    events: {
        "click .activate": "_activateTheme"
    },

    _themeDidChange: function(ctx, opts) {
        this.activeTheme = opts.theme;
        this.render();
    },

    _activateTheme: function (event) {
        var id = $(event.currentTarget).closest("li[data-id]").data("id");

        if (id !== this.activeTheme) {
            this.sandbox.publish('theme:changed', null, {
                'theme':id //the core extension automatically saves the changes, unless you set skipPersist: true
            });
        }
    },

    destroy: function() {
        this.sandbox.unsubscribe('theme:changed', this._boundThemeDidChange);

        BaseTabView.prototype.destroy.apply(this, arguments);
    }
});
