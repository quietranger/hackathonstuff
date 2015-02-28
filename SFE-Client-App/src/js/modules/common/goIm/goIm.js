var Backbone = require('backbone');
var Symphony = require('symphony-core');
var Handlebars = require('hbsfy/runtime');
var config = require('../../../config/config');
var utils = Symphony.Utils;

var goImTmpl = require('./goIm.handlebars');
var errors = require('../../../config/errors');

var personTemplate = require('../templates/autocompletions/person.handlebars');
var showErrorMessage = require('../mixins/showErrorMessage');

Handlebars.registerHelper('personResult', personTemplate);

require('../../../libs/tokenInput');

require('typeahead.js');

module.exports = Backbone.View.extend({
    className: 'module go-im people-search',

    events: {
        'click .submit': 'beginChat',
        'click .cancel': 'hide'
    },

    keyboardEvents: {
        'enter': 'beginChat'
    },

    initialize: function (opts) {
        var self = this;
        this.opts = opts || {};
        this.sandbox = opts.sandbox;
        this.headless = opts.headless || false;
        this.isDisabled = true;
        this.addedUsers = opts.peopleArr || [];
        this.tokenInput = null;
        this.blockEnter = false;

        if (!this.headless) {
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
        }
        this.acctRequest = this.sandbox.getData('app.account').then(function (rsp) {
            self.acctData = rsp;
            self.userId = self.acctData.userName;
            if (self.headless) {
                self.beginChat();
            }
        });
    },

    render: function () {
        var self = this;
        this.$el.append(goImTmpl());

        this.acctRequest.done(function(){
            if (self.opts.prepopulate
                ) {
                for(var i = 0, len = self.opts.prepopulate.length; i < len; i++) {
                    self.addPerson(self.opts.prepopulate[i]);
                }
            }
        });

        return this;
    },
    postRender: function () {
        if (!this.headless) {
            var self = this,
                input;

            this.tokenInput = input = this.$el.find('#add-person').tokenInput({
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
                    makeAutocompleteToken: function(e, suggestion) {
                        return {
                            id: suggestion.id.toString(),
                            name: suggestion.prettyName,
                            image: suggestion.images && suggestion.images['50'] ? suggestion.images['50'] : suggestion.imageUrlSmall
                        };
                    },
                    didAddToken: this.tokensDidChange.bind(this),
                    didRemoveToken: this.tokensDidChange.bind(this)
                }
            }).on('typeahead:opened', function() {
                self.blockEnter = true;
            }).on('typeahead:closed', function() {
                _.defer(function() {
                    self.blockEnter = false;
                });
            });

            _.defer(function() {
                input.focus();
            }); //typeahead stops it from focusing for some reason :(
        }
    },

    tokensDidChange: function(token, tokenList) {
        this.addedUsers = tokenList;

        this.$el.find('.submit').toggleClass('disabled', tokenList.length === 0);
    },

    beginChat: function (e) {
        var self = this;

        if (this.addedUsers.length === 0) {
            return;
        }

        if (e && this.blockEnter) {
            return;
        }

        utils.startChat({
            'sandbox': this.sandbox,
            'userId':  _.pluck(this.addedUsers, 'id')
        }).then(function(rsp){
            if (self.headless) {
                self.destroy();
            } else {
                self.hide();
            }
        }, function(rsp){
            if (self.headless) {
                self.destroy();
            }
            if(rsp.status == 411){
                self.showErrorMessage(errors.COMMON.INFO_BARRIER.IB_ERROR, 0);
            }else {
                self.showErrorMessage(errors.GO.IM.ERROR, 5000);
            }
        });
    },

    hide: function() {
        this.sandbox.publish('modal:hide');
    },

    destroy: function() {
        if (this.peopleSearch) {
            this.peopleSearch.clear();
            this.peopleSearch.clearRemoteCache();
            this.peopleSearch = null;
        }

        if (this.tokenInput) {
            this.tokenInput.tokenInput('destroy');
        }

        this.addedUsers = null;

        this.remove();
    }
});

_.extend(module.exports.prototype, showErrorMessage);

var presenceMixin = require('../../common/mixins/presenceMixin');
presenceMixin(module.exports);
