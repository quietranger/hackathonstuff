var Backbone = require('backbone');
var errors = require('../../../../config/errors');

var deactivationConfirmationTmpl = require('../../templates/deactivation-confirmation.handlebars');

var showErrorMessage = require('../../../common/mixins/showErrorMessage');

module.exports = Backbone.View.extend({
    className: 'room-deactivation-confirmation',

    events: {
        'click .close': 'close',
        'click .submit': 'deactivateRoom'
    },

    initialize: function(opts) {
        this.opts = opts || {};
        this.sandbox = opts.sandbox;
        this.threadId = opts.threadId;
    },

    render: function() {
        this.$el.html(deactivationConfirmationTmpl(this.opts));

        return this;
    },

    deactivateRoom: function() {
        var self = this;

        var query = this.sandbox.send({
            id: 'ROOM_MANAGER',
            payload: {
                action: 'deactivate',
                threadid: this.threadId
            }
        });

        query.then(function() {
            self.close();
        }, function() {
            self.showErrorMessage(errors.CHATROOM.DEACTIVATE_ROOM);
        });
    },

    close: function() {
        this.sandbox.publish('modal:hide');
    },

    destroy: function() {
        this.remove();
    }
});

_.extend(module.exports.prototype, showErrorMessage);