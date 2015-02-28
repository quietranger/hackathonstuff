var Backbone = require('backbone');
var errors = require('../../../../config/errors');

var chatroomMemberView = require('../chatroom/memberView');

require('../../../common/helpers/index');

module.exports = chatroomMemberView.extend({
    tagName: 'tr',
    className: 'member-row',
    model: null,

    events: {
        'click a.remove': 'remove'
    },

    remove: function() {
        this.model.collection.remove(this.model);
    }
});