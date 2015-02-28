var Backbone = require('backbone');
var config = require('../../../../config/config');
var Handlebars = require("hbsfy/runtime");

var mixinPresence = require('../../mixins/presenceMixin');
var deletePostTmpl = require('../templates/deletePost.handlebars');
var showErrorMessage = require('../../mixins/showErrorMessage');

module.exports = Backbone.View.extend({
    className: 'delete-post',
    initialize: function (opts) {
        this.opts = opts || {};
        this.sandbox = opts.sandbox;
        this.opts.message.attributes.isInDeleteModal = true;
    },
    events: {
        'click .cancel'     : 'close',
        'click .delete'      : 'submit'
    },
    render: function () {
        var MessageView = require('./messageView');

        this.$el.html(deletePostTmpl({}));
        this.msgView = new MessageView({
            sandbox: this.sandbox,
            model: this.opts.message
        });
        this.$el.find('.message-to-delete').html(this.msgView.render().$el);
        return this;
    },
    destroy: function(){
        this.msgView.destroy();
        this.remove();
    },
    close: function () {
        this.sandbox.publish('modal:hide');
    },
    submit: _.debounce(function() {
        var self = this;
        this.sandbox.send({
            'id': 'SEND_CHAT',
            'payload': {
                'version': 'DELETE_EVENT',
                'deleteMessageId': this.opts.message.get('messageId')
            }
        }).then(function(){
            //successfully deleted
            self.close();
            self.sandbox.publish('delete:message', null, self.opts.message.get('messageId'));

        }, function(error){
            self.showErrorMessage(error.responseJSON.message);
        });
    }, 1000, true)
});

_.extend(module.exports.prototype, showErrorMessage);

mixinPresence(module.exports);
