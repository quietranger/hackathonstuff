var BaseView = require('./views/baseView');
var imMenuTmpl = require('./templates/im-menu.handlebars');

var IMView = BaseView.extend({
    className: 'instant-message chat-module module',
    rteActions: ['emoticons', 'attach', 'chime', 'disable'],

    initialize: function(opts) {
        this.events['click .one-to-one-user-profile'] = 'showFullProfile';

        opts.isIM = true;
        //call parent view's initialization function
        BaseView.prototype.initialize.call(this, opts);
        this.moduleMenu = imMenuTmpl;
    },

    showFullProfile: function() {
        var self = this;
        this.sandbox.publish('view:show', null, {
            module: 'profile',
            userId: self.opts.oneToOneUserId[0]
        });
    }
});

module.exports = {
    createView: IMView
};