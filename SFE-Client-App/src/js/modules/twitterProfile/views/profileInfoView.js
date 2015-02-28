var Backbone = require('backbone');
var Handlebars = require("hbsfy/runtime");

var profileInfoViewContainerTmpl = require('../templates/profile-info-view.handlebars');

module.exports = Backbone.View.extend({
    className: 'profile-info-container',

    events: {
        'click .followbutton': 'follow',
        'click .unfollowbutton': 'unfollow'
    },

    initialize: function (opts) {
        var self = this;
        this.opts = opts || {};
        this.model = opts.profileInfo;
        this.sandbox = opts.sandbox;
        this.eventBus = opts.eventBus;
    },


    render: function () {
        this.$el.html(profileInfoViewContainerTmpl(this.model));
        return this;
    },

    follow: function () {
        var self = this;

        var query = this.sandbox.send({
            id: 'ADD_FOLLOWING',
            payload: [{
                type: "DEFINITION",
                definitionType: "USER_FOLLOW",
                id: self.model.person.id,
                text:  self.model.screenName,
                connectorId: 'tw'
            }]
        });

        query.done(function (rsp) {
                //since symphony follower count is not rendered, no need to subscribe to following:change event, just re-render locally
                self.model.requestorFollowingUser = true;
                //broadcast the following change, datastore will update itself upon receiving the event
                self.sandbox.publish('following:change', null, rsp);
                self.render();
            },
            function (rsp) {
                //  TODO handle failure
            });
    },

    unfollow: function () {
        var self = this;

        var query = this.sandbox.send({
            id: 'DELETE_FOLLOWING',
            urlExtension: encodeURIComponent('tw')+'/'+encodeURIComponent(self.model.person.id)
        });

        query.done(function (rsp) {
                self.model.requestorFollowingUser = false;
                //broadcast the following change, datastore will update itself upon receiving the event
                self.sandbox.publish('following:change', null, rsp);
                self.render();
            },
            function (rsp) {
                //  TODO handle failure
            });
    },
    destroy: function(){
        this.remove();
    }
});