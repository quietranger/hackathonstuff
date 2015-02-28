var Symphony = require('symphony-core');
var Handlebars = require("hbsfy/runtime");
var OnBehalfView = require('../../onbehalf/views/onbehalf.js');

var config = require('../../../config/config');
var popover = require('../../common/popover');
var errors = require('../../../config/errors');
var profileInfoViewContainerTmpl = require('../templates/profile-info-view-container.handlebars');
var utils = require('symphony-core').Utils;

var followingListView = require('../views/followingListView');
var followersListView = require('../views/followersListView');
var roomListView = require('../views/roomListView');
var aliasColorCodePickerView = require('../../common/aliasColorCodePicker');

module.exports = Symphony.View.extend({
    className: 'profile-info-container',

    events: {
        'click .action_btn_following': 'launchLCFollowingModal',
        'click .action_btn_followers': 'launchFollowersModal',
        'click .action_btn_rooms': 'launchRoomListModal',
        'click .action_btn_dept': 'launchDeptSearch',
        'click .action_btn_im': 'beginChat',
        'click .action_btn_call': 'call',
        'click .action_btn_follow': 'follow',
        'click .action_btn_unfollow': 'unfollow',
        'click .action_btn_pobo': 'postAs',
        'click .alias-color-button': 'showAliasColorCodePicker'
    },

    psEvents: {
        'following:change': 'onFollowingChange',
        'colors:updated': 'onColorUpdate',
        'avatar:change': 'onAvatarChange'
    },

    initialize: function (opts) {
        Symphony.View.prototype.initialize.apply(this, arguments);

        var self = this;
        this.opts = opts || {};
        this.model = opts.profileInfo;
        this.model.shouldShowIm = this.model.person.id !== this.opts.currentUserId;
        this.model.canCall = opts.canCall;
        this.aliasColorCodePicker = null;
        this.deptSearchCriteria = this.model.person.deptCode || this.model.person.deptName;

        this.colorData = this.sandbox.getData('documents.' + config.PER_USER_METADATA_DOCUMENT_ID + '.' + this.model.person.id).then(function(rsp) {
            if (rsp) {
                self.model.colorCode = rsp.color;
                self.render();
            }
        });
    },


    render: function () {
        var self = this;

        this.colorData.then(function() {
            self.$el.html(profileInfoViewContainerTmpl(_.extend(self.model, {
                showShowDeptSearch: self.deptSearchCriteria
            })));
        });

        return Symphony.View.prototype.render.apply(this, arguments);
    },

    showAliasColorCodePicker: function(e) {
        if (this.aliasColorCodePicker) {
            this.aliasColorCodePicker.show();
            return;
        }

        var picker = new aliasColorCodePickerView({
            sandbox: this.sandbox,
            eventBus: this.eventBus,
            model: this.model
        });

        this.aliasColorCodePicker = new popover({
            target: e.currentTarget,
            contentView: picker,
            showDelay: 0,
            position: 'bottom left',
            openOnClick: true,
            tetherOptions: {
                offset: '-15px 5px'
            }
        });

        this.aliasColorCodePicker.show();
    },

    launchLCFollowingModal: function () {
        var opts = {
            followeeCount: parseFolloweeCount(this.model.followeeCount, 'lc'),
            connectorid: 'lc'
        };

        _.extend(opts, _.omit(this.opts, 'el'));

        this.sandbox.publish('modal:show', null, {
            title: 'Following',
            contentView: new followingListView(opts)
        });
    },

    launchFollowersModal: function () {
        var opts = {
            followerCount: this.model.followerCount
        };

        _.extend(opts, _.omit(this.opts, 'el'));

        this.sandbox.publish('modal:show', null, {
            title: 'Followers',
            contentView: new followersListView(opts)
        });
    },

    launchRoomListModal: function () {
        this.sandbox.publish('modal:show', null, {
            title: 'Rooms',
            contentView: new roomListView(_.extend({
                roomCount: this.model.roomCount
            }, _.omit(this.opts, 'el')))
        });
    },

    launchDeptSearch: function () {
        this.sandbox.publish('view:show', null, {
            module: 'search',
            'query': this.deptSearchCriteria,
            'queryType': 'people'
        });
    },

    call: function () {
        // TODO invoke the appbridge to call this person
        var opts = {
            fnName: 'callUser',
            param: {userId: this.model.person.screenName}
        };
        this.sandbox.publish('appBridge:fn', null, opts);
    },

    follow: function () {
        var self = this;
        var query = this.sandbox.send({
            id: 'ADD_FOLLOWING',
            payload: [{
                type: "DEFINITION",
                definitionType: "USER_FOLLOW",
                id: self.model.person.id,
                text:  self.model.person.screenName,
                connectorId: self.model.person.userType === 'system' ? 'lc' : self.model.person.userType
            }]
        });

        query.done(function (rsp) {
                //broadcast the following change, datastore will update itself upon receiving the event
                self.sandbox.publish('following:change', null, rsp);
            },
            function (rsp) {
                //  TODO handle failure
                if(rsp.status === 411){
                    self.showErrorMessage(errors.COMMON.INFO_BARRIER.IB_ERROR, 0);
                }
            });
    },

    unfollow: function () {
        var self = this;
        var query = this.sandbox.send({
            id: 'DELETE_FOLLOWING',
            urlExtension: encodeURIComponent(self.model.person.userType === 'system' ? 'lc' : self.model.person.userType)+'/'+encodeURIComponent(self.model.person.id)
        });

        query.done(function (rsp) {
                //broadcast the following change, datastore will update itself upon receiving the event
                self.sandbox.publish('following:change', null, rsp);
            },
            function () {
                //  TODO handle failure
            });
    },

    onFollowingChange: function (context, args) {
        var self = this;
        var followRule = _.find(args.ruleGroup.rules, function(rule){
            return Number(rule.id) === self.model.person.id; //this is a hack until the BE returns IDs in the proper type
        });
        var requestorFollowingUser;
        if(followRule) {
            requestorFollowingUser = true;
        } else {
            requestorFollowingUser = false;
        }

        if(self.model.requestorFollowingUser && !requestorFollowingUser){
            //if I just unfollowed this user, his follower count should minus 1
            self.model.followerCount--;
        }else if(!self.model.requestorFollowingUser && requestorFollowingUser){
            //if I just followed this user, his follower count should plus 1
            self.model.followerCount++;
        }

        self.model.requestorFollowingUser = requestorFollowingUser;

        self.render();
    },

    onColorUpdate: function(ctx, colors) {
        var self = this;
        var color = _.find(colors, function(item) {
            return item.userId === self.model.person.id;
        });

        var $tag = self.$el.find('.alias-color-button');

        $tag.attr('class', 'alias-color-button');

        if (color) {
            $tag.addClass('user-selected-color-' + color.color);
        }
    },

    onAvatarChange: function(ctx, avatar) {
        if (this.model.person.id !== avatar.userId) {
            return;
        }

        this.$el.find('.avatar-wrap img').attr('src', avatar.images['50']);
    },

    postAs: function () {
        var self = this;

        this.sandbox.publish('modal:show', null, {
            title: 'Post On Behalf',
            isFlat: true,
            contentView: new OnBehalfView({
                sandbox: self.sandbox,
                userInfo: self.model,
                myId: self.opts.currentUserId,
                eventBus: self.eventBus
            })
        });
    },

    beginChat: function () {
        var self = this;

        utils.startChat({
            'sandbox': this.sandbox,
            'userId': [self.model.person.id]
        }).then(function(){
            self.close();
        }, function(){
            //todo failed
        });
    },

    destroy: function() {
        var self = this;

        if (this.aliasColorCodePicker) {
            this.aliasColorCodePicker.destroy();
        }

        Object.keys(this.psEvents).forEach(function (subEvent) {
            self.sandbox.unsubscribe(subEvent, self.psEvents[subEvent]);
        });

        this.remove();

        Symphony.View.prototype.destroy.apply(this, arguments);
    }
});

Handlebars.registerHelper('parseLCFolloweeCount', function (followeeCountString) {
    return parseFolloweeCount(followeeCountString, "lc");
});


Handlebars.registerHelper('parseTWFolloweeCount', function (followeeCountString) {
    return parseFolloweeCount(followeeCountString, "tw");
});

function parseFolloweeCount(str, userType) {
    var count = 0;
    var followeeCountArr = str.split(',');
    _.each(followeeCountArr, function (str) {
        if (str.split(":")[0] === userType) {
            count = str.split(":")[1];
        }
    });
    return count;
}
