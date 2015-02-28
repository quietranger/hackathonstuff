var Backbone = require('backbone');
var Symphony = require('symphony-core');

require('typeahead.js');
require('../../common/helpers/index');
var Q = require('q');
var Handlebars = require('hbsfy/runtime');
var headerTmpl = require('../templates/header.handlebars');
var mixinDefaults = require('../../common/mixins/moduleDefaults');
var searchTemplateFactory = require('../classes/searchTemplateFactory.js');
var utils = Symphony.Utils;

searchTemplateFactory = new searchTemplateFactory();

var EasyPostView = require("./easyPost");

var UpdateAvatarModal = require('./modals/updateAvatarModal');

module.exports = Backbone.View.extend({
    el: '#header',

    events: {
        "keypress #main-search-bar": "_onSearchKeyPress",
        "click .show-results": "openSearchView",
        'click .app-settings': 'appSettings',
        'click .myprofile-button': 'myProfile',
        'click .create-button': 'showCreateNewModule',
        'click .easy-post-button:not(.active) .easy-post-button-clickable': 'showEasyPostView',
        'click .profile-link,.large-avatar': 'showMyProfile',
        'click .show-ftue': 'showFtue',
        'click .show-change-log': 'showChangeLog',
        'click .show-help': 'showFeedback',
        'click .show-more': 'toggleSettingsMenu',
        'click .start-tour': 'startTour',
        'click .new-features': 'newFeatures',
        'click .update-avatar': 'updateAvatar',
        'change #header-upload-avatar': 'showUpdateAvatarModal',
        'click .log-out': 'logOut'
    },

    initialize: function (opts) {
        this.sandbox = opts.sandbox;
        this.opts = opts || {};
        this.viewId = opts.viewId;
        this.jqSearchBox = null;
        this.qData = Q.defer();
        this.qRender = Q.defer();
        this.requestingChat = null;
        this.opts.enableSelfServe = process.env.ENABLE_SELF_SERVE === 'true';

        var self = this;
        this.sandbox.getData('app.account').then(function(account) {
            _.extend(self.opts, account);

            self.sandbox.isRunningInClientApp().done(function (flag) {
                self.isRunningInClientAppFlag = flag;
                self.qData.resolve();
            });

        });

        this.sandbox.subscribe('click', function(context, e){
            self.clickAny(e);
        });

        this.sandbox.subscribe('avatar:change', this.onAvatarChange.bind(this));

        this.listenTo(this.eventBus, 'update-avatar-modal:destroying', this.resetAvatarFileInput.bind(this));
    },
    render: function () {
        var self = this;
        self.qData.promise.done(function () {

            self.peopleSearch = new Bloodhound({
                datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
                queryTokenizer: Bloodhound.tokenizers.whitespace,
                limit: 3,
                remote: {
                    url: Symphony.Config.API_ENDPOINT + '/search/Search?q=%QUERY&type=people',
                    filter: function (parsedResponse) {
                        if (parsedResponse.queryResults) {
                            searchTemplateFactory.peopleCount = parsedResponse.queryResults[0].totalNumberFound;
                            _.each(parsedResponse.queryResults[0].users, function(user){
                                user.isCurrentUser = self.opts.userName === user.person.id;
                            });
                            return parsedResponse.queryResults[0].users;
                        } else{
                            searchTemplateFactory.peopleCount = 0;
                            return [];
                        }
                    }
                }
            });
            self.roomSearch = new Bloodhound({
                datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
                queryTokenizer: Bloodhound.tokenizers.whitespace,
                limit: 3,
                remote: {
                    url: Symphony.Config.API_ENDPOINT + '/search/Search?q=%QUERY&type=room',
                    filter: function (parsedResponse) {
                        if (parsedResponse.queryResults) {
                            searchTemplateFactory.roomsCount = parsedResponse.queryResults[0].totalNumberFound;
                            return parsedResponse.queryResults[0].rooms;
                        } else {
                            searchTemplateFactory.roomsCount = 0;
                            return [];
                        }
                    }
                }
            });
            self.msgSearch = new Bloodhound({
                datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
                queryTokenizer: Bloodhound.tokenizers.whitespace,
                limit: 3,
                remote: {
                    url: Symphony.Config.API_ENDPOINT + '/search/Search?q=%QUERY&type=socialmessage&connectorid=lc',
                    filter: function (parsedResponse) {
                        if (parsedResponse.queryResults) {
                            searchTemplateFactory.messagesCount = parsedResponse.queryResults[0].totalNumberFound;
                            return parsedResponse.queryResults[0].socialMessages;
                        } else {
                            searchTemplateFactory.messagesCount = 0;
                            return [];
                        }
                    }
                }
            });

            self.roomSearch.initialize();
            self.msgSearch.initialize();
            self.peopleSearch.initialize();


            self.$el.html(headerTmpl(self.opts));
            self.qRender.resolve();
        });
        return this;
    },
    postRender: function () {
        var self = this;
        self.qRender.promise.done(function () {
            self.jqSearchBox = self.$el.find('#main-search-bar');

            self.$el.on('mousedown.tt', function(e, a, b){
                if($(e.target).hasClass('start-chat')) {
                    self.requestingChat = true;
                }
            });

            self.jqSearchBox.typeahead({
                minLength: 3,
                highlight: true
            }, {
                name: 'main-search-people',
                displayKey: function (suggestion) {
                    return suggestion.person.prettyName;
                },
                source: self.peopleSearch.ttAdapter(),
                templates: searchTemplateFactory.makePeopleTemplate()
            }, {
                name: 'main-search-room',
                displayKey: 'name',
                source: self.roomSearch.ttAdapter(),
                templates: searchTemplateFactory.makeRoomsTemplate()
            }, {
                name: 'main-search-msg',
                displayKey: function (suggestion) {
                    return suggestion.message.text;
                },
                source: self.msgSearch.ttAdapter(),
                templates: searchTemplateFactory.makeMessagesTemplate()
            });
            self.jqSearchBox.on('typeahead:selected', function (e, suggestion, datasetName) {
                //TODO: TBD the action when a user select on suggestion
                if (datasetName === 'main-search-people') {
                    if(self.requestingChat){
                        utils.startChat({
                            'sandbox': self.sandbox,
                            'userId': [suggestion.person.id]
                        });
                        self.requestingChat = false;
                    } else {
                        self.sandbox.publish('view:show', null, {
                            module: 'profile',
                            'userId': suggestion.person.id
                        });
                    }
                } else if (datasetName === 'main-search-room') {
                    self.sandbox.publish('view:show', null, {
                        module: 'search',
                        'query': suggestion.name
                    });
                } else if (datasetName === 'main-search-msg') {
                    self.sandbox.publish('view:show', null, {
                        module: 'search',
                        'query': suggestion.message.text
                    });
                }
                self.jqSearchBox.typeahead('val', '');
            });
        });
    },

    clickAny: function(){
        this.$el.find('.popover').removeClass('open'); //always close it, even if they clicked inside the menu
    },

    updateAvatar: function() {
        this.$el.find('#header-upload-avatar').click();
    },

    showUpdateAvatarModal: function(e) {
        var contentView = new UpdateAvatarModal({
            sandbox: this.sandbox,
            eventBus: this.eventBus,
            file: e.target.files[0]
        });

        this.sandbox.publish('modal:show', null, {
            contentView: contentView,
            title: 'Update Avatar'
        });
    },

    showCreateNewModule: function() {
        this.sandbox.publish('modal:show', null, {
            title: 'Create New...',
            contentView: 'go',
            isFlat: true
        });
    },

    onAvatarChange: function(ctx, avatar) {
        if (this.opts.userName !== avatar.userId) {
            return;
        }

        this.$el.find('.my-profile img').attr('src', avatar.images['50']);
    },

    resetAvatarFileInput: function() {
        this.$el.find('#header-upload-avatar').replaceWith('<input id="header-upload-avatar" type="file" accept="image/*"/>');
    },

    showEasyPostView: function(event) {
        var $elem = $(event.currentTarget).closest(".easy-post-button");
        this.qData.promise.then(function() {
            $elem.addClass("active");
            if (!this.easyPostView) {
                this.easyPostView = new EasyPostView({
                    sandbox: this.sandbox,
                    eventBus: this.eventBus,
                    userId: this.opts.userName,
                    streamId: this.opts.myCurrentThreadId
                });
                $elem.append(this.easyPostView.render().postRender().el);
            } else {
                this.easyPostView._showEasyPost();
            };
            this.listenTo(this.eventBus, "easyPost:destroy", function(event) {
                $elem.removeClass("active");
                this.easyPostView = null;
                this.stopListening(this.eventBus, "easyPost:destroy");
                this.stopListening(this.eventBus, "easyPost:hide");
            }.bind(this));
            this.listenTo(this.eventBus, "easyPost:hide", function(event) {
                $elem.removeClass("active");
            }.bind(this));
        }.bind(this));
    },

    destroy: function () {
        this.peopleSearch.clear();
        this.peopleSearch.clearRemoteCache();
        this.peopleSearch = null;

        this.roomSearch.clear();
        this.roomSearch.clearRemoteCache();
        this.roomSearch = null;

        this.msgSearch.clear();
        this.msgSearch.clearRemoteCache();
        this.msgSearch = null;

        if (this.easyPostView) {
            this.easyPostView.destroy();
        };

        this.jqSearchBox.typeahead('destroy');
    },

    appSettings: function () {
        this.sandbox.publish('modal:show', null, {
            title: 'Application Settings',
            contentView: 'appsettings',
            isRunningInClientAppFlag: this.isRunningInClientAppFlag
        });
    },

    _onSearchKeyPress: function (e) {
        if (e.keyCode === 13) {
            this.openSearchView();
        }
    },

    openSearchView: function () {
        this.sandbox.publish('view:show', null, {
            module: 'search',
            query: this.jqSearchBox.typeahead('val')
        });
        this.jqSearchBox.typeahead('close');
    },

    myProfile: function () {
        this.sandbox.publish('view:show', null, {
            module: 'profile'
        });

    },

    exportJson: function () {
        return _.extend({}, {
            module: 'header',
            sizeX: this.sizeX,
            sizeY: this.sizeY
        });
    },

    showMyProfile: function() {
        this.sandbox.publish('view:show', null, {
            module: 'profile',
            'userId': this.opts.userName
        });
    },

    showFtue: function() {
        this.sandbox.publish('view:show', null, {
            module: 'ftue'
        });
    },

    showChangeLog: function() {
        this.sandbox.publish('view:show', null, {
            module: 'changelog'
        });
    },

    showFeedback: function(e) {
        var $target = $(e.currentTarget);
        var opts = {
            fnName: 'openLink',
            param: {url: $target.attr('href')}
        };
        this.sandbox.publish('appBridge:fn', null, opts);
        e.preventDefault();
    },

    toggleSettingsMenu: function (e, state) {
        if (e) {
            e.stopPropagation();
        }

        this.$el.find('#my-account.popover').toggleClass('open', state);
    },

    startTour: function() {
        this.sandbox.publish('modal:show', null, {
            title: 'Welcome to Symphony',
            closable: false,
            contentView: 'welcome-tour',
            isFlat: true,
            opts: this.opts
        });
    },

    newFeatures: function() {
        this.sandbox.publish('modal:show', null, {
            title: 'New Features in Symphony',
            subtitle: 'See what is new with Symphony',
            closable: false,
            contentView: 'newFeaturesModal',
            isFlat: true,
            opts: this.opts
        });
    },

    logOut: function() {
        document.cookie = Symphony.Config.SESSION_COOKIE_NAME + '=;path=/;domain=.symphony.com;expires=Thu, 01 Jan 1970 00:00:01 GMT;';

        this._redirectToLogin();
    },

    _redirectToLogin: function() {
        window.location.href = Symphony.Config.LOGIN_PAGE;
    }
});

var presenceMixin = require('../../common/mixins/presenceMixin');
mixinDefaults(module.exports);
presenceMixin(module.exports);
