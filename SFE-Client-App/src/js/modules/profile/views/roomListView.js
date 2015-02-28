var Backbone = require('backbone');
var config = require('../../../config/config');
var Handlebars = require("hbsfy/runtime");
var moment = require('moment');
var errors = require('../../../config/errors');
var roomListTmpl = require('../templates/roomList.handlebars');

module.exports = Backbone.View.extend({
    className: 'room-list-container',

    events: {
        'click .join-room': 'joinRoom',
        'click .close': 'close',
        'click .open-room': 'openRoom',
        'click .user_link': 'openProfile'
    },

    initialize: function (opts) {
        var self = this;

        self.opts = opts || {};
        self.sandbox = opts.sandbox;
        self.$body = $('body');
        self.viewId = 'roomsListView';

        // get the following list
        self.opts.roomListData = self.sandbox.send({
            id: "ROOM_MANAGER",
            payload: {
                action: "findrooms",
                userid: self.opts.profileInfo.person.id
            }
        });

        self.sandbox.getData('app.account').then(function(rsp) {
            self.userId = rsp.userName;
        });
    },

    render: function () {
        var self = this;

        self.$el.html(roomListTmpl(self.opts));
        this.opts.roomListData.done(function (rsp) {
            if (rsp.result.length === 0) {
                rsp.isEmpty = true;
            }
            // wait until fetched list of rooms
            self.sandbox.getData('app.account.roomParticipations').done(function (roomParticipations) {
                var roomsIAmIn = {};
                for (var i = 0, length = roomParticipations.length; i < length; i++) {
                    roomsIAmIn[roomParticipations[i].threadId] = true;
                }
                for (var i = 0, length = rsp.result.length; i < length; i++) {
                    rsp.result[i].isMember = roomsIAmIn[rsp.result[i].threadId];
                }
                self.$el.html(roomListTmpl(_.extend(self.opts, rsp)));
            });

        });
        return this;
    },
    joinRoom: function(e) {
        var $target = $(e.currentTarget),
            self = this;

        this.sandbox.send({
            id: 'GET_ROOM_MANAGER',
            payload: {
                action: 'adduser',
                threadid: $target.attr('data-threadid'),
                userid: this.userId
            }
        }).then(function() {
            $target.removeClass('join-room').addClass('open-room').html('Open Room');
        }, function(rsp) {
            $target.addClass('error').text(errors.PROFILE.ROOM_LIST.JOIN_FAILED);
            return; //todo errors
        });
    },

    close: function () {
        this.sandbox.publish('modal:hide');
    },

    openRoom: function(e){
        var target = $(e.currentTarget);

        this.sandbox.publish('view:show', null, {
            'streamId': target.attr('data-threadid'),
            'module': 'chatroom'
        });

        this.close();
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

Handlebars.registerHelper('parseDate', function (timestamp) {
    return moment(timestamp).format('ll')
});
