var BaseView = require('./views/baseView');
var deactivationConfirmationView = require('./views/chatroom/deactivationConfirmationView');

var chatroomMenuTmpl = require('./templates/chatroom-menu.handlebars');
var ChatroomView = BaseView.extend({
    className: 'chat-module module',

    psEvents: {
    },

    initialize: function(opts) {
        //extend events/psEvents must happen before parent class's initialization function is called
        this.events['click .show-deactivation-confirmation'] = 'showDeactivationConfirmation';
        this.events['click .leave-room'] = 'leaveRoom';
        this.psEvents = {
            'room:update': this.onUpdate.bind(this),
            'user:kicked': this.onKicked.bind(this),
            'room:deactivated': this.onDeactivation.bind(this)
        };
        this.psEvents['room:membermodified:' + opts.streamId] = this.onMemberModified.bind(this);
        this.psEvents['room:membersUpdate:' + opts.streamId] = this.onMembersUpdate.bind(this);

        opts.isChatRoom = true;
        //call parent view's initialization function
        BaseView.prototype.initialize.call(this, opts);

        this.moduleMenu = chatroomMenuTmpl;
        var self = this;
        this.listenTo(self.eventBus, 'room:rejoin', function () {
            var inputOption = {
                placeholderText: 'Compose a message...',
                disableInputOption: false,
                showRejoinButton: false,
                streamId: self.opts.streamId
            };
            self.eventBus.trigger('textinput:change', inputOption);
        });
        this.listenTo(self.eventBus, 'roominfo:updated', function (args) {
            self.onMembersUpdate(null, args);
        });
    },

    onKicked: function (context, args) {
        var streamId = args.threadId || args.filterId;
        if (streamId !== this.opts.streamId) {
            return;
        }

        var publicRoom = false;
        var self = this;
        if (this.opts.isPublic === true) {
            publicRoom = true;
        }
        this.eventBus.trigger('textinput:change', {
            placeholderText: 'You have left or been removed from this room.',
            disableInputOption: true,
            showRejoinButton: publicRoom, // if room is public, show rejoin button when user is kicked/leaves
            streamId: self.opts.streamId
        });
    },

    onDeactivation: function (context, data) {
        this.eventBus.trigger('textinput:change', {
            placeholderText: 'This room has been deactivated.',
            disableInputOption: true,
            streamId: data.threadId
        });
    },

    onUpdate: function (context, args) {
        var self = this;
        var streamId = args.threadId || args.filterId;
        if (streamId !== this.opts.streamId)
            return;
        var disableInputAndPlaceholderText = {};

        // todo: on new room join, we get an update event that does not have a maestroObject
        this.accountDataPromise.then(function(rsp){
            if (args.maestroObject) {
                if (args.maestroObject.readOnly && /*!this.opts.userIsOwner &&*/ !args.maestroObject.userIsOwner && args.maestroObject.userId === rsp.userName) {
                    disableInputAndPlaceholderText = {
                        placeholderText: 'This room is read-only. Only owners of the room can post a message to this room.',
                        disableInputOption: true,
                        showRejoinButton: false,
                        streamId: streamId
                    };
                } else {
                    //TODO: check whether user choose to disable input in view config
                    disableInputAndPlaceholderText = {
                        placeholderText: 'Compose a message...',
                        disableInputOption: false,
                        showRejoinButton: false,
                        streamId: streamId
                    };
                }
            }
            self.eventBus.trigger('textinput:change', disableInputAndPlaceholderText);

            self.$el.find('h2.text-selectable').text(args.maestroObject.name);
        });
    },

    onMemberModified: function (context, args) {
        var self = this;
        this.accountDataPromise.then(function(rsp){
            if (args.maestroObject) {
                if (self.opts.userIsOwner !== args.maestroObject.userIsOwner) {
                    var inputConfig = {
                        //TODO: default to be user's config setting (disable input or not)
                        placeholderText: 'Compose a message...',
                        disableInputOption: false,
                        showRejoinButton: false,
                        streamId: args.threadId || args.filterId
                    };
                    self.opts.userIsOwner = args.maestroObject.userIsOwner;
                    if (args.maestroObject.readOnly && !args.maestroObject.userIsOwner && args.maestroObject.userId === rsp.userName) {
                        inputConfig.placeholderText = 'This room is read-only. Only owners of the room can post a message to this room.';
                        inputConfig.disableInputOption = true;
                    }
                    self.eventBus.trigger('textinput:change', inputConfig);
                }
            }
        });
    },

    onMembersUpdate: function (context, args) {
        var count = args.memberCount;
        //update header
        this.$el.find('header a.participants').text(count);
    },

    showDeactivationConfirmation: function () {
        var contentView = new deactivationConfirmationView({
            sandbox: this.sandbox,
            threadId: this.opts.streamId,
            name: this.opts.name
        });

        this.sandbox.publish('modal:show', null, {
            title: 'Confirm Deactivation',
            contentView: contentView,
            isFlat: true
        });
    },

    /**
     * Removes the current user from the threadId. This should only be available if a user is not an owner of a chatroom.
     */
    leaveRoom: function() {
    var self = this;

    var query = this.sandbox.send({
        id: 'GET_ROOM_MANAGER',
        payload: {
            action: 'removeuser',
            userid: self.currentUserId,
            threadid: self.streamId
        }
    });

    query.then(function(rsp) {
        if (rsp.status != 'OK') {
            self.eventBus.trigger('subview:error', errors.CHATROOM.MANAGE_MEMBERSHIP.REMOVE_MEMBER);
            return;
        }

        self.$el.fadeOut('fast', function() {
            self.sandbox.publish('chatroom:member:left', null, self.streamId);
            self.sandbox.publish('view:close', null, 'chatroom' + self.streamId);
        });
    }, function() {
        self.eventBus.trigger('subview:error', errors.CHATROOM.MANAGE_MEMBERSHIP.REMOVE_MEMBER);
    })}
});

module.exports = {
    createView: ChatroomView
};