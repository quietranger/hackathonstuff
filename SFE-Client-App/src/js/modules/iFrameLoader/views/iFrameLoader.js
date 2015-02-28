var Backbone = require('backbone');
var Symphony = require('symphony-core');

module.exports = Symphony.Module.extend({
    className: 'iframe-loader module',

    events: {

    },

    moduleHeader: function() {
        if(this.opts && this.opts.name) {
            return "<h2>"+this.opts.name+"</h2>";
        } else {
            return "<h2>iFrame Loader</h2>";
        }
    },

    initialize: function(opts) {
        if(opts.runHeadless) {
            this.runHeadless = {
                'viewId':       opts.viewId,
                'htmlId':       opts.viewId.replace(/[^A-Za-z-_0-9]/g, "")
            };
        }

        Symphony.Module.prototype.initialize.call(this, opts);
    },

    render: function() {
        if(this.opts && this.opts.iFrame) {
            this.$content.html("<iframe src='"+this.opts.iFrame+"' class='app-window "+this.opts.appId+"'></iframe>");
        }
        return Symphony.Module.prototype.render.call(this);
    },

    postRender: function() {
        this.sandbox.publish('iframe:rendered', null, _.omit(_.extend(this.opts, {'init': this.opts.init}), 'sandbox'));
        return Symphony.Module.prototype.postRender.call(this);
    },

    destroy: function() {
        this.sandbox.publish('iframe:remove', null, this.opts);
        Symphony.Module.prototype.destroy.call(this);
    }
});
