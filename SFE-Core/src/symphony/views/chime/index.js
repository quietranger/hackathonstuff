var Backbone = require('backbone');
var chimeTmpl = require('./chimePopup');

module.exports = Backbone.View.extend({
    initialize: function(opts) {
        var self = this;
        this.opts = opts || {};
        this.sandbox = opts.sandbox;
        this.isMouseOver = false;
        this.isExpired = false;
    },
    className: 'chime',
    events: {
        'click' : 'openChat',
        'mouseenter' : 'mouseEnter',
        'mouseleave' : 'mouseLeave'
    },
    render: function() {
        this.$el.append(chimeTmpl(this.opts.msg));
        return this;
    },
    openChat: function() {
        //todo publish show event
        this.sandbox.publish("view:show", null, {
            streamId: this.opts.msg.streamId,
            module: "im"
        });

        this.remove();
    },
    mouseEnter: function() {
        this.isMouseOver = true;
        console.log('mouse over', true);
    },
    mouseLeave: function() {
        this.isMouseOver = false;
        console.log('mouse over', false);
        this.destroy();
    },
    expire: function() {
        this.isExpired = true;
        this.destroy();
    },
    destroy: function(){
        if(this.isExpired && !this.isMouseOver) {
            console.log('close');
            this.remove();
        }
    }
});
