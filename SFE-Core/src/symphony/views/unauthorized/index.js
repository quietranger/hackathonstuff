var Backbone = require('backbone');
var unauthorizedTmpl = require('./unauthorized');
var config = require('../../../../config');

module.exports = Backbone.View.extend({
    initialize: function(opts) {
        this.opts = opts || {};
        this.sandbox = opts.sandbox;
        // attempt to get a new cookie in the background if in client wrapper
        this.sandbox.publish('appBridge:fn', null, {fnName: 'refreshAuthCookie', param: {}});
    },
    events: {
        'click .login' :    'login'
    },
    render: function() {
        this.$el.append(unauthorizedTmpl());
        return this;
    },
    login: function() {
        window.location = config.LOGIN_PAGE;
    }
});
