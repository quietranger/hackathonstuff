var Backbone = require('backbone');
var config = require('../../../../config/config');
var Handlebars = require("hbsfy/runtime");

var mixinPresence = require('../../mixins/presenceMixin');
var personListTmpl = require('../../../common/personList/personList.handlebars');

module.exports = Backbone.View.extend({
    className: 'sharer-list-container',
    initialize: function (opts) {
        var self = this;

        self.opts = opts || {};
        self.sandbox = opts.sandbox;

        // get the following list
        self.opts.sharedByListData = self.sandbox.send({
            id: "SHARED_BY",
            payload: {
                id: self.opts.messageId
            }
        });
    },
    events: {
        'click .close': 'close',
        'click .profile-link': 'openProfile'
    },
    render: function () {
        var self = this;
        self.$el.html(personListTmpl({}));
        this.opts.sharedByListData.done(function (rsp) {
            if (rsp.envelopes.length === 0) {
                rsp.isEmpty = true;
            }
            self.$el.html(personListTmpl({ result: rsp.envelopes[0].sharedBy }));
        });
        return this;
    },
    close: function () {
        this.sandbox.publish('modal:hide');
    },
    openProfile: function(e){
        var target = $(e.currentTarget);

        this.sandbox.publish('view:show', null, {
            module: 'profile',
            userId: target.attr('data-userid')
        });

        this.close();
    }
});

mixinPresence(module.exports);
