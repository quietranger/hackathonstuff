var Backbone = require('backbone');
var Symphony = require('symphony-core');
var Drop = require('drop');
var Pikaday = require('pikaday');
var Utils = require('../../../utils/index');
var config = require('../../../config/config');

var messageModel = require('../../common/baseMessages/models/message');

var searchTmpl = require('../templates/search.handlebars');
var paginationTmpl = require('../../common/templates/pagination.handlebars');
var personTmpl = require('../../common/templates/autocompletions/person.handlebars');

var socialMessageView = require('../../common/socialMessageList/views/messageView');
var contextualChatMessageView = require('./contextualSearchChatMessageView');
var roomView = require('./roomView');
var userView = require('./userView');

require('../../../libs/tokenInput');

require('typeahead.js');

var RESULTS_PER_PAGE = 20;

var resultTypes = {
    ROOMS: 'rooms',
    USERS: 'users',
    MESSAGES: 'messages'
};

var tokenTypes = {
    KEYWORD: 'keyword',
    USER: 'user',
    ARBITRARY: 'arbitrary'
};

module.exports = Symphony.Module.extend({
    className: 'advanced-search module',

    events: {
        'click .toggle-search-type': 'didToggleAdvancedSearch',
        'click .pagination-centered li': 'didClickPaginationItem',
        'change select': 'didChangeDropdown',
        'blur .from': 'fromDidChange',
        'keyup .from': 'fromDidChange',
        'click .calendar': 'toggleCalendar',
        'click .calendar .clear': 'clearCalendar'
    },

    moduleHeader: '<h2>Search</h2>',

    moduleMenu: true,

    initialize: function(opts) {
        var self = this;

        Symphony.Module.prototype.initialize.call(this, opts);

        this.tokens = [];
        this.messageResultViews = [];
        this.userResultViews = [];
        this.roomResultViews = [];
        this.rooms = [];
        this.ims = [];
        this.socialConnectors = [];
        this.currentUserId = null;
        this.currentUserName = null;
        this.tokenInput = null;
        this.datePickers = null;
        this.fromTypeahead = null;
        this.pagination = {};
        this.defaultPagination = {
            users: {
                pageCount: 0,
                currentPage: 1,
                nextStart: 0,
                oldPage: null
            },
            rooms: {
                pageCount: 0,
                currentPage: 1,
                nextStart: 0,
                oldPage: null
            },
            messages: {
                pageCount: 0,
                currentPage: 1,
                nextStart: 0,
                oldPage: null
            }
        };

        this.criteria = opts.criteria || {
            query: null,
            entities: [],
            operator: 'ANY',
            start: null,
            end: null,
            from: null,
            in: null,
            connectorId: null
        };

        this._debouncedQuery = _.debounce(this.query.bind(this), 250);

        this.accountDataPromise.then(function(rsp) {
            self.currentUserId = rsp.userName;
            self.currentUserName = rsp.prettyName;

            self.rooms = [];
            self.ims = [];
            self.socialConnectors = [];

            for (var i = 0; i < rsp.roomParticipations.length; i++) {
                var room = rsp.roomParticipations[i],
                    isSelected = room.threadId == self.opts.selectedRoomId;

                self.rooms.push({
                    threadId: room.threadId,
                    name: room.name,
                    selected: isSelected
                });

                if (isSelected) {
                    self.defaultSelectedRoomName = room.name;
                }
            }

            for (var i = 0; i < rsp.pinnedChats.length; i++) {
                var im = rsp.pinnedChats[i],
                    isSelected = room.threadId == self.opts.selectedRoomId,
                    name = Utils.getShortenedChatName(im.userPrettyNames, self.currentUserId);

                self.ims.push({
                    threadId: im.threadId,
                    name: name,
                    selected: isSelected
                });

                if (isSelected) {
                    self.defaultSelectedRoomName = name;
                }
            }

            for (var i=0; i < rsp.socialConnectors.length; i++) {
                var socialConnector = {};
                if (rsp.socialConnectors[i] === 'tw') {
                    socialConnector = {
                        value: 'tw',
                        name: 'Twitter'
                    };
                    self.socialConnectors.push(socialConnector);
                }
            }
        });

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

                        if (user.id != self.userId) {
                            users.push(user);
                        }
                    }

                    return users;
                }
            }
        });


        this.peopleSearch.initialize();
    },

    render: function() {
        this.$content.html(searchTmpl({
            rooms: this.rooms,
            ims: this.ims,
            socialConnectors: this.socialConnectors,
            query: this.opts.query,
            defaultSelectedRoomName: this.defaultSelectedRoomName
        }));

        return Symphony.Module.prototype.render.call(this);
    },

    postRender: function() {
        var self = this;

        this.$el.find('.module-content').addClass('module-scrollable');

        this.datePickers = this.$content.find('.calendar');

        _.each(this.datePickers, function(el, i) {
            var picker = new Pikaday({
                bound: false,
                maxDate: new Date(),
                onSelect: function() {
                    var $el = $(el),
                        thisMoment = this.getMoment(),
                        thisDate = thisMoment.toDate(),
                        thisUnix = thisMoment.unix(),
                        name = $el.attr('name');

                    if (name == 'start') {
                        var endPicker = self.datePickers[1];

                        endPicker.setMinDate(thisDate);
                    }

                    if (name == 'end') {
                        var startPicker = self.datePickers[0];

                        startPicker.setMaxDate(thisDate);
                    }

                    $el.addClass('has-value').find('span').text(thisMoment.format('MM/DD/YYYY'));

                    self.criteria[name] = thisUnix * 1000;
                    self._debouncedQuery();
                }
            });

            picker.hide();
            $('body').append(picker.el);

            self.datePickers[i] = picker;
        });

        this.tokenInput = this.$content.find('.query').tokenInput({
            callbacks: {
                makeToken: function(value) {
                    var type, prefix = value[0];

                    if (prefix == '#' || prefix == '$') {
                        type = tokenTypes.KEYWORD;
                    } else {
                        type = tokenTypes.ARBITRARY;
                    }

                    return {
                        id: value,
                        name: value,
                        type: type
                    };
                },

                inputDidKeydown: function(e) {
                    var value = $(e.currentTarget).val();

                    if ((e.which == 32 || e.which == 13) && value.match(/^[#|\$]{1}[\d\w]+$/i)) {
                        var token = this.makeToken(value);

                        this.addToken(token);

                        e.preventDefault();
                    } else if (e.which == 13) {
                        e.stopPropagation();
                        self._debouncedQuery();
                    }
                },

                didAddToken: this.tokensDidChange.bind(this),
                didRemoveToken: this.tokensDidChange.bind(this)
            }
        });

        this.fromTypeahead = this.$content.find('.from').typeahead(
            {
                minLength: config.MIN_SEARCH_LENGTH,
                highlight: true,
                hint: false
            },
            {
                name: 'from',
                displayKey: 'prettyName',
                source: this.peopleSearch.ttAdapter(),
                templates: {
                    suggestion: personTmpl
                }
            }
        ).on('typeahead:autocomplete typeahead:selected', this.fromDidAutocomplete.bind(this));

        if (this.opts.query) {
            this.criteria.query = this.opts.query;
        }

        if (this.opts.selectedRoomId) {
            this.criteria.in = this.opts.selectedRoomId;

            this.$content.find('.in').val(this.criteria.in);
        }

        if (this.criteria.in || this.criteria.query) {
            if (this.criteria.in) {
                this.didToggleAdvancedSearch();
            }

            this._debouncedQuery();
        }

        return Symphony.Module.prototype.postRender.call(this);
    },

    fromDidAutocomplete: function(e, suggestion) {
        if (suggestion && suggestion.id) {
            this.criteria.from = suggestion.id;
        } else {
            this.criteria.from = null;
        }

        this._debouncedQuery();
    },

    fromDidChange: function() {
        var $target = this.$el.find('.from');

        if (_.isEmpty($target.val())) {
            this.criteria.from = null;
            this._debouncedQuery();
        }
    },

    tokensDidChange: function(token, tokenList) {
        this.tokens = tokenList;

        this._debouncedQuery();
    },

    clearCalendar: function(e, name) {
        var $calendar = e ? $(e.currentTarget).closest('.calendar') : this.$el.find('[name="' + name + '"]');

        $calendar.removeClass('has-value').find('span').empty();

        var name = $calendar.attr('name');

        if (name === 'start') {
            this.datePickers[1].setMinDate(null);
        } else {
            this.datePickers[0].setMaxDate(null);
        }

        this.criteria[name] = null;
        this._debouncedQuery();
    },

    query: function(resultType) {
        if (!resultType) {
            this.pagination = $.extend(true, {}, this.defaultPagination);
        }

        var payload = this._formatPayload();

        if (_.isEmpty(payload.entities) &&  _.isEmpty(payload.query)) {
            return; //TODO: error handling
        }

        var self = this;

        if (!this.criteria.connectorId) {
            payload.connectorId = 'ANY';
        }

        this.sandbox.send({
            id: 'ADVANCED_SEARCH',
            payload: payload
        }).then(function(rsp) {
            self._renderResults(rsp, resultType);
        }, function() {
            //TODO: error handling
        });
    },

    _formatPayload: function() {
        var self = this;
        var payload = {
            messagesPerPage: RESULTS_PER_PAGE,
            usersPerPage: RESULTS_PER_PAGE,
            roomsPerPage: RESULTS_PER_PAGE,
            messagesStart: this._calculateOffset(resultTypes.MESSAGES),
            usersStart: this._calculateOffset(resultTypes.USERS),
            roomsStart: this._calculateOffset(resultTypes.ROOMS)
        };

        this.criteria.query = this.$content.find('.token-input input').val();
        this.criteria.entities = _.pluck(this.tokens, 'id');

        _.each(_.keys(this.criteria), function(key) {
            if (_.isArray(self.criteria[key]) && self.criteria[key].length > 0) {
                payload[key] = self.criteria[key].join(',');
            } else if (_.isNumber(self.criteria[key]) || !_.isEmpty(self.criteria[key])) {
                payload[key] = self.criteria[key];
            }
        });

        return payload;
    },

    _calculateOffset: function(resultType) {
        var pagination = this.pagination[resultType];

        if (!pagination) {
            return 0;
        }

        if (pagination.currentPage < pagination.oldPage) {
            return (pagination.currentPage - 1) * RESULTS_PER_PAGE;
        }

        return (pagination.currentPage - pagination.oldPage - 1) * RESULTS_PER_PAGE
            + pagination.nextStart;
    },

    _renderResults: function(rsp, resultType) {
        var self = this,
            map = {};

        map[resultTypes.ROOMS] = [ this._renderRoomResults, this.roomResultViews ];
        map[resultTypes.USERS] = [ this._renderUserResults, this.userResultViews ] ;
        map[resultTypes.MESSAGES] = [ this._renderMessageResults, this.messageResultViews ];

        if (resultType && rsp[resultType].results.length > 0) {
            var mapped = map[resultType];
            _.each(mapped[1], function(view) {
                view.destroy();
            });

            this.$content.find('.' + resultType + ' section').empty();

            mapped[0].call(this, rsp[resultType]);
        } else if(!resultType) {
            this._destroyAllResultViews();
            this.$content.find('.results section').empty();

            _.each(_.values(resultTypes), function(key) {
                if (rsp[key] && rsp[key].results.length > 0) {
                    map[key][0].call(self, rsp[key]);
                }
            });
        }
    },

    _renderRoomResults: function(rooms) {
        var contentEl = document.createElement('div'),
            self = this;

        contentEl.className = 'content module-scrollable well';

        this.pagination.rooms.nextStart = rooms.metadata.nextStart;
        this.pagination.rooms.pageCount = Math.ceil(rooms.metadata.totalCount / RESULTS_PER_PAGE);

        _.each(rooms.results, function(room) {
            var model = new Backbone.Model(room);

            var view = new roomView({
                sandbox: self.sandbox,
                model: model
            });

            self.roomResultViews.push(view);
            contentEl.appendChild(view.render().el);
        });

        var $content = this.$content.find('.results .rooms section');

        $content.html(contentEl);

        if (this.pagination.rooms.pageCount > 1) {
            $content.append(paginationTmpl(this.pagination.rooms));
        }
    },

    _renderUserResults: function(users) {
        var contentEl = document.createElement('div'),
            self = this;

        contentEl.className = 'content module-scrollable well';

        this.pagination.users.nextStart = users.metadata.nextStart;
        this.pagination.users.pageCount = Math.ceil(users.metadata.totalCount / RESULTS_PER_PAGE);

        _.each(users.results, function(user) {
            //flatten the user object
            var model = new Backbone.Model(_.extend(user.person, _.omit(user, 'person')));
            var view = new userView({
                sandbox: self.sandbox,
                model: model
            });

            self.userResultViews.push(view);
            contentEl.appendChild(view.render().el);
        });

        var $content = this.$content.find('.results .users section');

        $content.html(contentEl);

        if (this.pagination.users.pageCount > 1) {
            $content.append(paginationTmpl(this.pagination.users));
        }
    },

    _renderMessageResults: function(messages) {
        var contentEl = document.createElement('div'),
            self = this;

        contentEl.className = 'content module-scrollable well';

        this.pagination.messages.nextStart = messages.metadata.nextStart;
        this.pagination.messages.pageCount = Math.ceil(messages.metadata.totalCount / RESULTS_PER_PAGE);

        _.each(messages.results, function(message) {
            var flatMatch = Utils.flattenMessageResponse([ message.match ], self.currentUserId, true)[0],
                view;

            if (flatMatch.chatType === 'POST') {
                var model = new messageModel(flatMatch);

                view = new socialMessageView({
                    sandbox: self.sandbox,
                    model: model,
                    absoluteTime: true,
                    currentUserId: self.currentUserId
                });
            } else {
                var flatBefore, flatAfter;

                if (message.before) {
                    flatBefore = Utils.flattenMessageResponse([ message.before ], self.currentUserId, true)[0];
                }

                if (message.after) {
                    flatAfter = Utils.flattenMessageResponse([ message.after ], self.currentUserId, true)[0];
                }

                view = new contextualChatMessageView({
                    before: flatBefore,
                    match: flatMatch,
                    after: flatAfter,
                    currentUserId: self.currentUserId,
                    sandbox: self.sandbox
                });
            }

            self.messageResultViews.push(view);
            contentEl.appendChild(view.render().el);
        });

        var $content = this.$content.find('.results .messages section');

        $content.html(contentEl);

        if (this.pagination.messages.pageCount > 1) {
            $content.append(paginationTmpl(this.pagination.messages));
        }
    },

    _destroyAllResultViews: function() {
        var viewTypes = [ this.messageResultViews, this.userResultViews, this.roomResultViews ];

        _.each(viewTypes, function(type) {
            _.each(type, function(view) {
                view.destroy();
            });
        });

        this.messageResultViews = [];
        this.userResultViews = [];
        this.roomResultViews = [];
    },

    didChangeDropdown: function(e) {
        var $target = $(e.currentTarget),
            value = $target.val(),
            text = $target.find('[value="' + value + '"]').text(),
            type = $target.attr('name');

        $target.siblings('button').find('span').text(text).attr('data-value', value);

        if (type == 'showResults') {
            this.$el.removeClass('users messages rooms');

            if(!_.isEmpty(value)) {
                this.$el.addClass(value);
            }

            return;
        }

        this.criteria[type] = value;
        this._debouncedQuery();
    },

    didToggleAdvancedSearch: function() {
        var $toggle = this.$content.find('.toggle-search-type');

        this.$el.toggleClass('showing-advanced-search-fields');
        $toggle.text($toggle.text() == 'Less Options'
            ? 'More Options' : 'Less Options');
    },

    didClickPaginationItem: function(e) {
        var $target = $(e.currentTarget),
            pageNumber = parseInt($target.attr('data-page')),
            resultType = $target.closest('.result-wrap').attr('data-type'),
            oldPage = this.pagination[resultType].currentPage;

        if (_.isNaN(pageNumber)) {
            if ($target.hasClass('next')) {
                pageNumber = oldPage + 1;
            } else if ($target.hasClass('prev')) {
                pageNumber = oldPage - 1;
            } else {
                return;
            }
        }

        this.pagination[resultType].currentPage = pageNumber;
        this.pagination[resultType].oldPage = oldPage;

        this.query(resultType);
    },

    toggleCalendar: function(e) {
        var index = this.$el.find('.calendar').index(e.currentTarget),
            picker = this.datePickers[index],
            self = this;

        if (picker.isVisible()) {
            if (picker.listener) {
                document.body.removeEventListener('click', picker.listener);
                picker.listener = null;
            }

            picker.hide();
            picker.tether.destroy();
        } else {
            picker.listener = (function(target) {
                return function(evt) {
                    self._hideCalendarOnClick(evt, picker, target);
                }
            })(e.currentTarget);

            document.body.addEventListener('click', picker.listener);

            picker.tether = new Tether({
                element: picker.el,
                target: e.currentTarget,
                attachment: 'top left',
                targetAttachment: 'bottom left'
            });

            picker.show();
        }
    },

    _hideCalendarOnClick: function(e, picker, trigger) {
        if ($(e.target).closest(trigger).length > 0) {
            return;
        }

        picker.hide();
        picker.tether.destroy();

        document.body.removeEventListener('click', picker.listener);
        picker.listener = null;

    },

    destroy: function() {
        if (this.tokenInput) {
            this.tokenInput.tokenInput('destroy');
        }

        if (this.fromTypeahead) {
            this.fromTypeahead.typeahead('destroy');
        }

        Symphony.Module.prototype.destroy.call(this);
    }
});
