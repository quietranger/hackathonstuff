var Symphony = require('symphony-core');

module.exports = Symphony.View.extend({
    tagName: 'li',

    template: $.noop,

    events: {
        'click': 'toggleSelected'
    },

    initialize: function() {
        var self = this;

        Symphony.View.prototype.initialize.apply(this, arguments);

        this.listenTo(this.model, 'change:selected', this.render.bind(this));
        this.listenTo(this.model, 'change:selected', this.didSelectItem.bind(this));

        this.toggleSelected = _.throttle(function() {
            self.model.set('selected', !self.model.get('selected'));
        }, 200);
    },

    render: function() {
        this.$el.html(this.template(this.model.toJSON()));
        this.$el.toggleClass('selected', this.model.get('selected'));

        return Symphony.View.prototype.render.apply(this, arguments);
    },

    didSelectItem: $.noop
});
