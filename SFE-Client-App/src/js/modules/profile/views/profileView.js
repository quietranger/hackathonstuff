var Symphony = require('symphony-core');
var Q = require('q');
var errors = require('../../../config/errors');

var profileContainerTmpl = require('../templates/profile-container.handlebars');
var textInputView = require('../../common/textInput/textInput');
var profileMessageListView = require('./profileMessageListView');
var profileInfoView = require('./profileInfoView');
var profileMenu = require('../../common/templates/menu.handlebars');

module.exports = Symphony.Module.extend({
    className: 'profile-module module',

    moduleHeader: '<h2>Loading profile...</h2>',

    moduleMenu: profileMenu(),

    initialize: function (opts) {
        Symphony.Module.prototype.initialize.apply(this, arguments);

        var self = this;

        self.userId = opts.userId;
        self.qProfileInfo = Q.defer();
        self.qRendered = Q.defer();

        self.sandbox.isRunningInClientApp().then(function(rsp){
            self.isRunningInClientApp = rsp;
            self.sandbox.getData('app.account').then(function (rsp) {
                self.didGetAccountData(rsp);
            });
        });

        // TODO remove this uber hack so that we can actually properly get updates LIVE
        this.listenTo(this.eventBus, 'profile:obosent', function () {
            setTimeout(function () {
                self.messageListView.destroy();
                self.messageListView = new profileMessageListView(_.extend({
                        eventBus: self.eventBus,
                        streamId: self.streamId,
                        userId: self.userId,
                        type: 'social-thread',
                        currentUserId: self.opts.account.userName,
                        currentUserProfileId: self.opts.account.myCurrentThreadId,
                        parentViewId: self.viewId
                    },
                    self.opts
                ));
                self.$el.find('.profile-messages').append(self.messageListView.render().el);
                self.messageListView.postRender();
            }, 2000); // wait 2 seconds and then reload the messages
        });

        this.listenTo(this.eventBus, 'textinput:resize', this.textAreaDidResize);
        this.listenTo(this.eventBus, 'module:focused', this.didTakeFocus);
    },

    textAreaDidResize: function () {
        if(this.opts.isMyProfile) {
            this.$el.find('.text-input-wrap').css('height', this.postInput.$el.height());
        }
    },
    
    didGetAccountData: function(acc) {
        var self = this;
        
        _.extend(this.opts, {account: acc});
        if (!this.userId) {
            this.userId = this.opts.account.userName;
        }

        this.opts.isMyProfile = this.opts.account.userName === this.userId;
        this.canCall = this.opts.account.entitlement.callEnabled && this.isRunningInClientApp && !this.opts.isMyProfile;
        this.sandbox.send({
            id: "GET_PROFILE",
            payload: {
                action: "usercurrent",
                userid: self.userId
            }
        }).then(function (rsp) {
            self.profileInfo = {};
            _.extend(self.profileInfo, rsp);
            self.streamId = self.profileInfo.person.myCurrentThreadId;

            self.qProfileInfo.resolve();
        });
    },

    render: function () {
        var self = this;

        this.qProfileInfo.promise.then(function () {
            /*
             TODO -- if this is "MY PROFILE" then we should already have messages in the datastore
             to use for the init of the profileMessageListView
             */
            self.currentUserId = self.opts.account.userName;
            
            self.moduleHeader = '<h2 class="aliasable colorable" data-userid="' + self.profileInfo.person.id + '">' +
                self.profileInfo.person.prettyName + '</h2>';

            self.messageListView = new profileMessageListView(_.extend({
                    eventBus: self.eventBus,
                    streamId: self.streamId,
                    userId: self.userId,
                    type: 'social-thread',
                    currentUserId: self.opts.account.userName,
                    currentUserProfileId: self.opts.account.myCurrentThreadId,
                    parentViewId: self.viewId
                },
                self.opts
            ));

            // only bother with this if it's the current user
            // or if it's an OBO user
            // TODO check for OBO user

            self.profileInfoView = new profileInfoView({
                profileInfo: self.profileInfo,
                sandbox: self.sandbox,
                eventBus: self.eventBus,
                currentUserId: self.opts.account.userName,
                canCall: self.canCall
            });

            self.$el.find('.profile-info').html(self.profileInfoView.render().postRender().el);

            if (self.opts.isMyProfile) {
                self.postInput = new textInputView({
                    eventBus: self.eventBus,
                    showButton: false,
                    placeholderText: 'Compose a message...',
                    sandbox: self.sandbox,
                    threadId: self.streamId,
                    userId: self.userId,
                    className: 'post-compose textarea-input',
                    rteActions: ['emoticons', 'attach'],
                    expandDirection: 'l',
                    maxlengthplacement: 'bottom'
                });

                self.$el.find('.profile-post').html(self.postInput.render().el);
                self.$el.find('.profile-messages').addClass('after-compose');
            }

            self.$el.find('.profile-messages').html(self.messageListView.render().el);
            self.$el.find('.module-header h2').replaceWith(self.moduleHeader);
            
            self.qRendered.resolve();
        }).catch(function(error){
            self.sandbox.error(errors.PROFILE.PROFILE_VIEW.ERROR_RENDERING, self.userId, "'s Profile: ", error.toString());
            self.qRendered.reject();
        });

        this.$content.html(profileContainerTmpl(this.opts));

        return Symphony.Module.prototype.render.apply(this, arguments);
    },

    postRender: function(){
        var self = this;

        self.qRendered.promise.done(function () {
            if(self.opts.isMyProfile){
                self.postInput.postRender();
            }
            self.messageListView.postRender();

            self.initTooltips();

            // steal focus!
            if (!self.init) {
                self.sandbox.publish('view:focus:requested', null, {
                    viewId: self.viewId
                });
            }
        });

        return Symphony.Module.prototype.postRender.apply(this, arguments);
    },

    didTakeFocus: function() {
        this.eventBus.trigger('textinput:parent:focused');
    },

    destroy: function () {
        if (this.messageListView) {
            this.messageListView.destroy();
        }

        if (this.postInput) {
            this.postInput.destroy();
        }

        if (this.profileInfoView) {
            this.profileInfoView.destroy();
        }

        Symphony.View.prototype.destroy.apply(this, arguments);
    }
});