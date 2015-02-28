var Symphony = require('symphony-core');

module.exports = {
    _destroyAllChildren: function() {
        _.each(this.childViews, function(view) {
            view.destroy();
        });

        this.childViews = [];
    },

    destroy: function() {
        this._destroyAllChildren();

        Symphony.View.prototype.destroy.apply(this, arguments);
    }
};
