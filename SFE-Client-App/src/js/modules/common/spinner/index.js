var Symphony = require('symphony-core');
var Spin = require('spin');

var DEFAULT_SPINNER_OPTS = {
    lines: 10, // The number of lines to draw
    length: 5, // The length of each line
    width: 3, // The line thickness
    radius: 5, // The radius of the inner circle
    className: ''
};

module.exports = Symphony.View.extend(
/** @lends module:Symphony.View.prototype **/
{
    className: 'spinner',

    /**
     * The managed spinner.
     *
     * @private
     */
    _spinner: null,

    /**
     * Simple view that displays an HTML5 spinner. Consumes an options hash with all the usual view options as well as a
     * sub-object called 'spinnerOpts' that can contain any spin.js option (see https://fgnass.github.io/spin.js/
     * for details).
     *
     * @name SpinnerView
     *
     * @param opts View options
     * @param [opts.spinnerOpts] Options for the managed spinner
     *
     * @constructs
     * @extends Symphony.View
     */
    initialize: function(opts) {
        Symphony.View.prototype.initialize.apply(this, arguments);

        opts.spinnerOpts = opts.spinnerOpts || {};

        _.defaults(opts.spinnerOpts, DEFAULT_SPINNER_OPTS);

        var self = this;

        // grab account data in order to show the spinner with the correct theme.
        this.accountDataPromise.then(function(data) {
            var theme = data.config && data.config.activeTheme ? data.config.activeTheme : 'dark';

            var themeConfig = _.find(Symphony.Config.THEMES, function(config) {
                return config.key === theme;
            });

            if (themeConfig && themeConfig.config && themeConfig.config.spinnerColor) {
                opts.spinnerOpts.color = themeConfig.config.spinnerColor;
            } else {
                opts.spinnerOpts.color = '#fff';
            }

            self._spinner = new Spin(opts.spinnerOpts);
        });
    },

    /**
     * Renders the spinner. Simply delegates to the start() method.
     */
    render: function() {
        this.start();
        
        return Symphony.View.prototype.render.apply(this, arguments);
    },

    /**
     * Starts the spinner.
     */
    start: function() {
        if (this._spinner) {
            this._spinner.spin(this.el);
        }
    },

    /**
     * Stops the spinner - if one exists.
     */
    stop: function() {
        if (this._spinner) {
            this._spinner.stop();
        }
    },

    /**
     * Stops the spinner and destroys the view.
     */
    destroy: function() {
        this.stop();
        this._spinner = null;

        Symphony.View.prototype.destroy.apply(this, arguments);
    }
});