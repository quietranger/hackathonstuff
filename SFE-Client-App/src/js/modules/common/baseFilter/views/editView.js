var Backbone = require('backbone');
var Symphony = require('symphony-core');
var Handlebars = require('hbsfy/runtime');
var Q = require('q');

var editTmpl = require('../templates/edit.handlebars');
var filterRuleTmpl = require('../templates/filter-rule.handlebars');
var typeaheadResultTmpl = require('../templates/typeahead-result.handlebars');
var personTmpl = require('../../templates/person-result.handlebars');
var twitterPersonTmpl = require('../../templates/twitter-person-result.handlebars');

var showErrorMessage = require('../../mixins/showErrorMessage');
var errors = require('../../../../config/errors');

require('../../helpers/index');

var ruleTypes = {
    KEYWORD: 'KEYWORD',
    CASHTAG: 'CASHTAG',
    USER_FOLLOW: 'USER_FOLLOW'
};

var prefixMap = {};
prefixMap[ruleTypes.KEYWORD] = '#';
prefixMap[ruleTypes.CASHTAG] = '$';
prefixMap[ruleTypes.USER_FOLLOW] = '@';

//refer to textInput.js see the patterns about richentities
var HashtagValidator = /(?:^[^!@#$%^&*()+=<>,./?`~:;'"\\\\|\s-]+)$/g;
var CashtagValidator = /(?:^[a-zA-Z0-9][a-zA-Z0-9_]*(?:.[a-zA-Z]+)?)/g;

Handlebars.registerHelper('entityPrefix', function(entity) {
    var prefixes = {
        HASHTAG: '#',
        CASHTAG: '$',
        USER_FOLLOW: '@'
    };

    return prefixes[entity];
});

Handlebars.registerHelper('stripEntity', function(text) {
    if (!text) {
        return '';
    }

    return text.replace(/^[\$#@]{1,}/i, '');
});

Handlebars.registerHelper('isEditable', function(editable) {
    var ret = '';

    if(!editable) {
        ret = 'disabled="disabled"';
    }

    return ret;
});

Handlebars.registerPartial('filter-rule', filterRuleTmpl);

module.exports = Backbone.View.extend({
    className: 'filter-settings people-search',

    events: {
        'click a.add-rule': 'addRule',
        'click a.remove-rule': 'removeRule',
        'click a.close, a.cancel': 'close',
        'click a.submit': 'save',
        'focus li select': 'didFocusSelect',
        'change .rule-type select, .definition-type select': 'ruleTypeDidChange',
        'change .rule-type select': 'toggleRuleTypePrefix',
        'keyup #filter-name': 'fieldDidInput',
        'typeahead:selected .rule-text': 'didSelectAutocompleteValue',
        'typeahead:autocompleted .rule-text': 'didSelectAutocompleteValue'
    },

    keyboardEvents: {
        'tab': 'tabPressed',
        'shift+enter': 'save'
    },

    initialize: function(opts) {
        this.opts = opts || {};
        this.sandbox = opts.sandbox;
        this.eventBus = opts.eventBus || _.extend({}, Backbone.Events);
        this.streamId = opts.streamId;
        this.editable = opts.editable;
        this.createNew = opts.createNew === undefined ? false : opts.createNew;
        this.keywords = [];
        this.cashtags = [];
        this.following = [];
        this.existingKeywordsFollowers = [];
        this.prettyNamesMap = {};
        this.filterData = null;
        this.settings = {
            editable: opts.editable,
            createNew: this.createNew,
            connectors: [
                {
                    name: 'Symphony',
                    id: 'lc'
                }
            ]
        };

        this._rulesCache = {};
        this._pendingRules = [];
        this._pendingRulesQ = null;

        this.peopleSearch = new Bloodhound({
            datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            limit: 3,
            remote: {
                url: Symphony.Config.API_ENDPOINT + '/search/Search?q=%QUERY&type=people',
                filter: function (parsedResponse) {
                    var users = [];
                    for (var i = 0, len = parsedResponse.queryResults[0].users.length; i < len; i++) {
                        var user = parsedResponse.queryResults[0].users[i];
                        user.userId = user.person.id;
                        user.prefix = '@';
                        user.displayName = user.person.prettyName;
                        users.push(user);
                    }
                    return users;
                }
            }
        });

        this.twitterSearch = new Bloodhound({
            datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            limit: 3,
            remote: {
                url: Symphony.Config.API_ENDPOINT + '/external_user_search?term=%QUERY&connector_id=tw&limit=5&is_partial=true',
                filter: function (parsedResponse) {
                    var users = [];
                    for (var i = 0, len = parsedResponse.users.length; i < len; i++) {
                        var user = parsedResponse.users[i];
                        user.userId = user.id;
                        user.prefix = '@';
                        user.displayName = user.screenName;
                        users.push(user);
                    }
                    return users;
                }
            }
        });

        this.peopleSearch.initialize();
        this.twitterSearch.initialize();

        var self = this;

        if (this.createNew) {
            this.listenTo(this.eventBus,'settings:saved', function(model) {
                self.sandbox.publish('view:created', null, model);
            });
        }

        var query = this.sandbox.getData('app.account');

        query.done(function(rsp) {
            self.filterData = rsp.filters;
            self.userName = rsp.userName;

            if (rsp.socialConnectors) {
                var map = {
                    tw: 'Twitter'
                };

                _.each(rsp.socialConnectors, function(con) {
                    var name = map[con];

                    if (!name) {
                        return;
                    }

                    self.settings.connectors.push({
                        id: con,
                        name: name
                    });
                });
            }

            self.parseExistingKeywordsFollowers();

            if (self.createNew) {
                self.editable = self.settings.editable = true;

                if (self.opts.ruleGroup) {
                    self.settings.ruleGroup = self.opts.ruleGroup;

                    //I have to do this since handlebars doesn't let me access the parent view context from a partial.
                    //It makes me sad.
                    if (self.settings.ruleGroup.rules.length > 0) {
                        _.each(self.settings.ruleGroup.rules, function(rule) {
                            rule.editable = self.settings.editable;
                            rule.connectors = self.settings.connectors;
                        });
                    }
                } else {
                    self.settings.ruleGroup = {
                        rules: []
                    };

                    self.settings.ruleGroup.rules.push({
                        connectorId: "lc",
                        definitionType: "HASHTAG",
                        id: "",
                        text: "",
                        type: "DEFINITION",
                        editable: self.settings.editable,
                        connectors: self.settings.connectors
                    });

                }

                self.render();

                return;
            }

            var settings = _.find(self.filterData, function(res) { return res._id === self.streamId });

            if (settings) {
                $.extend(true, self.settings, settings);

                var userIds = _.pluck(_.filter(settings.ruleGroup.rules, function(rule) {
                    return rule.definitionType == 'USER_FOLLOW' && rule.connectorId == 'lc';
                }), 'id');

                var twitterIds = _.pluck(_.filter(settings.ruleGroup.rules, function(rule) {
                    return rule.definitionType == 'USER_FOLLOW' && rule.connectorId == 'tw';
                }), 'id');

                var reqCount = 0;

                if (userIds.length > 0) {
                    reqCount++;
                }

                if (twitterIds.length > 0) {
                    reqCount++;
                }

                if (reqCount == 0) {
                    self.initRules();
                    return;
                }

                var after = _.after(reqCount, self.initRules.bind(self));

                if (userIds.length > 0) {
                    self.sandbox.send({
                        id: 'USER_RESOLVE',
                        payload: {
                            ids: userIds.join(',')
                        }
                    }).then(function(rsp) {
                        _.extend(self.prettyNamesMap, _.indexBy(rsp, 'id'));

                        after();
                    }, function() {
                        self.showErrorMessage(errors.COMMON.BASE_FILTER.EDIT.RESOLVE_USERS, 5000);
                    });
                }

                if (twitterIds.length > 0) {
                    self.sandbox.send({
                        id: 'SHOW_EXTERNAL_USERS',
                        payload: {
                            id_list: twitterIds.join(','),
                            connector_id: 'tw'
                        }
                    }).then(function(rsp) {
                        console.log(rsp);

                        if (rsp.users) {
                            _.extend(self.prettyNamesMap, _.indexBy(rsp.users, 'id'));
                        }

                        after();
                    }, function() {
                        self.showErrorMessage(errors.COMMON.BASE_FILTER.EDIT.RESOLVE_USERS_TWITTER, 5000);
                    });
                }
            }
        });
    },

    initRules: function() {
        var self = this;

        if ( _.isEmpty(self.settings.ruleGroup.rules)) {
            self.settings.ruleGroup.rules.push({
                connectorId: "lc",
                definitionType: "HASHTAG",
                id: "#",
                text: "#",
                type: "DEFINITION"
            });
        }

        _.each(self.settings.ruleGroup.rules, function(rule) {
            rule.editable = self.settings.editable;
            rule.connectors = self.settings.connectors;

            if (rule.definitionType == ruleTypes.USER_FOLLOW) {
                var mapped = self.prettyNamesMap[rule.id];

                if(!mapped) {
                    return;
                }

                rule.id = mapped.id.toString();
                if (rule.connectorId == 'lc') {
                    rule.text = mapped.prettyName;
                    rule.screenName = mapped.screenName;

                } else if (rule.connectorId == 'tw') {
                    rule.text = mapped.screenName;
                }
            } else {
                rule.definitionType = rule.text[0] == '#' ? 'KEYWORD' : 'CASHTAG';
            }
        });
        self.render();
    },

    render: function() {
        this.$el.html(editTmpl(this.settings));

        if (this.settings.ruleGroup && this.settings.ruleGroup.rules && this.editable) {
            if (this.settings.ruleGroup.rules.length == 1) {
                this.$el.find('.rule-row').addClass('only');
            } else {
                this.$el.find('.rule-row').last().addClass('last');
            }
        }

        var self = this;

        this.$el.find('li').each(function() {
            var $row = $(this);

            self._initTypeahead($row);
            self.toggleRuleTypePrefix($row.find('select:first'));
        });

        this.$el.find('#filter-name').focus().val(this.settings.name);

        return this;
    },

    fieldDidInput: function(e) {
        var $target = $(e.currentTarget);

        if (e.keyCode == 13) {
            this.save();
        }

       this.$el.find('.submit').toggleClass('disabled', $target.val().length == 0);
    },

    tabPressed: function(e) {
        var $target = $(e.target); //not currentTarget b/c mousetrap

        if ($target.is('select:last')) {
            this.addRule();
            this.$el.find('.rule-type:last select').focus();
            e.preventDefault();
        }
    },

    _initTypeahead: function($row) {
        var values = this._getValuesFromRow($row),
            elements = this._getElementsFromRow($row),
            self = this,
            opts;

        if (values.type == ruleTypes.USER_FOLLOW) {
            var template, source;

            if (values.connectorId == 'lc') {
                template = personTmpl;
                source = this.peopleSearch;
            } else {
                template = twitterPersonTmpl;
                source = this.twitterSearch;
            }

            opts = {
                displayKey: function (suggestion) {
                    return suggestion.displayName;
                },
                source: source.ttAdapter(),
                templates: {
                    suggestion: template
                }
            };
        } else {
            opts = {
                displayKey: 'value',
                templates: {
                    suggestion: typeaheadResultTmpl
                },
                source: function(q, cb) {
                    return self._typeaheadMatcher(q, elements.connectorId, cb, values.type);
                }
            };
        }

        elements.text.typeahead('destroy'); //don't chain
        elements.text.typeahead({
            name: 'filter-entities',
            highlight: true,
            minLength: 3
        }, opts);
    },

    _typeaheadMatcher: function(q, $connectorInput, cb, type) {
        var matches = [],
            regex = new RegExp(q, 'i'),
            connectorId = $connectorInput.val();

        var dispatch = {};
        dispatch[ruleTypes.KEYWORD] = this.keywords;
        dispatch[ruleTypes.CASHTAG] = this.cashtags;

        var rules = dispatch[type];

        _.each(rules, function(rule) {
            var split = rule.split(':'),
                val = split[0];

            if (regex.test(val) && split[1] == connectorId) {
                matches.push({ id: val, value: val.substr(1) });
            }
        });

        cb(matches);
    },

    didSelectAutocompleteValue: function(e, suggestion) {
        var $target = $(e.currentTarget),
            $row = $target.parents('li'),
            elements = this._getElementsFromRow($row),
            id = suggestion.userId || suggestion.id;

        elements.id.val(id);
        if(suggestion && suggestion.person) {
            elements.id.attr('data-screenname', suggestion.person.screenName);
        }
    },

    addRule: function() {
        var uuid = _.uniqueId('filter_');
        var rule = filterRuleTmpl({
            definitionType: 'HASHTAG',
            editable: true,
            connectors: this.settings.connectors,
            uuid: uuid
        });

        var rules = this.$el.find('ul');
        var previousLi = rules.find('li:last');

        rules.append(rule);

        var lastLi = rules.find('li:last');

        lastLi.find('[name=definitionType]').val(previousLi.find('[name=definitionType]').val());
        lastLi.find('[name=connectorId]').val(previousLi.find('[name=connectorId]').val());

        this._initTypeahead(lastLi);
        this.toggleRuleTypePrefix(lastLi.find('select:first'));
        this.$el.find('#'+uuid).focus();
    },

    removeRule: function(evt) {
        var $row = $(evt.currentTarget).parents('li');

        $row.slideUp(200, function() {
            $row.remove();
        });
    },

    save: function() {
        var name = this.$el.find('#filter-name').val(),
            operator = this.$el.find('#filter-operator').val(),
            rules = this._serializeRows(),
            isValid = true,
            self = this;

        this.$el.find('small.error').remove();

        if (_.isEmpty(name)) {
            this.showErrorMessage(errors.COMMON.BASE_FILTER.EDIT.FILTER_NAME, 5000);
            return;
        }

        var payload = {
            ruleGroup: {
                rules: [],
                operator: operator,
                type: 'GROUP'
            },
            userId: self.userName,
            name: name,
            filterType: 'FILTER'
        };

        if (!this.createNew) {
            payload._id = this.streamId;
        }

        _.each(rules, function(rule) {
            var text = rule.text || '',
                id = rule.id || '';

            if (_.isEmpty(rule.type) || _.isEmpty(text) || _.isEmpty(rule.connectorId)) {
                isValid = false;

                return;
            }

            if ((rule.type == ruleTypes.KEYWORD && !HashtagValidator.test(text))
                || (rule.type == ruleTypes.CASHTAG && !(CashtagValidator.test(text) && isNaN(text)))){
                isValid = false;
                return;
            }
            //reset regexp index
            HashtagValidator.lastIndex = 0;
            CashtagValidator.lastIndex = 0;

            if (rule.type == ruleTypes.USER_FOLLOW && _.isEmpty(id)) {
                isValid = false;

                return;
            }

            var out = {};
            out.type = 'DEFINITION';

            _.extend(out, _.omit(rule, 'type'));

            var checkKey;

            if (rule.type == ruleTypes.CASHTAG) {
                out.definitionType = ruleTypes.KEYWORD;
            } else {
                out.definitionType = rule.type;
            }

            if (out.definitionType == ruleTypes.KEYWORD) {
                out.text = prefixMap[rule.type] + out.text;
                out.id = out.text.toLowerCase();
                checkKey = out.id + ':' + out.connectorId;
            } else {
                checkKey = out.id;
            }

            checkKey = checkKey.toLowerCase();

            if (!_.contains(self.existingKeywordsFollowers, checkKey)) {
                self._pendingRules.push(out);
            }

            payload.ruleGroup.rules.push(out);
        });

        if (!isValid || _.isEmpty(payload.ruleGroup.rules)) {
            this.showErrorMessage(errors.COMMON.BASE_FILTER.EDIT.SAVE_ERROR, 5000);

            return;
        }
        //add non-existing keywords or followers first to Keywords/Following filter, then save the rules for this filter
//        self._saveKeywordsAndFollowers().then(function() {
//
//        }, function() {
//            self.showErrorMessage(errors.COMMON.BASE_FILTER.EDIT.SAVE_KEYWORDS, 7000);
//        });
//      TODO: check whether rules changed, if not, don't send out any request just close the setting
        self._saveSettings(payload).then(function(message) {
            self._updateDatastore(message);
            self.eventBus.trigger('settings:saved', message);
            self.close();
        }, function(message) {
            message = message || errors.COMMON.BASE_FILTER.EDIT.SAVE_SETTINGS;
            self._pendingRules = [];
            self.showErrorMessage(message, 7000);
        });
    },

    _updateDatastore: function(rsp) {
        var keywords, following;
        var setting = _.find(this.filterData, function(item) {
            if(item.filterType == 'KEYWORD'){
                keywords = item;
            }else if(item.filterType == 'FOLLOWING'){
                following = item;
            }
            return item._id === rsp._id;
        });

        if (setting) {
            setting.name = rsp.name;
            setting.ruleGroup = rsp.ruleGroup;
        } else {
            this.filterData.push(rsp);
        }

        //_pendingRules format: [ { connectorId: "lc", definitionType: "KEYWORD",id: "$money",text: "$money",type: "DEFINITION"} ]
        if (!_.isEmpty(this._pendingRules)){
            var followingAdded = false, keywordAdded = false;
            //insert pendingRules to datastore or let datastore fetch from server, backend will automatically add non-existing rules to following/keywords
            _.each(this._pendingRules, function(rule, idx){
                if(rule.definitionType == "USER_FOLLOW"){
                    followingAdded = true;
                    following.ruleGroup.rules.push(rule);
                }else{
                    //add to keyword
                    keywordAdded = true;
                    keywords.ruleGroup.rules.push(rule);
                }
            });
            if(followingAdded){
                //broadcast the following change, datastore will update itself upon receiving the event
                this.sandbox.publish('following:change', null, following);
            }
//
//            if(keywordAdded){
//                //broadcast the following change, datastore will update itself upon receiving the event
//                this.sandbox.publish('keywords:change', null, keywords);
//            }
            this._pendingRules = [];
        }

        this.sandbox.setData('app.account.filters', this.filterData);
    },

    destroy: function() {
        this.keywords = [];
        this.following = [];
        this.settings = {};
        this.$el.find('.rule-text').typeahead('destroy');

        this.remove();
    },

    close: function() {
        this.sandbox.publish('modal:hide');
    },

    ruleTypeDidChange: function(evt) {
        var $row = $(evt.currentTarget).closest('li');

        this._initTypeahead($row);

        var elements = this._getElementsFromRow($row),
            values = this._getValuesFromRow($row);

        if ((elements.connectorId[0] == evt.currentTarget || elements.type[0] == evt.currentTarget)
            && values.type == ruleTypes.USER_FOLLOW) {
            elements.id.val('');
            elements.text.typeahead('val', '');
        }
    },

    toggleRuleTypePrefix: function(evt) {
        var $target = $(evt.currentTarget || evt[0]),
            $wrap = $target.closest('.select-wrap');

        $wrap.removeClass(_.keys(ruleTypes).join(' ').toLowerCase()).addClass($target.val().toLowerCase());
    },
    
    parseExistingKeywordsFollowers: function() {
        var keywords = _.find(this.filterData, function(res) { return res.filterType == 'KEYWORD' }),
            following = _.find(this.filterData, function(res) { return res.filterType == 'FOLLOWING' });

        if (keywords) {
            var keywordObjs = _.filter(keywords.ruleGroup.rules, function(rule) { return rule.text[0] == '#' }),
                cashtagObjs = _.filter(keywords.ruleGroup.rules, function(rule) { return rule.text[0] == '$' });

            this.keywords = _.map(keywordObjs, function(rule) { return rule.id.toLowerCase() + ':' + rule.connectorId });
            this.cashtags = _.map(cashtagObjs, function(rule) { return rule.id.toLowerCase() + ':' + rule.connectorId });
        }

        if (following) {
            this.following = _.pluck(following.ruleGroup.rules, 'id');
        }

        this.existingKeywordsFollowers = this.keywords.concat(this.cashtags, this.following);
    },

    _saveSettings: function(payload) {
        var deferred = Q.defer(),
            command;

        if(this.createNew){
            command = {
                id: "CREATE_FILTER",
                payload: payload
            };
        }else{
            command = {
                id: "UPDATE_FILTER",
                payload: payload,
                urlExtension: encodeURIComponent(payload._id)
            };
        }

        this.sandbox.send(command).then(function(rsp) {
            deferred.resolve(rsp);
        }, function(rsp) {
            var message = null;

            if (rsp && rsp.responseJSON && rsp.responseJSON.message) {
                message = rsp.responseJSON.message;
            }

            deferred.reject(message);
        });

        return deferred.promise;
    },

    _getElementsFromRow: function($row) {
        var cacheKey = $row.data('_ruleCacheKey'),
            ret = this._rulesCache[cacheKey];

        if (!cacheKey || !ret) {
            if (!cacheKey) {
                cacheKey = _.uniqueId('rule');
                $row.data('_ruleCacheKey', cacheKey);
            }

            ret = {
                type: $row.find('select:first'),
                text: $row.find('input.rule-text'),
                id: $row.find('input.rule-id'),
                connectorId: $row.find('select:last')
            };

            this._rulesCache[cacheKey] = ret;
        }

        return ret;
    },

    _getValuesFromRow: function($row) {
        var elements = this._getElementsFromRow($row),
            ret = {};

        _.each(elements, function(value, key) {
            ret[key] = value.val().trim();
        });

        if(ret.type == ruleTypes.USER_FOLLOW){
            var screenName = elements.id.attr('data-screenname');
            if(screenName)
                ret.text = screenName;
        }
        return ret;
    },

    _serializeRows: function() {
        var $rows = this.$el.find('li'),
            self = this,
            ret = [];

        $rows.each(function() {
            ret.push(self._getValuesFromRow($(this)));
        });

        return ret;
    }
});

_.extend(module.exports.prototype, showErrorMessage);
