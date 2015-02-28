var Tooltip = require('tooltip');

var _global_tt_elements = [];
var _global_tt_tooltips = [];

module.exports = {
    initTooltips: function() {
        if (!this._tt_tooltips) {
            this._tt_tooltips = [];
        }

        var tooltips = this.$el.find('[data-tooltip]'),
            self = this;

        _.each(tooltips, function(ttEl) {
            if (_.indexOf(_global_tt_elements, ttEl) > -1) {
                return;
            }

            var tooltip = new Tooltip({
                target: ttEl,
                remove: true
            });

            self._tt_tooltips.push(tooltip);
            _global_tt_elements.push(ttEl);
            _global_tt_tooltips.push(tooltip);
        });
    },

    destroyTooltips: function() {
        _.each(this._tt_tooltips, function(tt) {
            var eIdx = _.indexOf(_global_tt_elements, tt.target);
            _global_tt_elements.splice(eIdx, 1);

            var ttIdx = _.indexOf(_global_tt_tooltips, tt);
            _global_tt_tooltips.splice(ttIdx, 1);

            tt.destroy();
        });

        this._tt_tooltips = null;
    }
};