var config = require('../../../config');

var THEMES = _.pluck(config.THEMES, 'key');

/**
 * Applies themes on page load and theme change. Saves active theme in the user
 * config hash.
 * @param {object} opts Options hash containing the sandbox and dataStore.
 */
var Themer = function(sandbox) {
    var $link = $('link#default-style');

    this.sandbox = sandbox;
    this.$linkTag = $link[0] ? $link : null;

    if (!this.sandbox) {
        throw new Error('The themer requires a sandbox instance.');
    }

    this.sandbox.subscribe('theme:changed', this.themeDidChange.bind(this));
};

/**
 * Callback function for when the theme changes. Called with no arguments in app.js
 * in order to bootstrap the theme.
 *
 * @param  {null} ctx   Sandbox context. Should always be null.
 * @param  {object} opts Contains the theme name and whether to persist the theme selection
 * @return {void}
 */
Themer.prototype.themeDidChange = function(ctx, opts) {
    var self = this;

    if (opts === undefined) {
        opts = {};
    }

    this.sandbox.getData('app.account.config').then(function(config) {
        if (opts.theme !== undefined && !_.contains(THEMES, opts.theme)) {
            return;
        }

        if (opts.theme === undefined) {
            opts.theme = config.activeTheme || 'dark';
        }

        if (self.$linkTag) {
            self.$linkTag.remove();
        }

        self.$linkTag = $('<link />').attr('rel', 'stylesheet');
        self.$linkTag.attr('href', 'css/' + opts.theme + '-theme.css');
        self.$linkTag.appendTo('head');

        if(!opts.skipPersist) { //generally people will want to save, so make it easier
            self._saveTheme(config, opts.theme);
        }

        self.sandbox.publish('alias-color-code:changed');
    });
};

/**
 * Private method. Stores the new theme in the user's view config.
 *
 * @param  {obj} config The old user view config.
 * @param  {string} theme  The theme name.
 * @return {void}
 */
Themer.prototype._saveTheme = function(config, theme) {
    if (config.activeTheme === theme) {
        return;
    }

    config.activeTheme = theme;

    this.sandbox.setData('app.account.config', config);
};

module.exports = Themer;
