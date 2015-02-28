var Backbone = require('backbone');
var newVersionTmpl = require('./newVersion.handlebars');
var config = require('../../../config/config');


module.exports = Backbone.View.extend({
    initialize: function(opts) {
        this.opts = opts || {};
        this.sandbox = opts.sandbox;
        this.isMajor = opts.isMajor;
    },
    events: {
        'click .restart' : 'restart'
    },
    render: function() {
        this.$el.append(newVersionTmpl(this.opts));
        var that = this;
        var randomTime = Math.floor(Math.random() * (30 - 10 + 1) + 10) * 60 * 1000; // gives milliseconds between 10-30 minutes
        setTimeout(function () {
            that.restart();
        }, randomTime); // auto restart in some period between 10 and 30 minutes
        return this;
    },
    restart: function() {
        //todo radaja this refreshes in browser but must test client app
        this.sandbox.publish('appBridge:fn', null, {fnName: 'restartClientApp'});
    }
});