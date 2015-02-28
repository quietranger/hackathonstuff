var Symphony = require('symphony-core');
var baseProfileView = require('../../profile/views/profileView');
var profileInfoView = require('./profileInfoView');
var profileHeaderView = require('../../profile/views/profileHeaderView');
var profileMessageListView = require('../../common/externalSocialMessageList');

var profileContainerTmpl = require('../../profile/templates/profile-container.handlebars');
var emptyProfileTmpl = require('../templates/empty-profile.handlebars');

module.exports = baseProfileView.extend({
    className: 'profile-module module tw',

    render: function() {
        var self = this;

        this.$content.html(profileContainerTmpl(this.opts));

        this.qProfileInfo.promise.then(function() {
            if (_.isEmpty(self.profileInfo)) {
                self.$el.html(emptyProfileTmpl());
                return;
            }

            self.messageListView = new profileMessageListView(_.extend({
                    eventBus: self.eventBus,
                    userId: self.userId,
                    type: 'social-thread',
                    connectorId: 'tw'
                }, self.opts
            ));

            // only bother with this if it's the current user
            // or if it's an OBO user
            // TODO check for OBO user

            self.profileInfoView = new profileInfoView({
                profileInfo: self.profileInfo,
                el: self.$el.find('.profile-info'),
                sandbox: self.sandbox,
                eventBus: self.eventBus
            });

            self.profileHeaderView = new profileHeaderView({
                profileInfo: self.profileInfo,
                el: self.$el.find('.module-header'),
                sandbox: self.sandbox,
                includePresence: false
            });

            self.profileHeaderView.render();

            self.profileInfoView.render();

            self.$el.find('.profile-messages').html(self.messageListView.render().el);

            self.qRendered.resolve();
        });

        return Symphony.Module.prototype.render.apply(this, arguments);
    },

    didGetAccountData: function(acc) {
        var self = this;

        var following = _.findWhere(acc.filters, { filterType: 'FOLLOWING' });
        var twitterFollowers = _.map(_.where(following.ruleGroup.rules, { connectorId: 'tw' }), function(i) {
            return parseInt(i.id);
        });

        this.sandbox.send({
            id: "SHOW_EXTERNAL_USERS",
            payload: {
                id_list: this.userId,
                connector_id: 'tw'
            }
        }).then(function (rsp) {
            var result = rsp.users[0];

            if (_.isEmpty(result)) {
                self.profileInfo = {};
                self.qProfileInfo.resolve();
            }

            self.profileInfo = {
                person: {
                    prettyName: result.name,
                    imageUrl: result.imageUrl,
                    id: result.id
                },
                followerCount: result.followerCount,
                screenName: result.screenName,
                verified: result.verified,
                requestorFollowingUser: _.contains(twitterFollowers, result.id)
            };

            self.streamId = result.id;
            self.userId = result.id;

            self.qProfileInfo.resolve();
        });
    }
});
