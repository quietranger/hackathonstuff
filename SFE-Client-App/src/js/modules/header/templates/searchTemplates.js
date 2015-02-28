var peopleTemplate = require('../templates/people.handlebars');
var roomTemplate = require('../templates/room.handlebars');
var msgTemplate = require('../templates/message.handlebars');

module.exports = {
    peopleTemplate: {
        header: function (context, options) {
            if (context.isEmpty)
                return;
            return '<h4 class="tt-suggestion-header">People</h4>';
        },
        footer: function (context, options) {
            if (context.isEmpty)
                return;
            var count = $('#main-search-bar').data('peopleCount');
            return '<div class="tt-suggestion-footer" data-type="people"><label><a>'
                + count
                + ' people found</a></label></div>';
        },
        suggestion: peopleTemplate
    },
    roomTemplate: {
        header: function (context, options) {
            if (context.isEmpty)
                return;
            return '<h4 class="tt-suggestion-header">Rooms</h4>';
        },
        footer: function (context, options) {
            if (context.isEmpty)
                return;
            var count = $('#main-search-bar').data('roomCount');
            var text = count + (count > 1 ? ' rooms' : ' room') + ' found';
            return '<div class="tt-suggestion-footer" data-type="room"><label><a>'
                + text
                + '</a></label></div>';
        },
        suggestion: roomTemplate
    },
    msgTemplate: {
        header: function (context, options) {
            if (context.isEmpty)
                return;
            return '<h4 class="tt-suggestion-header">Messages</h4>';
        },
        footer: function (context, options) {
            if (context.isEmpty)
                return;
            var count = $('#main-search-bar').data('msgCount');
            var text = count + (count > 1 ? ' messages' : ' message') + ' found';
            return '<div class="tt-suggestion-footer" data-type="message"><label><a>'
                + text
                + '</a></label></div>';
        },
        suggestion: msgTemplate
    }
}