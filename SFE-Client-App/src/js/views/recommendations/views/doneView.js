var Symphony = require('symphony-core');

var template = require('../templates/views/done');

module.exports = Symphony.View.extend({
    className: 'done',

    initialize: function() {
        Symphony.View.prototype.initialize.apply(this, arguments);

        var self = this;

        setTimeout(function() {
            self.eventBus.trigger('screen:advance');
        }, 3000);
    },

    render: function() {
        this.$el.html(template());

        return Symphony.View.prototype.render.apply(this, arguments);
    }
});
