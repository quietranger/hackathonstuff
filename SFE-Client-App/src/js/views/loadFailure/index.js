var Symphony = require('symphony-core');

module.exports = Symphony.View.extend({
    render: function() {
        this.$el.html('<p>Failed to start the app. Please check your internet connection and try again.</p>');

        return Symphony.View.prototype.render.apply(this, arguments);
    }
});