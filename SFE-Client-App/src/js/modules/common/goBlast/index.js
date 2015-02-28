var Backbone = require('backbone');
var Symphony = require('symphony-core');
var Handlebars = require('hbsfy/runtime');
var Utils = require('../../../utils');
var config = require('../../../config/config');
var Q = require('q');

var textInputView = require('../textInput/textInput');

var template = require('./templates/blast.handlebars');

var peopleTemplate = require('./templates/autocompletions/people.handlebars');
var roomsTemplate = require('./templates/autocompletions/rooms.handlebars');
var errorsTemplate = require('./templates/errors.handlebars');
var conversationCollectionTemplate = require('./templates/conversation-collection.handlebars');
var conversationTemplate = require('./templates/conversation.handlebars');

require('../helpers/index');
require('../../../libs/tokenInput');

Handlebars.registerPartial('conversationCollection', conversationCollectionTemplate);
Handlebars.registerPartial('conversation', conversationTemplate);

var recipientTypes = {
    ROOM: 'room',
    USER: 'user',
    IM: 'im',
    GROUP: 'group'
};

module.exports = Symphony.View.extend({
    events: {
        'click .cancel': 'close',
        'click .close-errors': 'didClickCloseErrors',
        'click .send': 'send',
        'click .collapse': 'toggleCollapse',
        'change input[type=checkbox]': 'didToggleConversation'
    },

    keyboardEvents: {
        'esc': 'close'
    },

    initialize: function(opts) {
        Symphony.View.prototype.initialize.call(this, opts);

        var self = this;

        this.tokenInput = null;
        this.conversations = null;
        this.conversationsIndex = {};
        this.tokens = [];
        this.rooms = [];
        this.isDisabled = true;
        this.isConfirmed = false;
        this.textInputView = new textInputView({
            sandbox: this.sandbox,
            eventBus: this.eventBus,
            showButton: false,
            placeholderText: 'Message...',
            maxLength: 2000,
            enableFileUpload: false,
            sendOnEnter: false,
            rteActions: [],
            maxlengthplacement: 'bottom'
        });
        this.recipientCount = 0;

        this.listenTo(this.eventBus, 'input:event', _.debounce(this.toggleDisabled.bind(this)));
        this.listenTo(this.eventBus, 'input:keydown', this.inputDidKeydown.bind(this));

        var d = Q.defer();
        this.clientDataPromise = d.promise;

        this.accountDataPromise.then(function(rsp) {
            return self._parseAccountData(rsp);
        }).then(function(rsp) {
            self._parseClientData(rsp);
            d.resolve();
        });
    },

    render: function() {
        var self = this;

        this.clientDataPromise.then(function() {
            self.$el.html(template({
                conversations: self.conversations
            }));

            self.textInputView.setElement(self.$el.find('.message'));
            self.textInputView.render().postRender();

            Symphony.View.prototype.render.call(self);
        });

        return this;
    },

    _parseAccountData: function(rsp) {
        this.rooms = _.reject(rsp.roomParticipations, function(item) {
            return item.roomType !== 'CHATROOM'
                || (item.readOnly && !item.userIsOwner);
        });

        this.ims = rsp.pinnedChats;
        this.userId = rsp.userName;
        this.userName = rsp.prettyName;

        this.peopleSearch = new Bloodhound({
            datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            limit: 3,
            remote: {
                url: Symphony.Config.API_ENDPOINT + '/search/Search?q=%QUERY&type=people',
                filter: function (parsedResponse) {
                    var users = [];
                    for (var i = 0, len = parsedResponse.queryResults[0].users.length; i < len; i++) {
                        var user = parsedResponse.queryResults[0].users[i].person;

                        if (user.id !== this.userId) {
                            users.push(user);
                        }
                    }

                    return users;
                }
            }
        });

        this.roomsSearch = new Bloodhound({
            datumTokenizer: Bloodhound.tokenizers.obj.whitespace('name'),
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            limit: 3,
            local: this.rooms
        });

        this.peopleSearch.initialize();
        this.roomsSearch.initialize();

        return this.sandbox.getData('documents.leftnavGroups');
    },

    _parseClientData: function(rsp) {
        var self = this;

        if (_.isEmpty(rsp)) {
            rsp = {};
        }

        if (_.isEmpty(rsp.rooms)) {
            rsp.rooms = _.map(this.rooms, function(item) {
                return { 'data-streamid' : item.threadId };
            });
        }

        if (_.isEmpty(rsp.ims)) {
            rsp.ims = _.map(this.ims, function(item) {
                return { 'data-streamid' : item.threadId };
            });
        }

        var parse = function(list, lookup) {
            var ret = [];

            for (var i = 0; i < list.length; i++) {
                var item = list[i];

                if (item.name) {
                    ret.push({
                        name: item.name,
                        items: parse(item.items, lookup),
                        type: recipientTypes.GROUP
                    });

                    continue;
                }

                var obj = lookup[item['data-streamid']];

                if(obj) {
                    obj = self._normalizeIdsNames(obj);

                    ret.push(obj);
                    delete lookup[item['data-streamid']];
                }
            }

            return ret;
        };

        _.each(rsp, function(list, type) {
            var master = type === 'rooms' ? self.rooms : self.ims,
                index = _.indexBy(master, 'threadId');

            _.extend(self.conversationsIndex, index);

            var parsed = parse(list, index);

            if (!_.isEmpty(parsed)) {
                if (self.conversations === null) {
                    self.conversations = {};
                }

                var stragglers = _.values(index);

                _.map(stragglers, self._normalizeIdsNames.bind(self));

                self.conversations[type] = stragglers.concat(parsed);
            }
        });
    },

    _normalizeIdsNames: function(obj) {
        if (obj.userPrettyNames) {
            obj.name = Utils.getShortenedChatName(obj.userPrettyNames, this.userName);
            obj.type = recipientTypes.IM;
        } else {
            obj.type = recipientTypes.ROOM;
        }

        obj.id = obj.threadId;

        return obj;
    },

    postRender: function() {
        var self = this;

        this.clientDataPromise.then(function() {
            self.tokenInput = self.$el.find('#recipients').tokenInput({
                typeaheadOptions: [
                    {
                        minLength: config.MIN_SEARCH_LENGTH,
                        highlight: true,
                        hint: false,
                        autoselect: true
                    },
                    {
                        name: recipientTypes.USER,
                        displayKey: 'prettyName',
                        source: self.peopleSearch.ttAdapter(),
                        templates: {
                            suggestion: peopleTemplate
                        }
                    },
                    {
                        name: recipientTypes.ROOM,
                        displayKey: 'name',
                        source: self.roomsSearch.ttAdapter(),
                        templates: {
                            suggestion: roomsTemplate
                        }
                    }
                ],

                callbacks: {
                    makeAutocompleteToken: function(e, suggestion, dataset) {
                        var name, id, memberCount = 1, image = null;

                        switch (dataset) {
                            case recipientTypes.ROOM:
                                name = suggestion.name;
                                id = suggestion.threadId;
                                memberCount = suggestion.memberCount;
                                break;
                            case recipientTypes.USER:
                                name = suggestion.prettyName;
                                id = suggestion.id.toString();
                                image = suggestion.images && suggestion.images['50'] ? suggestion.images['50'] : suggestion.imageUrlSmall;
                                break;
                            default:
                                return;
                        }

                        return {
                            name: name,
                            id: id,
                            image: image,
                            memberCount: memberCount
                        };
                    },

                    didAddToken: self.didAddToken.bind(self),
                    didRemoveToken: self.didRemoveToken.bind(self),
                    didDisableTokens: self.tokensDidChange.bind(self)
                }
            });

            Symphony.View.prototype.postRender.call(self);
        });
    },

    didAddToken: function(token) {
        var self = this;

        if (token.type === recipientTypes.USER) {
            _.each(this.ims, function(im) {
                if (im.userIds.length === 2 && _.contains(im.userIds, Number(token.id))) {
                    var $checkbox = self.$el.find('li input[data-id="' + im.id + '"]');
                    $checkbox.prop('checked', true);
                    self.recipientCount++;
                    self._syncGroup($checkbox);
                }
            });
        } else {
            var $checkbox = self.$el.find('li input[data-id="' + token.id + '"]');
            $checkbox.prop('checked', true);
            this.recipientCount += token.memberCount;
            this._syncGroup($checkbox);
        }

        this.tokensDidChange.apply(this, arguments);
    },

    didRemoveToken: function(token) {
        var self = this;

        if (token.type === recipientTypes.USER) {
            _.each(this.ims, function(im) {
                if (_.contains(im.userIds, Number(token.id))) {
                    var $checkbox = self.$el.find('li input[data-id="' + im.threadId + '"]');
                    $checkbox.prop('checked', false);
                    self.recipientCount--;
                    self._syncGroup($checkbox);
                }
            });
        } else {
            var $checkbox = self.$el.find('li input[data-id="' + token.id + '"]');
            $checkbox.prop('checked', false);
            this.recipientCount -= token.memberCount;
            this._syncGroup($checkbox);
        }

        this.tokensDidChange.apply(this, arguments);
    },

    _syncGroup: function($child) {
        var $group = $child.closest('.group'),
            $checkboxes = $group.find('li input[type=checkbox]'),
            $groupCheck = $group.find('.group-checkbox');


        if ($child.hasClass('group-checkbox')) {
            $checkboxes.prop('checked', $child.prop('checked'));
            $groupCheck.removeClass('partially-checked');
        } else if($group.length > 0) {
            var checked = $checkboxes.filter(':checked').length,
                total = $checkboxes.length;

            $groupCheck.prop('checked', checked == total)
                .toggleClass('partially-checked', checked < total && checked > 0);
        }
    },

    tokensDidChange: function(token, tokens) {
        this.tokens = tokens;

        this.toggleDisabled();
    },

    inputDidKeydown: function(e) {
        if (e.which === 13 && !this.isDisabled) {
            this.send();
        }
    },

    toggleDisabled: function() {
        var enabledTokens = _.filter(this.tokens, function(item) {
            return item.enabled;
        });

        this.isDisabled = this.textInputView.getValue().trim().length === 0
            || enabledTokens.length === 0;

        this.isConfirmed = false;

        var needsConfirmation = this.recipientCount >= config.BLAST_WARNING_COUNT;

        this.$el
            .find('.send')
            .toggleClass('disabled', this.isDisabled)
            .toggleClass('positive', !this.isDisabled)
            .toggleClass('warning', needsConfirmation)
            .text(needsConfirmation ? 'Send to ' + this.recipientCount + ' People' : 'Send');
    },

    showConfirmation: function() {
        this.isConfirmed = true;

        this.$el.find('.send').text('Are you sure?');
    },

    didToggleConversation: function(e) {
        var $target = $(e.currentTarget);

        this._syncGroup($target);
        this._handleToggle($target);
    },

    _handleToggle: function($target) {
        var id = $target.attr('data-id'),
            state = $target.prop('checked');

        switch($target.attr('data-type')) {
            case recipientTypes.ROOM:
                this._handleRoomToggle(id, state);
                break;
            case recipientTypes.IM:
                this._handleIMToggle(id, state);
                break;
            case recipientTypes.GROUP:
                this._handleGroupToggle($target.closest('.group'));
                break;
            default:
                return;
        }
    },

    _handleRoomToggle: function(id, state) {
        var room = this.conversationsIndex[id];

        if (!room) {
            return;
        }

        if (!state) {
            this.tokenInput.tokenInput('removeToken', id);
            return;
        }

        this.tokenInput.tokenInput('addToken', {
            type: recipientTypes.ROOM,
            enabled: true,
            name: room.name,
            image: null,
            id: id,
            memberCount: room.memberCount
        });
    },

    _handleIMToggle: function(id, state) {
        var self = this,
            selectedIm = this.conversationsIndex[id];

        if (!selectedIm) {
            return;
        }

        var originalWithoutMe = _.without(selectedIm.userIds, this.userId);

        if (!state) {
            _.each(originalWithoutMe, function(userId) {
                self.tokenInput.tokenInput('removeToken', userId.toString());
            });

            return;
        }

        this.sandbox.send({
            id: 'USER_RESOLVE',
            payload: {
                ids: _.without(selectedIm.userIds, this.userId).join(',')
            }
        }).then(function(rsp) {
            _.each(rsp, function(user) {
                self.tokenInput.tokenInput('addToken', {
                    type: recipientTypes.USER,
                    enabled: true,
                    name: user.prettyName,
                    image: user.images && user.images['50'] ? user.images['50'] : user.imageUrlSmall,
                    id: user.id.toString()
                });
            });
        });
    },

    _handleGroupToggle: function($target) {
        var self = this;

        $target.find('li input[type=checkbox]').each(function() {
            self._handleToggle($(this));
        });
    },

    send: function() {
        var text = this.textInputView.getValue();

        if (this.isDisabled) {
            return;
        }
        if (this.recipientCount > config.BLAST_WARNING_COUNT && !this.isConfirmed) {
            this.showConfirmation();
            return;
        }
        // let's disable the send button to prevent dupes
        this.isDisabled = true;
        this.$el
            .find('.send')
            .toggleClass('disabled', this.isDisabled);

        var payload = {
            messagepayload: JSON.stringify({
                from: {
                    userType: 'lc',
                    id: this.userId
                },

                sendingApp: 'lc',
                externalOrigination: false,
                isPrivate: false,
                version: 'SOCIALMESSAGE',
                text: text
            })
        };

        var rooms = [], users = [];

        _.each(this.tokens, function(item) {
            var ids = item.type == recipientTypes.ROOM ? rooms : users;

            if (ids && item.enabled) {
                ids.push(item.id);
            }
        });

        if (rooms.length > 0) {
            payload.rooms = rooms.join(',');
        }

        if (users.length > 0) {
            payload.users = users.join(',');
        }

        var self = this;

        // hide old buttons and add the spinner
        this.$el.find('.send').css("display", "none");
        this.$el.find('.cancel').css("display", "none");
        this.$el.find('.sending').css("display", "inline-block");
        this.$el.find('.sending-text').css("display", "inline-block");
        this.sandbox.send({
            id: 'BLAST_MESSAGE',
            payload: payload
        }).then(function(rsp) {
            self._handleResponse(rsp);
        }, function(rsp) {
            self._renderErrorTemplate({
                staticMessage: rsp.responseJSON.message
            });
            // show old buttons and remove the spinner
            self.$el.find('.send').css("display", "inline-block");
            self.$el.find('.cancel').css("display", "inline-block");
            self.$el.find('.sending').css("display", "none");
            self.$el.find('.sending-text').css("display", "none");
            self.toggleDisabled();
        });
        this.sandbox.publish("usage-event", null, {
            action: "blastmessage",
            details: {
                roomscount: rooms.length,
                userscount: users.length
            },
            immediate: false
        });
    },

    _handleResponse: function(rsp) {
        var errors = [];

        _.each(rsp.rooms.concat(rsp.instantChats), function(item) {
            if (item.statusCode !== 200) {
                errors.push(item);
            }
        });

        // show old buttons and remove the spinner
        this.$el.find('.send').css("display", "inline-block");
        this.$el.find('.cancel').css("display", "inline-block");
        this.$el.find('.sending').css("display", "none");
        this.$el.find('.sending-text').css("display", "none");

        if (errors.length > 0) {
            this.renderErrors(errors);
        } else {
            this.sandbox.publish('modal:hide');
        }
    },

    renderErrors: function(errors) {
        var map = _.indexBy(this.tokens, 'id'),
            context = { errors: [], successes: [], vulgarity: false },
            errorIds = [];

        _.each(errors, function(error) {
            var id = error.to || error.threadId,
                token = map[id];

            errorIds.push(id);

            delete map[id];

            if (error.statusCode == 451) { // 451 is vulgarity error code
                context.vulgarity = true;
                return;
            }

            context.errors.push({
                name: token.name,
                message: error.message
            });
        });

        context.successes = _.values(map);

        this.tokenInput.tokenInput('disableTokens', _.keys(map)).tokenInput('markErrorTokens', errorIds);

        this._renderErrorTemplate(context);
    },

    _renderErrorTemplate: function(context) {
        this.$el.find('.errors').remove();
        this.$el.find('#go-blast').prepend(errorsTemplate(context));
    },

    toggleCollapse: function(e) {
        $(e.currentTarget).parent().toggleClass('collapsed');
    },

    didClickCloseErrors: function() {
        this.$el.find('.errors').remove();
    },

    destroy: function() {
        this.textInputView.destroy();
        this.textInputView = null;

        this.tokenInput.tokenInput('destroy');

        if (this._sendWaitInterval) {
            window.clearInterval(this._sendWaitInterval);
        }

        Symphony.View.prototype.destroy.call(this);
    },

    close: function() {
        this.sandbox.publish('modal:hide');
    }
});
