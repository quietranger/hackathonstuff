var Backbone = require('backbone');
var errors = require('../../../../config/errors');

var memberTmpl = require('../../templates/member.handlebars');

require('../../../common/helpers/index');

module.exports = Backbone.View.extend({
    tagName: 'tr',
    className: 'member-row',
    model: null,

    events: {
        'click a.remove': 'remove',
        'click a.promote': 'promote',
        'click a.demote': 'demote'
    },

    initialize: function(opts) {
        this.model = opts.model;
        this.sandbox = opts.sandbox;
        this.threadId = opts.threadId;
        this.eventBus = opts.eventBus;
        this.model.userIsOwner = opts.userIsOwner;
        this.model.currentUserId = opts.currentUserId;
        this.model.isIm = opts.isIm;
        this.model.isChatroom = opts.isChatroom;
        this.model.canRemove = opts.canRemove;

        if (this.model.currentUserId === this.model.id) {
            this.model.modelIsCurrentUser = true;
        }

        _.bindAll(this, 'render');

        this.model.bind('change', this.render);
    },

    render: function() {
        this.$el.html(memberTmpl(this.model));
    },

    remove: function() {
        var self = this;

        var query = this.sandbox.send({
            id: 'GET_ROOM_MANAGER',
            payload: {
                action: 'removeuser',
                userid: this.model.get('userId'),
                threadid: this.threadId
            }
        });

        query.then(function(rsp) {
            if (rsp.status != 'OK') {
                self.eventBus.trigger('subview:error', errors.CHATROOM.MANAGE_MEMBERSHIP.REMOVE_MEMBER);
                return;
            }

            self.$el.fadeOut('fast', function() {
                self.model.collection.remove(self.model);
                if (self.model.get('userId') == self.model.currentUserId) {
                    self.sandbox.publish('modal:hide');
                    self.sandbox.publish('chatroom:member:left', null, self.threadId);
                }
            });
        }, function() {
            self.eventBus.trigger('subview:error', errors.CHATROOM.MANAGE_MEMBERSHIP.REMOVE_MEMBER);
        });
    },

    promote: function() {
        this.setOwner(true);
    },

    demote: function() {
        this.setOwner(false);
    },

    setOwner: function(value) {
        var config = {
            userId: this.model.get('userId'),
            owner: value
        }, self = this;

        var query = this.sandbox.send({
            id: 'GET_ROOM_MANAGER',
            payload: {
                action: 'updateuser',
                threadid: this.threadId,
                userid: this.model.get('userId'),
                userroomconfig: JSON.stringify(config)
            }
        });

        query.then(function(rsp) {
            if (rsp.status != 'OK') {
                self.eventBus.trigger('subview:error', errors.CHATROOM.MANAGE_MEMBERSHIP.SET_ROOM_OWNER);
                return;
            }

            self.model.set('owner', value);
        }, function() {
            self.eventBus.trigger('subview:error', errors.CHATROOM.MANAGE_MEMBERSHIP.SET_ROOM_OWNER);
        })
    }
});