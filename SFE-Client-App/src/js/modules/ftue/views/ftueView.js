var Symphony = require('symphony-core');

var ftueTmpl = require('../templates/ftue.handlebars');

module.exports = Symphony.Module.extend({
    moduleHeader: '<h2>Welcome to Symphony!</h2>',

    className: 'module ftue',

    events: {
        'click .ftue-tabs li': 'tabSelected'
    },

    render: function() {
        this.$content.html(ftueTmpl());
        
        return Symphony.Module.prototype.render.apply(this, arguments);
    },

    tabSelected: function(e) {
        var $target = $(e.currentTarget),
            $tabs = this.$el.find('.ftue-tabs li'),
            index = $tabs.index($target);

        $tabs.removeClass('active');
        $target.addClass('active');

        this.$el.find('.tab-content.active').removeClass('active');
        this.$el.find('.tab-content:eq(' + index + ')').addClass('active');
    }
});