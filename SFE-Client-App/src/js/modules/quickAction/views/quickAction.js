require('caret');
require('atwho');

require('../../../libs/tokenInput');
require('typeahead.js');
var Symphony = require('symphony-core');
var config = require('../../../config/config');
var errors = require('../../../config/errors');
var utils = Symphony.Utils;
var showErrorMessage = require('../../common/mixins/showErrorMessage');

var quickActionTmpl = require('../templates/quickAction.handlebars');

var goIm = require('../../common/goIm/goIm');
var goRoom = require('../../common/goRoom/goRoom');
var goFilter = require('../../common/goFilter/goFilter');
var goBlast = require('../../common/goBlast/index');
var goPost = require('../../common/goPost/goPost');
var commandTokenTmpl = require('../templates/commandToken.handlebars');
var openTokenTmpl = require('../templates/openToken.handlebars');
var userTokenTmpl = require('../templates/userToken.handlebars');
var personTemplate = require('../../common/templates/autocompletions/person.handlebars');
var SEARCH_COMMAND_NAME = 'search';

//name: name of the command, text: the text to display and to match with by typeahead
var COMMANDS = [
    {name: 'im', text: 'IM'},
    {name: 'open', text: 'Open'},
    {name: 'create room', text: 'Create Room'},
    {name: 'create blast', text: 'Create Blast'},
    {name: 'create post', text: 'Create Post'},
    {name: 'create filter', text: 'Create Filter'}
];

var PLACE_HOLDER = {
    command: 'Quick Actions e.g. "Create Room" or "IM user"',
    im: 'Search for person by name',
    open: 'Type the name of the view to open'
};

