var Backbone = require('backbone');
var notProvisionedTmpl = require('./notProvisioned');

module.exports = Backbone.View.extend({
    initialize: function(opts) {
        this.opts = opts || {};
    },
    render: function() {
        this.$el.append(notProvisionedTmpl());
        return this;
    }
});
