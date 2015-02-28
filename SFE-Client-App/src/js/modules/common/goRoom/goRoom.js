var Backbone = require('backbone');
var config = require('../../../config/config');
var utils = require('../../../utils');


var goRoomTmpl = require('./goRoom.handlebars');
var showErrorMessage = require('../mixins/showErrorMessage');
var errors = require('../../../config/errors');

require('typeahead.js');

module.exports = Backbone.View.extend({
    className: 'go-room module module-settings',

    initialize: function (opts) {
        var self = this;
        this.sandbox = opts.sandbox;

        this.acctRequest = this.sandbox.getData('app.account').done(function (rsp) {
            self.acctData = rsp;
        });
    },

    events: {
        'change input[name="room-privacy"]'     : 'changePrivacy',
        'click .submit'                         : 'beginRoom',
        'click .cancel'                         : 'hide',
        'keyup #room-name': 'userDidEnterRoomNameDesc',
        'keyup #room-description': 'userDidEnterRoomNameDesc',
        'click .link'           : 'openLink'
    },

    render: function () {
        this.$el.append(goRoomTmpl());

        return this;
    },

    postRender: function() {
        this.$el.find('#room-name').focus();
    },

    beginRoom: function () {
        var self = this,
            $roomname = this.$el.find('#room-name'),
            $roomdescription = this.$el.find('#room-description'),
            requestObj = {};

        $roomname.removeClass('error');
        $roomdescription.removeClass('error');

        if(!utils.isValidString($roomname.val())) {
            $roomname.addClass('error');
            return;
        }

        if (!utils.isValidString($roomdescription.val())) {
            $roomdescription.addClass('error');
            return;
        }

        requestObj.name = utils.escapeHtml($roomname.val());
        requestObj.description = utils.escapeHtml($roomdescription.val());
        requestObj.publicRoom = this.$el.find('input[name="room-privacy"]:checked').val() === 'public';
        requestObj.readOnly = this.$el.find("#room-read-only").prop("checked");
        requestObj.copyDisabled = this.$el.find("#room-disable-copy").prop("checked");

        if(requestObj.publicRoom) {
            requestObj.memberAddUserEnabled = true;
            requestObj.discoverable = true;
        }

        if(!requestObj.publicRoom) {
            requestObj.memberAddUserEnabled = this.$el.find("#room-allow-invite").prop("checked");
            requestObj.discoverable = !(this.$el.find("#room-hide-name-search").prop("checked"));
        }

        this.$el.find('.begin-room').addClass('disabled').prop('disabled', 'disabled');

        var goRoom = this.sandbox.send({
            id: 'ROOM_MANAGER',
            payload: {
                action: 'create',
                room: JSON.stringify(requestObj)
            }
        });

        goRoom.then(function (rsp) {
            if (rsp.status != 'OK') {
                //this should never get hit, the promise should have been rejected. not sure why this is here
                self.showErrorMessage('Could not create room: ' + rsp.responseJSON.message);
                return;
            }
            self.sandbox.publish('modal:hide');
           /**
            * The long poller receives a maestro event regarding the new room.
            * Leftnav populates based on the subsequent publish event and the
            * view is opened if the maestro msg requesting user = current user
            **/
        }, function (rsp) {
            if (rsp.status === 411) {
                self.showErrorMessage(errors.GO.CHATROOM.ERROR+'<br/>'+errors.COMMON.INFO_BARRIER.IB_ERROR, 0);
            } else {
                self.showErrorMessage(errors.GO.CHATROOM.ERROR+'<br/>'+rsp.responseJSON.message, 0);
            }
        });
    },

    changePrivacy: function(e) {
        var privacy = this.$el.find('input[name="room-privacy"]:checked').val(),
            $listItem = $(e.currentTarget).parents('li'),
            settings = this.$el.find('li');

        settings.removeClass('selected');

        $listItem.addClass('selected');

        settings = settings.slice(settings.length - 2, settings.length);

        if(privacy === 'private') {
            settings.removeClass('hidden');
        } else {
            settings.addClass('hidden');
        }
    },

    userDidEnterRoomNameDesc: function (e) {
        var self = this,
            $roomname = this.$el.find('#room-name'),
            $roomdescription = this.$el.find('#room-description'),
            submit = this.$el.find('.submit');

        if ($roomname.val().length > 0 && $roomdescription.val().length > 0) {
            submit.removeClass('disabled');

            if (e.keyCode == 13) {
                this.beginRoom();
                return false;
            }
        } else {
            submit.addClass('disabled');
        }

        return true;
    },

    hide: function() {
        this.sandbox.publish('modal:hide');
    },
    openLink: function(e) {
        var $target = $(e.currentTarget);
        var opts = {
            fnName: 'openLink',
            param: {url: $target.attr('href')}
        };
        this.sandbox.publish('appBridge:fn', null, opts);
        e.preventDefault();
    }
});

_.extend(module.exports.prototype, showErrorMessage);
