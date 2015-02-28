var Symphony = require('symphony-core');
var Q = require('q');
var utils = Symphony.Utils;

var inlineProfileTmpl = require('./templates/inline-profile.handlebars');
var roomListView = require('../../profile/views/roomListView');
var followingListView = require('../../profile/views/followingListView');
var followersListView = require('../../profile/views/followersListView');
var errors = require('../../../config/errors');

require('../helpers');

module.exports = Symphony.View.extend({
    className: 'inline-user-profile-container',

    events: {
        'click .action_btn_profile': 'showProfile',
        'click .action_btn_rooms': 'launchRoomListModal',
        'click .action_btn_followers': 'launchFollowersModal',
        'click .action_btn_following': 'launchLCFollowingModal',
        'click .close': 'close',
        'click .profile-link': 'openProfile',
        'click .image': 'openProfile',
        'click .action_btn_im': 'beginChat',
        'click .action_btn_call': 'call',
        'click .follow': 'follow',
        'click .following': 'unfollow',
        'click .inline-profile-name': 'openProfile',
        'click .close-profile': 'hideProfile'
    },

    psEvents: {
        'following:change': 'reRender'
    },

    initialize: function (opts) {
        Symphony.View.prototype.initialize.apply(this, arguments);
        
        this.opts = opts || {};
        this.userId = opts.userId;
        this.userType = opts.userType;
        this.profileInfo = {};

        var self = this;

        Q.all( [ this.sandbox.isRunningInClientApp(), this.accountDataPromise ]).spread(function (inWrapper, account) {
            var isCurrentUser = self.userId.toString() === account.userName.toString(),
                isTwitter = self.userType === 'tw';

            self.account = account;
            self.opts.canCall = inWrapper && !isCurrentUser;
            self.opts.shouldShowIm = !isCurrentUser && !isTwitter;
            self.getProfile();
        });
    },

    render: function(accountData, hasError) {
        var content = _.isEmpty(this.user) ? {} : this.user;

        if(content && !hasError) {
            content.canCall = this.opts.canCall;
            content.shouldShowIm = this.opts.shouldShowIm;
        }

        content.error = hasError;

        var markup = inlineProfileTmpl(content);

        this.$el.html(markup);

        return this;
    },

    reRender: function(context, args) {
        var self = this;
        var followRule = _.find(args.ruleGroup.rules, function(rule){
            return rule.id === self.userId;
        });

        if (followRule) {
            this.user.requestorFollowingUser = true;
        } else {
            this.user.requestorFollowingUser = false;
        }

        this.render();
    },

    getProfile: function() {
        var query, handler;

        if (this.userType === 'tw') {
            query = this.sandbox.send({
                id: 'SHOW_EXTERNAL_USERS',
                payload: {
                    id_list: this.userId,
                    connector_id: this.userType
                }
            });

            handler = this._didGetTwitterProfile.bind(this);
        } else {
            query = this.sandbox.send({
                id: 'GET_PROFILE',
                payload: {
                    action: 'usercurrent',
                    userid: this.userId
                }
            });

            handler = this._didGetProfile.bind(this);
        }

        query.done(handler);
    },

    _didGetProfile: function(rsp) {
        var userJSON = rsp;

        if (!userJSON) {
            this.render(null, true);

            return;
        }

        var user = _.extend(_.omit(userJSON, 'person'), userJSON.person); // unroll the person object into the response object

        _.extend(this.profileInfo, user);

        this.user = user;

        this.user.profileIsNotCurrentUser = user.id !== this.account.userName;

        this.render();

        this.eventBus.trigger('popover:reposition');
    },

    _didGetTwitterProfile: function(rsp) {
        if (!rsp.users || !rsp.users[0]) {
            this.render(null, true);

            return;
        }

        var user = rsp.users[0];

        user.prettyName = user.name;
        user.isTwitter = true;

        _.extend(this.profileInfo, user);

        this.user = user;
        this.user.profileIsNotCurrentUser = true;
        this.render();
        this.eventBus.trigger('popover:reposition');
    },

    showProfile: function() {
        this.sandbox.publish('view:show', null, {
            module: 'profile',
            userId: this.userId
        });
    },

    call: function () {
        var opts = {
            fnName: 'callUser',
            param: {userId: this.user.screenName} /*use kerberos to call*/
        };
        this.sandbox.publish('appBridge:fn', null, opts);
    },

    beginChat: function () {
        var self = this;

        utils.startChat({
            'sandbox': this.sandbox,
            'userId': [this.userId]
        }).then(function(){
            self.eventBus.trigger('popover:hide');
        }, function(){
            //todo failed
        });
    },

    launchRoomListModal: function () {
        var params = {
            eventBus: this.eventBus,
            profileInfo: _.extend({}, this.profileInfo), // copy to prevent mutation
            roomListData: _.extend({}, this.roomListData),
            sandbox: this.sandbox
        };
        var self = this;
        this.sandbox.publish('modal:show', null, {
            title: self.profileInfo.person.prettyName + ' is in ' + self.profileInfo.roomCount + ' rooms',
            contentView: new roomListView(params)
        });
    },

    launchLCFollowingModal: function () {
        this.sandbox.publish('modal:show', null, {
            title: this.profileInfo.person.prettyName + ' is following ' + this.parseFolloweeCount(this.profileInfo.followeeCount, "lc"),
            contentView: new followingListView({
                sandbox: this.sandbox,
                profileInfo: _.extend({}, this.profileInfo) //copy to prevent mutation
            })
        });
    },

    parseFolloweeCount: function(str, userType){
        var count = 0;
        var followeeCountArr = str.split(',');
        _.each(followeeCountArr, function (str) {
            if (str.split(":")[0] === userType) {
                count = str.split(":")[1];
            }
        });
        return count;
    },

    launchFollowersModal: function () {
        this.sandbox.publish('modal:show', null, {
            title: this.profileInfo.person.prettyName + ' has ' + this.profileInfo.followerCount + ' followers',
            contentView: new followersListView({
                sandbox: this.sandbox,
                profileInfo: _.extend({}, this.profileInfo)
            })
        });
    },

    openProfile: function(e){
        var target = $(e.currentTarget);

        this.sandbox.publish('view:show', null, {
            module: 'profile',
            userId: target.attr('data-userid')
        });

        this.eventBus.trigger('popover:hide');
    },

    hideProfile: function(){
        this.eventBus.trigger('popover:hide');
    },

    follow: function () {
        var self = this;
        var entities = [];
        entities.push({
            type: "DEFINITION",
            definitionType: "USER_FOLLOW",
            id: self.user.id,
            text: self.user.screenName,
            connectorId: self.user.userType === 'system' ? 'lc' : self.user.userType
        });

        var query = this.sandbox.send({
            id: 'ADD_FOLLOWING',
            payload: entities
        });

        query.done(function (rsp) {
            self.user.requestorFollowingUser = true;
            self.sandbox.publish('following:change', null, rsp);
        }, function (rsp) {
            //  TODO handle failure
            if(rsp.status === 411){
                self.showErrorMessage(errors.COMMON.INFO_BARRIER.IB_ERROR, 0);
            }
        });
    },

    unfollow: function () {
        var self = this;
        var connectorId = self.user.userType === 'system' ? 'lc' : self.user.userType;

        var query = this.sandbox.send({
            id: 'DELETE_FOLLOWING',
            urlExtension: encodeURIComponent(connectorId) + '/' + encodeURIComponent(self.user.id)
        });

        query.done(function (rsp) {
                self.user.requestorFollowingUser = false;
                // Propogate the event to the parent view
                self.eventBus.trigger('profile:unfollowed');
                self.sandbox.publish('following:change', null, rsp);
            },
            function () {
                //  TODO handle failure
            });
    }
});
