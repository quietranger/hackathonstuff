// Dependencies
var config = require("../../../../config/config");
var Symphony = require("symphony-core");

// Templates
var breadcrumbsTmpl = require("../../templates/tools/breadcrumbs.hbs");

// Export sub-view
module.exports = Symphony.View.extend({
    tagName: "ul",

    initialize: function (opts) {
        Symphony.View.prototype.initialize.apply(this, arguments);
        this._resetView(opts);
    },

    render: function () {
        this.$el.html(breadcrumbsTmpl({
            breadcrumbs: this._breadcrumbs
        }));
        this.delegateEvents();
        return Symphony.View.prototype.render.apply(this, arguments);
    },

    // Events

    events: {
        "click li.breadcrumb a": "_followBreadcrumbLink"
    },

    _followBreadcrumbLink: function (event) {
        var index = parseInt(event.currentTarget.dataset.index);
        this._breadcrumbs[index].action();
        this._breadcrumbs.splice(index + 1, 10);
        this._delinkifyLast();
        this.render();
    },

    // Helpers

    _add: function (breadcrumb) {
        var valid = breadcrumb &&
            typeof breadcrumb == "object" &&
            typeof breadcrumb.name == "string" &&
            typeof breadcrumb.action == "function";
        if (valid) {
            this._linkifyLast();
            breadcrumb.link = false;
            this._breadcrumbs.push(breadcrumb);
            return true;
        }
        ;
        return false;
    },

    _linkifyLast: function () {
        if (this._breadcrumbs.length >= 1) {
            this._breadcrumbs[this._breadcrumbs.length - 1].link = true;
        }
        ;
    },

    _delinkifyLast: function () {
        if (this._breadcrumbs.length >= 1) {
            this._breadcrumbs[this._breadcrumbs.length - 1].link = false;
        }
        ;
    },

    _resetView: function (opts) {
        this.sandbox = this.sandbox || opts.sandbox;
        this._breadcrumbs = opts.breadcrumbs || [];
    }

});
