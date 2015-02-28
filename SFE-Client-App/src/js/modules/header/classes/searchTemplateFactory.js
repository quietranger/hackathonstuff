var peopleTemplate = require('../templates/people.handlebars');
var roomsTemplate = require('../templates/room.handlebars');
var messagesTemplate = require('../templates/message.handlebars');

require('../../common/helpers');

var resultHeaderTmpl = require('../templates/result-header.handlebars');

var SearchTemplateFactory = function() {
    this.peopleCount = 0;
    this.roomsCount = 0;
    this.messagesCount = 0;

    this.map = {
        people: {
            template: peopleTemplate,
            header: 'People'
        },
        rooms: {
            template: roomsTemplate,
            header: 'Rooms'
        },
        messages: {
            template: messagesTemplate,
            header: 'Messages'
        }
    };
};

SearchTemplateFactory.prototype.makePeopleTemplate = function() {
    return this.makeTemplate('people');
};

SearchTemplateFactory.prototype.makeRoomsTemplate = function() {
    return this.makeTemplate('rooms');
};

SearchTemplateFactory.prototype.makeMessagesTemplate = function() {
    return this.makeTemplate('messages');
};

SearchTemplateFactory.prototype.makeTemplate = function(type) {
    var obj = this.map[type];

    if (obj === undefined) {
        throw new Error('Invalid search template specified.');
    }

    return {
        header: _.bind(function (context) {
            var count = this[type + 'Count'];

            if (context.isEmpty) {
                return;
            }

            return resultHeaderTmpl({
                hasMore: count > 3,
                count: count,
                type: obj.header
            });
        }, this),

        suggestion: obj.template
    };
};

module.exports = SearchTemplateFactory;
