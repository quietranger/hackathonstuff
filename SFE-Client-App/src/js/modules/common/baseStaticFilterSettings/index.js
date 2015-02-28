var Backbone = require('backbone');
var Symphony = require('symphony-core');
var Handlebars = require('hbsfy/runtime');
var errors = require('../../../config/errors');
var config = require('../../../config/config');

require('typeahead.js');

var editTmpl = require('./templates/edit.handlebars');
var entityTmpl = require('./templates/entity.handlebars');

var showErrorMessage = require('../../common/mixins/showErrorMessage');
var twitterResultTmpl = require('../templates/twitter-person-result.handlebars');
var personResultTmpl = require('../templates/person-result.handlebars');

Handlebars.registerPartial('entity', entityTmpl);

Handlebars.registerHelper('userPrefix', function(text) {
    var tag = text[0], ret = '';

    if (tag !== '#' && tag !== '$') {
        ret = '@';
    }

    return ret;
});

module.exports = Backbone.View.extend({
    className: 'filter-settings keyword-settings people-search module',

    ruleTypes: {
        KEYWORDS: 'keywords',
        FOLLOWING: 'following'
    },

    events: {
        'click a.close': 'close',
        'click a.add': 'addEntity',
        'click span.delete': 'deleteEntity',
        'change #connector-id': 'connectorIdDidChange',
        'keyup input': 'fieldDidInput'
    },

    initialize: function(opts) {
        this.opts = opts || {};
        this.sandbox = opts.sandbox;
        this.eventBus = opts.eventBus;
        this.streamId = opts.streamId;
        this.ruleType = opts.ruleType || this.ruleTypes.KEYWORDS;
        this.changed = false;
        this.settings = {
            editable: true,
            entities: [],
            isKeywords: this.ruleType === this.ruleTypes.KEYWORDS,
            connectors: [
                {
                    id: 'lc',
                    name: 'Symphony'
                }
            ]
        };
        this.connectorId = 'lc';
        this.typeahead = null;

        this.twitterSearch = new Bloodhound({
            datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            limit: 3,
            remote: {
                url: Symphony.Config.API_ENDPOINT + '/external_user_search?term=%QUERY&connector_id=tw&limit=10&is_partial=true&_=' + (new Date()).getTime(),
                filter: function (parsedResponse) {
                    if (parsedResponse.users) {
                        return parsedResponse.users;
                    } else{
                        return [];
                    }
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
                    if (parsedResponse.queryResults) {
                        return parsedResponse.queryResults[0].users;
                    } else{
                        return [];
                    }
                }
            }
        });

        this.twitterSearch.initialize();
        this.peopleSearch.initialize();

        var self = this;

        this.sandbox.getData('app.account').then(function(rsp) {
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

            var results = rsp.filters,
                entities;

            if (self.ruleType === self.ruleTypes.KEYWORDS) {
                entities = _.find(results, function(res) { return res.filterType === 'KEYWORD'; });
            } else {
                entities = _.find(results, function(res) { return res.filterType === 'FOLLOWING'; });
            }

            if (entities) {
                self.filter =
                self.settings.entities = entities.ruleGroup.rules;

                // separate them into twitter and livecurrent entities
                self.settings.lcEntities = [];
                self.settings.twEntities = [];

                for (var i = 0, length = entities.ruleGroup.rules.length; i < length; i++) {
                    var rule = entities.ruleGroup.rules[i];
                    if (rule.connectorId === "lc") {
                        self.settings.lcEntities.push(rule);
                    } else if (rule.connectorId === "tw") {
                        self.settings.twEntities.push(rule);
                    }
                }
            }

            self.render();
        });
    },

    fieldDidInput: function(e) {
        var $target = $(e.currentTarget);

        if ($target.is('#entity-input') && e.keyCode === 13) {
            this.addEntity();
        }
    },

    render: function() {
        this.$el.html(editTmpl(this.settings));
        this.connectorIdDidChange();
        return this;
    },
    postRender: function(){
        //Since the blur event fires before the actual loss of focus, we have to push it down the stack
        var self = this;
        setTimeout(function(){
            self.$el.find('#entity-input').focus();
        }, 0);
    },
    connectorIdDidChange: function() {
        if (this.ruleType === this.ruleTypes.KEYWORDS) {
            return;
        }

        var $entityId = this.$el.find('#entity-id');

        if (this.typeahead) {
            this.typeahead.off().typeahead('destroy');
            $entityId.val('');
        }

        var value = this.$el.find('#connector-id').val(),
            template = value === 'lc' ? personResultTmpl : twitterResultTmpl,
            self = this;

        var map = {
            tw: this.twitterSearch,
            lc: this.peopleSearch
        }, source = map[value];

        if (!source) {
            return;
        }

        this.typeahead = this.$el.find('#entity-input').typeahead({
            minLength: 3,
            highlight: true,
            autoselect: true
        }, {
            name: 'static-filter-typeahead',
            source: source.ttAdapter(),
            templates: {
                suggestion: template
            },
            displayKey: function(suggestion) {
                if (value === 'tw') {
                    return suggestion.screenName;
                } else {
                    return suggestion.person.screenName;
                }
            }
        });

        if (this.ruleType === this.ruleTypes.FOLLOWING) {
            this.typeahead.on('typeahead:selected typeahead:autocompleted', function(jq, suggestion) {
                //set id in the hidden DOM
                var val = suggestion.person ? suggestion.person.id : suggestion.id;
                $entityId.val(val);
            }).on('typeahead:opened', function() {
                self.typeahead.typeahead('val', '');
                self.clearEntityId();
            });
        }
    },

    clearEntityId: function() {
        this.$el.find('#entity-id').val('');
    },

    addEntity: function() {
        var $entity = this.$el.find('#entity-input'),
            connectorId = this.$el.find('#connector-id').val(),
            entityText = $entity.val();

        if (entityText === '') {
            this.showErrorMessage(errors.COMMON.BASE_STATIC_FILTER.ADD_ENTITY.BLANK, 5000);
            $entity.addClass('error');
            return;
        }

        var entityId;
        var entities = [], requestPromise = null;

        if (this.ruleType === this.ruleTypes.KEYWORDS) {
            //if it's Keywords filter
            var prefix = this.$el.find('#entity-prefix').val(),
                validator = prefix === '#' ? config.HASHTAG_REGEX : config.CASHTAG_REGEX;

            validator = new RegExp('^' + validator.source + '$', 'ig');

            if (!entityText.match(validator)) {
                this.showErrorMessage(errors.COMMON.BASE_STATIC_FILTER.ADD_ENTITY.INVALID, 5000);
                $entity.addClass('error');

                return;
            }

            var connectorIds = [], prefixes = [];
            if(connectorId !== 'all'){
                connectorIds.push(connectorId);
            }else{
                connectorIds = _.pluck(this.settings.connectors, 'id');
            }

            if(prefix === 'all'){
                prefixes = ['#', '$'];
            }else{
                prefixes.push(prefix);
            }

            for(var cidx in connectorIds){
                var cid = connectorIds[cidx];
                for(var pidx in prefixes){
                    entityId = prefixes[pidx] + entityText;
                    var existingEntity = _.find(this.settings.entities, function(item) {
                        return item.id === entityId && cid === item.connectorId;
                    });

                    if (existingEntity) {
                        var connectorName = _.find(this.settings.connectors, function(item){
                            return item.id === cid;
                        }).name;
                        this.showErrorMessage(entityId + ' already exists on ' + connectorName);
                        continue;
                    }else {
                        //for keyword: text === id
                        entities.push({
                            type: "DEFINITION",
                            definitionType: "KEYWORD",
                            id: entityId,
                            text: entityId,
                            connectorId: cid
                        });
                    }
                }
            }//end of for loop

            if(entities.length) {
                requestPromise = this.sandbox.send({
                    id: 'ADD_KEYWORDS',
                    payload: {
                        keyword: JSON.stringify(entities)
                    }
                });
            }
        } else { //if it's Following filter
            entityId = this.$el.find('#entity-id').val();

            if (_.isEmpty(entityId)) {
                this.showErrorMessage(errors.COMMON.BASE_STATIC_FILTER.ADD_ENTITY.USER_FROM_AUTOCOMPLETE, 5000);
                return;
            }

            var existingEntity = _.find(this.settings.entities, function(item) {
                return item.id === entityId && connectorId === item.connectorId;
            });

            if (existingEntity) {
                var connectorName = _.find(this.settings.connectors, function(item){
                    return item.id === connectorId;
                }).name;
                this.showErrorMessage('@' + entityText + ' already exists on ' + connectorName);
                return;
            }
            entities.push({
                type: "DEFINITION",
                definitionType: "USER_FOLLOW",
                id: entityId,
                text: entityText,
                connectorId: connectorId
            });

            requestPromise = this.sandbox.send({
                id: 'ADD_FOLLOWING',
                payload: entities
            });
        } //end of if ruleType === KEYWORD

        var self = this;

        if(!requestPromise) {
            return;
        }

        requestPromise.then(function(rsp) {
            self._updateDatastore(rsp);
            _.each(entities, function(context){
                var  markup = entityTmpl(context);

                self.settings.entities.push(context);

                var list = self.$el.find('ul.' + context.connectorId);

                if (list.length === 0) {
                    list = $('<ul></ul>').addClass(context.connectorId).addClass('well');
                    list.append(markup);
                    self.$el.find('h4.' + context.connectorId + ' + p.empty').remove();
                    self.$el.find('h4.' + context.connectorId).after(list);
                } else {
                    list.append(markup);
                }
            });

            var $entity = self.$el.find('#entity-input');
            $entity.val('');
            $entity.typeahead('val', '');
            self.changed = true;
        }, function() {
            self.showErrorMessage('Request failed. Please try again.');
        });
    },

    deleteEntity: function(evt) {
        var $target = $(evt.currentTarget),
            id = $target.parent().attr('data-id'),
            connectorId = $target.parent().attr('data-connector-id');

        var entityToDelete = _.find(this.settings.entities, function(item) {
            return item.id === id && item.connectorId === connectorId;
        });

        if (!entityToDelete) {
            return;
        }

        var self = this, query;

        if (this.ruleType === this.ruleTypes.KEYWORDS) {
            query = this.sandbox.send({
                id: 'DELETE_KEYWORDS',
                urlExtension: encodeURIComponent(connectorId)+'/'+encodeURIComponent(entityToDelete.id)
            });
        } else {
            query = this.sandbox.send({
                id: 'DELETE_FOLLOWING',
                urlExtension: encodeURIComponent(connectorId)+'/'+encodeURIComponent(entityToDelete.id)
            });
        }

        query.then(function(rsp) {
            self._updateDatastore(rsp);
            self.changed = true;

            var idx = _.indexOf(self.settings.entities, entityToDelete);

            self.settings.entities.splice(idx, 1);

            $target.parents('li').fadeOut('fast', function() {
                var $item = $(this), $list = $item.parents('ul');
                $item.remove();

                var subject = self.ruleType  === self.ruleTypes.KEYWORDS ? 'anything' : 'anyone';

                if ($list.children().length === 0) {
                    $list.replaceWith('<p class="empty">You aren\'t following ' + subject + '.</p>');
                }
            });
        }, function() {
            self.showErrorMessage(errors.COMMON.BASE_STATIC_FILTER.DELETE_ENTITY);
        });
    },

    _updateDatastore: function(rsp) {
        var self = this;

        if(rsp.filterType === 'FOLLOWING'){
            //broadcast the following change, datastore will update itself upon receiving the event
            this.sandbox.publish('following:change', null, rsp);
        }else {
            this.sandbox.getData('app.account').then(function (acc) {
                var filters = acc.filters;

                for (var i = 0; i < filters.length; i++) {
                    if (filters[i]._id === rsp._id) {
                        filters[i] = rsp;
                        break;
                    }
                }

                self.sandbox.setData('app.account.filters', filters);
            });
        }
    },

    destroy: function() {
        if (this.typeahead) {
            this.typeahead.typeahead('destroy');
        }

        this.remove();
    },

    close: function() {
        this.eventBus.trigger('settings:saved', this.changed);
        this.sandbox.publish('modal:hide');
    }
});

_.extend(module.exports.prototype, showErrorMessage);
