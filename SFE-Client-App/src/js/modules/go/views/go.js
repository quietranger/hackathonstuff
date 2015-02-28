var Backbone = require('backbone');


var goTmpl = require('../templates/go.handlebars');

var goIm = require('../../common/goIm/goIm');
var goRoom = require('../../common/goRoom/goRoom');
var goFilter = require('../../common/goFilter/goFilter');
var goBlast = require('../../common/goBlast/index');
var mixinDefaults = require('../../common/mixins/moduleDefaults');

module.exports = Backbone.View.extend({
    id: 'go-module',
    className: 'module',

    events: {
        'click .im'          : 'createIm',
        'click .room'        : 'createRoom',
        'click .filter'      : 'createFilter',
        'click .blast'       : 'createBlast',
        'click .close'       : 'close'
    },

    render: function() {
        this.$el.append(goTmpl());

        return this;
    },

    createIm: function() {
        var self = this;

        var contentView = new goIm({
            'sandbox'   : self.sandbox
        });

        this.sandbox.publish('modal:hide');

        this.sandbox.publish('modal:show', null, {
            contentView: contentView,
            title: 'Instant Message',
            isFlat: true
        });
        this.sandbox.publish("usage-event", null, {
            action: "click",
            details: {
                containerView: 'go',
                action: 'createIm'
            },
            immediate: false
        });
    },

    createRoom: function() {
        var self = this;

        var contentView = new goRoom({
            'sandbox'   : self.sandbox
        });

        this.sandbox.publish('modal:hide');

        this.sandbox.publish('modal:show', null, {
            contentView: contentView,
            title: 'Chat Room',
            isFlat: true
        });

        this.sandbox.publish("usage-event", null, {
            action: "click",
            details: {
                containerView: 'go',
                action: 'createRoom'
            },
            immediate: false
        });
    },

    createFilter: function(){
        var self = this;

        var contentView = new goFilter({
            'sandbox'   : self.sandbox,
            'createNew' : true
        });

        this.sandbox.publish('modal:hide');

        this.sandbox.publish('modal:show', null, {
            contentView: contentView,
            title: 'Filter',
            isFlat: true
        });

        self.sandbox.publish("usage-event", null, {
            action: "click",
            details: {
                containerView: 'go',
                action: 'createFilter'
            },
            immediate: false
        });
    },

    createBlast: function() {
        var contentView = new goBlast({
            sandbox: this.sandbox
        });

        this.sandbox.publish('modal:hide');

        this.sandbox.publish('modal:show', null, {
            contentView: contentView,
            title: 'Blast Message',
            isFlat: true
        });

        this.sandbox.publish("usage-event", null, {
            action: "click",
            details: {
                containerView: 'go',
                action: 'createBlast'
            },
            immediate: false
        });
    },

    close: function() {
        this.sandbox.publish('modal:hide');
        this.sandbox.publish("usage-event", null, {
            action: "click",
            details: {
                containerView: 'go',
                action: 'closeModal'
            },
            immediate: false
        });
    }
});

mixinDefaults(module.exports);
var presenceMixin = require('../../common/mixins/presenceMixin');
presenceMixin(module.exports);
