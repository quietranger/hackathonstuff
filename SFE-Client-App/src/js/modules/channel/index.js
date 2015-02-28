var Backbone = require('backbone');

var Q = require('q');

var channelView = Backbone.View.extend({
    className: 'channel-module module',
    sizeX: 8,
    sizeY: 8,
    events: {
    },
    initialize: function (opts) {
        var self = this;
        self.opts = opts || {};
        self.sandbox = opts.sandbox;
        //event bus for sub-module communication
        self.eventBus = _.extend({}, Backbone.Events);
        self.opts.tag = 'Channel';
    },

    render: function () {
    },
    postRender: function(){
    },
    destroy: function () {
    },
    exportJson: function () {
        return {
            module: 'channel',
            sizeX: this.sizeX,
            sizeY: this.sizeY
        };
    }
});

module.exports = {
    createView: channelView
};