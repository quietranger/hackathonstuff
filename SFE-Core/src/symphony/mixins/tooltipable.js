var Tooltip = require('tooltip');

/**
 * Mixin to enable tooltip display.
 *
 * @mixin
 */
var Tooltipable = {
    /**
     * Iterate through the view's $el and initialize a tooltip on
     * every element with the [data-tooltip] element. Stores the tooltip
     * instance itself via the jQuery .data function. If destroy is true, then
     * existing tooltip instances will be destroyed when this function is
     * called. Otherwise, existing tooltip instances are ignored.
     *
     * @param {Boolean} [destroy]
     */
    initTooltips: function(destroy) {
        destroy = destroy !== undefined;

        this.$el.find('[data-tooltip]').each(function() {
            var $this = $(this),
                tooltip = $this.data('_tooltip');

            if (tooltip && !destroy) {
                return;
            }

            if (tooltip) {
                tooltip.destroy();
            }

            tooltip = new Tooltip({
                target: this,
                remove: true
            });

            $this.data('_tooltip', tooltip);
        });
    },

    /**
     * Destroy all tooltip instances within this view's $el.
     */
    destroyTooltips: function() {
        this.$el.find('[data-tooltip]').each(function() {
            var $this = $(this),
                tooltip = $this.data('_tooltip');

            if (tooltip) {
                tooltip.destroy();
                $this.data('_tooltip', null);
            }
        });
    }
};

module.exports = Tooltipable;