var Backbone = require('backbone');


var newFeaturesTmpl = require('../templates/new-features.handlebars');
var mixinDefaults = require('../../common/mixins/moduleDefaults');


module.exports = Backbone.View.extend({
    id: 'new-features-modal',

    events: {
        'click .cancel': 'cancel',
        'click .submit': 'submit'
    },

    initialize: function(opts) {
        this.opts = opts;
        this.sandbox = opts.sandbox;
    },

    render: function() {
        this.$el.append(newFeaturesTmpl());
        return this;
    },

    submit: function(){
        this.sandbox.publish('modal:hide');
    },

    cancel: function() {
        this.sandbox.publish('modal:hide');
    }
});