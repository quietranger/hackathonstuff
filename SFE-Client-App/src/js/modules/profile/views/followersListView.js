var Backbone = require('backbone');
var config = require('../../../config/config');
var Handlebars = require("hbsfy/runtime");

var personListTmpl = require('../../common/personList/personList.handlebars');

var followersTmpl = require('../templates/followers.handlebars');

module.exports = Backbone.View.extend({
    className: 'followers-list-container',
    initialize: function (opts) {
        var self = this;

        self.opts = opts || {};
        self.sandbox = opts.sandbox;

        // get the following list
        self.opts.followingListData = self.sandbox.send({
            id: "GET_FOLLOWERS",
            urlExtension: self.opts.profileInfo.person.id
        });
    },
    events: {
        'click .close': 'close',
        'click .profile-link': 'openProfile'
    },
    render: function () {
        var self = this;
        self.$el.html(followersTmpl(self.opts));
        this.opts.followingListData.done(function (rsp) {
            if (rsp.result.length === 0) {
                rsp.isEmpty = true;
            }
            self.$el.append(personListTmpl(rsp));
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
