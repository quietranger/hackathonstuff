var Backbone = require('backbone');
var Symphony = require('symphony-core');

var roomTmpl = require('../templates/room-result.handlebars');
var errors = require('../../../config/errors');

module.exports = Symphony.View.extend({
    className: 'room-result',

    model: null,

    events: {
        'click .profile-link': 'showProfile',
        'click .room-name': 'joinOrOpenRoom',
        'click .open-room': 'openRoom',
        'click .join-room': 'joinRoom'
    },

    initialize: function(opts) {
        Symphony.View.prototype.initialize.call(this, opts);

        this.model = opts.model;
        this.sandbox = opts.sandbox;

        var self = this;

        this.listenTo(this.model, 'change', this.render);

        this.sandbox.subscribe('chatroom:member:left', this.userLeftChatroom.bind(this));

        this.accountDataPromise.then(function(rsp) {
            self.userId = rsp.userName;

            var isMember = _.findWhere(rsp.roomParticipations, { threadId: self.model.get('id') }) !== undefined;

            self.model.set('isMember', isMember);
        });
    },

    showProfile: function() {
        this.sandbox.publish('view:show', null, {
            module: 'profile',
            userId: this.model.get('creator').userId
        });
    },

    joinRoom: function(e, open) {
        var self = this;

        this.sandbox.send({
            id: 'GET_ROOM_MANAGER',
            payload: {
                action: 'adduser',
                threadid: this.model.get('id'),
                userid: this.userId
            }
        }).then(function() {
            if (open) {
                self.openRoom();
            } else {
            $(e.currentTarget).removeClass('join-room').addClass('open-room').html('Open Room');
            }
        }, function() {
            $(e.currentTarget).addClass('error').text(errors.SEARCH.ROOM_VIEW.JOIN_FAILED);
        });
    },

    openRoom: function(){
        this.sandbox.publish('view:show', null, {
            'streamId': this.model.get('id'),
            'module': 'chatroom'
        });
    },

    joinOrOpenRoom: function(e) {
        if (this.model.get('isMember')) {
                this.openRoom();
        } else if (this.model.get('publicRoom')) {
            this.joinRoom(e, true);
        }
    },

    userLeftChatroom: function(context, args) {
        if (this.model.get('id') === args) {
            $(this.el).find('.actions .open-room').removeClass('open-room').addClass('join-room').html('Join Room');
        }
    },

    render: function() {
        this.$el.html(roomTmpl(this.model.toJSON()));

        return Symphony.View.prototype.render.call(this);
    },

    destroy: function() {
        this.model = null;

        Symphony.View.prototype.destroy.call(this);
    }
});