module.exports = Symphony.View.extend({
    id: 'quickAction-module',
    className: 'module',

    events: {
        'click .im': 'createIm',
        'click .room': 'createRoom',
        'click .filter': 'createFilter',
        'click .blast': 'createBlast',
        'click .post': 'createPost',
        'click .close': 'close'
    },

    initialize: function (opts) {
        Symphony.View.prototype.initialize.call(this, opts);
        //initialize data set for open command
        this.views = [];
        //use jquery instead of get data from account info bcz this $(#id class) query won't be much slower and we don't need to plunk/convert/merge operations
        var navLinks = $('#nav .navlink');
        var self = this;
        _.each(navLinks, function (li) {
            var $li = $(li);
            var module = $li.attr('data-module');
            var streamId = $li.attr('data-streamid');
            var name = $li.find('.nav-view-name').text();
            if (!module || !streamId || !name) {
                console.log('module:' + module + ' - streamId:' + streamId + ' - name:' + name);
            }
            if (module == 'im')
                name = 'IM with ' + name;
            self.views.push({
                'module': module,
                'streamId': streamId,
                'name': name
            });
        });
        self.views.push({
            'module': 'settings',
            'streamId': '',
            'name': 'App-Wide Settings'
        });
        self.views.push({
            'module': 'ftue',
            'streamId': '',
            'name': 'Help'
        });
        self.views.push({
            'module': 'changelog',
            'streamId': '',
            'name': 'Change Log'
        });

        this.accountDataPromise.then(function (rsp) {
            self.currentUserId = rsp.userName;
            self.sandbox.isRunningInClientApp().done(function (flag) {
                self.isRunningInClientAppFlag = flag;
            });
        });

        this.commandSearch = new Bloodhound({
            name: 'commands',
            datumTokenizer: Bloodhound.tokenizers.obj.whitespace('name'),
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            local: COMMANDS
        });

        this.commandSearch.initialize();

        this.viewSearch = new Bloodhound({
            name: 'views',
            datumTokenizer: Bloodhound.tokenizers.obj.whitespace('name'),
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            local: this.views
        });

        this.viewSearch.initialize();

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

                        if (user.id !== self.userId) {
                            users.push(user);
                        }
                    }

                    return users;
                }
            }
        });

        this.peopleSearch.initialize();
    },

    render: function () {
        this.$el.append(quickActionTmpl({
            placeholderText: PLACE_HOLDER.command
        }));
        this.$input = this.$el.find('.quick-action');
        return this;
    },

    postRender: function () {
        this.initInput();
        var self = this;

        this.$input.on('keypress', function (e) {
            var keyCode = (e.keyCode ? e.keyCode : e.which);
            if (keyCode == 13) {
                //if press enter
                self.processInput();
                e.preventDefault();
            }else if(keyCode == 32){
                //space
                self.onSpace(e);
            }
        });
        this.$input.on('keyup', function (e) {
            if (e.keyCode == 27) {
                self.close();
            }
        });
        setTimeout(function(){
            //use setTimeout to prevent the focus callback when a module becomes active from grabbing the focus
            self.$input.focus();
        }, 200);
    },

    onSpace: function(e){
        var text = this.$input.val();
        var words = text.trim().split(/\s/);
        if(words.length > 1 || this.$input.find('.quick-action-command').length)
            return;
        try {
            var firstCommand = this.$input.data('ttTypeahead').dropdown.getDatumForTopSuggestion().raw.name;
            if (firstCommand == words[0].toLowerCase() && firstCommand != SEARCH_COMMAND_NAME) {
                this.$el.find('.tt-suggestion:first').trigger('click');
                e.preventDefault();
            }
        }catch(err){

        }
    },
    processInput: function () {
        var text = this.$input.val();
        var words = text.split(/\s/);
        var command = this.$el.find('.quick-action-command').attr('data-type');

        this.sandbox.publish("usage-event", null, {
            action: "QUICK-ACTION",
            details: {
                'user': this.currentUserId,
                'command': command
            }
        });
        switch (command.toLowerCase()) {
            case 'im':
                var userEntities = this.$el.find('.quick-action-parameter.im'), users = [];
                _.each(userEntities, function (entity) {
                    var user = $(entity).attr('data-id');
                    users.push(user);
                });
                if (!users.length) {
                    if (!text.trim()) {
                        //if user only typed 'im' with no parameter
                        this.createIm();
                    } else {
                        //if user typed userId directly without using auto-complete
                        users = text.replace(/\s/g, '').split(',');
                        this.goIm(users);
                    }
                } else {
                    this.goIm(users);
                }
                break;
            case 'create room':
                this.createRoom();
                break;
            case 'create post':
                this.createPost();
                break;
            case 'create filter':
                this.createFilter();
                break;
            case 'create blast':
                this.createBlast();
                break;
            case 'open':
                var $view = this.$el.find('.quick-action-parameter.open'), module;
                if ($view.length) {
                    module = $view.attr('data-module');
                }
                if (module == 'profile') {
                    this.sandbox.publish('view:show', null, {
                        module: 'profile',
                        'userId': this.opts.userName
                    });
                    this.close();
                } else if (module == 'settings') {
                    //need to close quick action modal first
                    this.close();
                    this.sandbox.publish('modal:show', null, {
                        title: 'Application Settings',
                        contentView: 'appsettings',
                        isRunningInClientAppFlag: this.isRunningInClientAppFlag
                    });
                } else if (module) {
                    this.sandbox.publish('view:show', null, {
                        'streamId': $view.attr('data-streamId'),
                        'module': module
                    });
                    this.close();
                }
                break;
            default:
                break;
        }
    },

    initInput: function () {
        this.$input.tokenInput({
            typeaheadOptions: [
                {
                    minLength: 1,
                    highlight: true,
                    hint: true,
                    autoselect: true
                },
                {
                    name: 'command',
                    displayKey: 'text',
                    source: this.commandAdapter.bind(this),
                    templates: {
                        suggestion: this.commandTmpl
                    }
                }
            ],

            callbacks: {
                makeAutocompleteToken: function (e, suggestion) {
                    return _.extend({id: 'command'}, suggestion);
                },
                didAddToken: this.onSelectCommandToken.bind(this),
                didRemoveToken: this.onRemoveToken.bind(this)
            },

            tokenTemplate: commandTokenTmpl
        });
        //hack to not show 2px border radius gap at the bottom, when typeahead v0.11 release, we can use the event opened/closed to change style
        this.$el.find('.tt-dropdown-menu').css('top', this.$el.find('.token-input').height() - 1);
    },

    prepareForCommand: function () {
        //reset the input to use command auto-complete
        this.$input.tokenInput('reset', {
            typeaheadOptions: [
                {
                    minLength: 1,
                    highlight: true,
                    hint: true,
                    autoselect: true
                },
                {
                    name: 'command',
                    displayKey: 'text',
                    source: this.commandAdapter.bind(this),
                    templates: {
                        suggestion: this.commandTmpl
                    }
                }
            ],

            callbacks: {
                makeAutocompleteToken: function (e, suggestion) {
                    return _.extend({id: 'command'}, suggestion);
                },
                didAddToken: this.onSelectCommandToken.bind(this),
                didRemoveToken: this.onRemoveToken.bind(this)
            },

            tokenTemplate: commandTokenTmpl
        });

        this.$input.attr('placeholder', PLACE_HOLDER.command);
        this.$el.find('.tt-dropdown-menu').css('top', this.$el.find('.token-input').height() - 1);
    },

    commandAdapter: function (query, cb) {
        this.commandSearch.get(query, function (suggestions) {
            //inject search as the last suggestion, set text to be empty so that it won't show hint because typeahead can't match '' with what user typed
            suggestions.push({name: SEARCH_COMMAND_NAME, param: query, text: ''});
            cb(suggestions);
        });
    },

    commandTmpl: function(suggestion){
        if(suggestion.name == SEARCH_COMMAND_NAME){
            return '<p class="command search">Search For "'+suggestion.param+'"</p>';
        }else{
            return '<p>' + suggestion.text + '</p>';
        }
    },

    onSelectCommandToken: function (token, tokenList) {
        this.$input.attr('placeholder', '');
        //revert the width
        this.$input.css('width', '');
        var self = this;
        switch (token.name) {
            case 'open':
                //change the size of the input so that it can fit the minimum length of the hint, otherwise you will be multi-line even there is enough space for another token.
                this.$input.css('width', '210px');
                //wait for typeahead to complete all it's event processsing then reset tokenInput
                //if don't use timeout, typeahead will throw error (this bug will be fixed in typeahead v.0.11.0).
                setTimeout(function () {
                    self.prepareForOpen();
                    self.$input.focus();
                }, 100);
                break;
            case 'im':
                this.$input.css('width', '200px');

                setTimeout(function () {
                    self.prepareForIM();
                    self.$input.focus();
                }, 100);
                break;
            case SEARCH_COMMAND_NAME:
                //open search module
                var query = token.param;
                this.sandbox.publish('view:show', null, {
                    module: 'search',
                    query: query
                });
                this.sandbox.publish("usage-event", null, {
                    action: "QUICK-ACTION",
                    details: {
                        'user': this.currentUserId,
                        'command': SEARCH_COMMAND_NAME
                    }
                });
                setTimeout(function () {
                    self.close();
                }, 50);
                break;
            case 'create room':
                this.createRoom();
                break;
            case 'create post':
                this.createPost();
                break;
            case 'create filter':
                this.createFilter();
                break;
            case 'create blast':
                this.createBlast();
                break;
            default:
                break;
        }
//        this.$input.focus();
    },

    onRemoveToken: function (tokenRemoved, tokenList) {
        if (tokenRemoved.id === 'command') {
            this.prepareForCommand();
        } else if(tokenRemoved.type === 'im-people') {
            this.$el.find('.tt-dropdown-menu').css('top', this.$el.find('.token-input').height() - 1);
        }

        this.$input.focus();
    },

    prepareForOpen: function () {
        var self = this;
        this.$input.tokenInput('reset', {
            typeaheadOptions: [
                {
                    minLength: 1,
                    highlight: true,
                    hint: true,
                    autoselect: true
                },
                {
                    name: 'views',
                    displayKey: 'name',
                    source: this.viewSearch.ttAdapter(),
                    templates: {
                        suggestion: function(context){
                            return '<p>' + context.name + '</p><div class="view-type">'+self.getViewType(context.module)+'</div>';
                        }
                    }
                }
            ],
            callbacks: {
                makeAutocompleteToken: function (e, suggestion) {
                    return _.extend({id: 'open-param'}, suggestion);
                },
                didAddToken: this.didAddOpenToken.bind(this),
                didRemoveToken: this.onRemoveToken.bind(this)
            },

            tokenTemplate: openTokenTmpl
        });
        this.$input.attr('placeholder', PLACE_HOLDER.open);
        //change the size of the input so that it can fit the minimum length of the hint, otherwise you will see multi-line even there is enough space for another token.
        this.$input.css('width', '210px');
        //align the typeahead hint
        var $hint = this.$el.find('.tt-hint');
        $hint.css('left', '');
        $hint.css('width', '210px');
        this.$el.find('.tt-dropdown-menu').css('top', this.$el.find('.token-input').height() - 1);
    },

    getViewType: function(moduleName){
        var type = '';
        switch(moduleName){
            case 'chatroom':
                type = 'Room';
                break;
            case 'filter':
                type = 'Filter';
                break;
            case 'my-department':
            case 'organizational-leaders':
                type = 'Channel';
                break;
            case 'im':
            case 'following':
            case 'keywords':
            case 'mentions':
            default:
                break;
        }
        return type;
    },
    didAddOpenToken: function () {
        //since we don't allow multiple views, will open the view directly
        var $view = this.$el.find('.quick-action-parameter.open'), module;
        if ($view.length) {
            module = $view.attr('data-module');
        }
        if (module == 'profile') {
            this.sandbox.publish('view:show', null, {
                module: 'profile',
                'userId': this.opts.userName
            });
            this.close();
        } else if (module == 'settings') {
            //need to close quick action modal first
            this.close();
            this.sandbox.publish('modal:show', null, {
                title: 'Application Settings',
                contentView: 'appsettings',
                isRunningInClientAppFlag: this.isRunningInClientAppFlag
            });
        } else if (module) {
            this.sandbox.publish('view:show', null, {
                'streamId': $view.attr('data-streamId'),
                'module': module
            });
            this.close();
        }
    },

    prepareForIM: function () {
        this.$input.tokenInput('reset', {
            typeaheadOptions: [
                {
                    minLength: config.MIN_SEARCH_LENGTH,
                    highlight: true,
                    hint: false,
                    autoselect: true
                },
                {
                    name: 'im-people',
                    displayKey: 'prettyName',
                    source: this.peopleSearch.ttAdapter(),
                    templates: {
                        suggestion: personTemplate
                    }
                }
            ],

            callbacks: {
                makeAutocompleteToken: function (e, suggestion) {
                    return {
                        id: suggestion.id,
                        name: suggestion.prettyName,
                        image: suggestion.images && suggestion.images['50'] ? suggestion.images['50'] : suggestion.imageUrlSmall
                    };
                },
                didAddToken: this.onIMTokenAdded.bind(this),
                didRemoveToken: this.onRemoveToken.bind(this)
            },

            tokenTemplate: userTokenTmpl
        });
        this.$input.attr('placeholder', PLACE_HOLDER.im);
        //change the size of the input so that it can fit the length of a user token, otherwise you will see multi-line even there is enough space for another token.
        this.$input.css('width', '200px');
        //align the typeahead hint
        var $hint = this.$el.find('.tt-hint');
        $hint.css('left', '');
        $hint.css('width', '200px');
        this.$el.find('.tt-dropdown-menu').css('top', this.$el.find('.token-input').height() - 1);
    },

    onIMTokenAdded: function(){
        //in case the input is pushed to next line, need to adjust the position of dropdown menu
        this.$el.find('.tt-dropdown-menu').css('top', this.$el.find('.token-input').height() - 1);
    },

    _usersQuery: function (query, callback) {
        var self = this;

        if (query != null && query.length >= config.MIN_SEARCH_LENGTH) {
            this.sandbox.send({
                'id': 'SOLR_SEARCH_URL',
                'payload': {
                    'q': query,
                    'type': 'people'
                }
            }).then(function (rsp) {
                if (rsp.queryResults && rsp.queryResults[0] && rsp.queryResults[0].users) {
                    callback.call(this, self._formatUsersQueryResponse(rsp.queryResults[0].users));
                }
            });
        }
    },

    _formatUsersQueryResponse: function (users) {
        var ret = [];

        _.each(users, function (u) {
            var obj = {};
            obj.person = u.person;
            obj.text = u.person.prettyName;
            obj.value = '@' + u.person.id;

            ret.push(obj);
        });

        return ret;
    },

    createIm: function () {
        var self = this;

        var contentView = new goIm({
            'sandbox': self.sandbox
        });

        this.close()

        this.sandbox.publish('modal:show', null, {
            contentView: contentView,
            title: 'Instant Message',
            isFlat: true
        });
    },

    goIm: function (userIds) {
        var self = this;

        utils.startChat({
            'sandbox': this.sandbox,
            'userId': userIds
        }).then(function(rsp){
            self.close();
        }, function(rsp){
            if (rsp.status === 411) {
                self.showErrorMessage(errors.COMMON.INFO_BARRIER.IB_ERROR, 0);
            } else {
                self.showErrorMessage(rsp.responseJSON.message || errors.GO.IM.ERROR, 5000);
            }
        });
    },

    createRoom: function () {
        var self = this;

        var contentView = new goRoom({
            'sandbox': self.sandbox
        });

        this.close()

        this.sandbox.publish('modal:show', null, {
            contentView: contentView,
            title: 'Chat Room',
            isFlat: true
        });
    },

    createFilter: function () {
        var self = this;

        var contentView = new goFilter({
            'sandbox': self.sandbox,
            'createNew': true
        });

        this.close();

        this.sandbox.publish('modal:show', null, {
            contentView: contentView,
            title: 'Filter',
            isFlat: true
        });
    },

    createBlast: function () {
        var contentView = new goBlast({
            sandbox: this.sandbox
        });

        this.close();

        this.sandbox.publish('modal:show', null, {
            contentView: contentView,
            title: 'Blast Message',
            isFlat: true
        });
    },

    createPost: function () {
        var contentView = new goPost({
            sandbox: this.sandbox
        });

        this.close();

        this.sandbox.publish('modal:show', null, {
            contentView: contentView,
            title: 'Post',
            isFlat: true
        });
    },

    close: function () {
        this.$input.tokenInput('destroy').off();
        this.sandbox.publish('modal:hide');
    }
});

_.extend(module.exports.prototype, showErrorMessage);
