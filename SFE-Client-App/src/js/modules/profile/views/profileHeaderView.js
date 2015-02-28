var Backbone = require('backbone');
var Handlebars = require("hbsfy/runtime");

var moment = require('moment');

var profileHeaderTmpl = require('../templates/profile-header.handlebars');

module.exports = Backbone.View.extend({
    className: 'profile-header',

    initialize: function (opts) {
        this.opts = opts || {};
        this.model = opts.profileInfo;
        this.model.isPinned = this.opts.isPinned;
        this.model.includePresence = opts.includePresence === undefined ? true : opts.includePresence;
        this.sandbox = opts.sandbox;
        this.model.dropdownId = _.uniqueId(this.opts.module+'_');
    },

    render: function (opts) {
        this.$el.html(profileHeaderTmpl(this.model));
        return this;
    },

    destroy: function() {
        this.remove();
    }
});