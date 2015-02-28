var Backbone = require('backbone');
var Handlebars = require('hbsfy/runtime');
var config = require('../../../config/config');
var errors = require('../../../config/errors');
var roomDescriptionPopoverTmpl = require('./templates/room-description-popover.handlebars');

module.exports = Backbone.View.extend({
    className: 'room-description-popover',

    events: {
        'click .owner': 'showProfile'
    },

    initialize: function (opts) {
        this.opts = opts || {};
        this.sandbox = opts.sandbox;
        this.eventBus = opts.eventBus ||  _.extend({}, Backbone.Events);
        this.firstTimeRendering = true;
        this.dropId = opts.dropId;
        this.getRoomData();
        this.streamId = opts.streamId;
        this.sandbox.subscribe('room:update', this.reRender.bind(this));
        this.sandbox.subscribe('room:membersUpdate:'+this.streamId, this.membersUpdate.bind(this));
    },

    render: function() {
        var markup = roomDescriptionPopoverTmpl({
            room: this.roomData,
            membersLength: this.membersLength
        });

        this.$el.html(markup);

        return this;
    },

    reRender: function(context, args) {
        if (args.threadId === this.streamId) {
            this.getRoomData();
        }
    },

    membersUpdate: function(context, args) {
        if (args.threadId === this.streamId) {
            this.roomData = args;
            if (args.memberCount > 1) {
                this.membersLength = args.memberCount + ' Members';
            } else {
                this.membersLength = args.memberCount + ' Member';
            }
            this.render();
        }
    },

    getRoomData: function() {
        var self = this;

        this.sandbox.getData('app.account').then(function (rsp) {
            self.accountData = rsp;

            _.each(self.accountData.roomParticipations, function (item) {
                if (item.threadId === self.streamId) {
                    self.roomData = item;
                    // only update the memberslength on first render as subsequent members update from this is not accurate
                    if (self.membersLength === null || self.membersLength === undefined) {
                        if (item.memberCount > 1) {
                            self.membersLength = item.memberCount + ' Members';
                        } else {
                            self.membersLength = item.memberCount + ' Member';
                        }
                    }

                }
            });

            self.render();
        });
    },

    showProfile: function(evt) {
        var userId = evt.currentTarget.dataset.userid;

        this.sandbox.publish('view:show', null, {
            module: 'profile',
            userId: userId
        });

        this.eventBus.trigger('popover:hide', this.dropId);
    },

    destroy: function() {
        this.sandbox.unsubscribe('room:update', this.reRender.bind(this));
        this.sandbox.unsubscribe('room:membersUpdate:'+this.streamId, this.membersUpdate.bind(this));
        this.remove();
    }

});
