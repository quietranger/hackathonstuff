var Backbone = require('backbone');
var viewTmpl = require('./templates/reconnect');

module.exports = Backbone.View.extend({
    className: 'reconnectprompt',
    sizeX: 12,
    sizeY: 8,
    events: {
        'click .submit': 'submit'
    },
    initialize: function (opts) {
        this.opts = opts || {};

        setTimeout(function () {
            // restart the app
            window.location = 'index.html';
        },  15000 + (Math.floor((Math.random() * 75) + 1)*1000)); //15-90 seconds
    },
    render: function () {
        this.$el.html(viewTmpl({
        }));
        return this;
    },
    submit: function () {
        window.location = 'index.html';
    },
    exportJson: function () {
        return _.extend({}, {
            module: 'reconnect',
            sizeX: this.sizeX,
            sizeY: this.sizeY
        });
    }

});
