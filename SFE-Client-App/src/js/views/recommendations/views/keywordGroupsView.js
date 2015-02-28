var Q = require('q');
var Symphony = require('symphony-core');
var Spinner = require('spin');

var KeywordGroupsCollection = require('../collections/keywordGroups');
var KeywordGroupView = require('./items/keywordGroups/keywordGroupView');
var ChildViewDestructor = require('../mixins/childViewDestructor');
var FilterBuilder = require('../../../utils/filterBuilder');

var template = require('../templates/views/keyword-groups');

module.exports = Symphony.View.extend({
    className: 'keyword-groups',

    initialize: function() {
        Symphony.View.prototype.initialize.apply(this, arguments);

        this.childViews = [];
        this.socialConnectors = [ 'lc' ];
        this.createdFilters = {};

        this.keywordGroupsCollection = new KeywordGroupsCollection();

        this.listenTo(this.keywordGroupsCollection, 'reset', this.render.bind(this));
        this.listenTo(this.keywordGroupsCollection, 'change:selected', this.filterToggled.bind(this));

        this.spinner = new Spinner({
            color: '#fff'
        });

        var self = this;

        var keywordGroupPromise = this.sandbox.send({
            id: 'GET_KEYWORD_GROUP_RECOMMENDATIONS'
        });

        Q.all([ this.accountDataPromise, keywordGroupPromise ]).spread(function(accountData, keywordGroups) {
            self.userId = accountData.userName;

            var connectors = accountData.socialConnectors;

            if (connectors && connectors.length > 0) {
                self.socialConnectors = self.socialConnectors.concat(accountData.socialConnectors);
            }

            self.didGetKeywordGroupRecommendations.call(self, keywordGroups);
        }).fail(function() {
            self.eventBus.trigger('screen:advance');
        });
    },

    render: function() {
        var hasKGs = !this.keywordGroupsCollection.isEmpty();

        this.$el.html(template({
            hasKeywordGroups: hasKGs
        }));

        if (hasKGs) {
            this._renderKeywordGroups();
        } else {
            this.spinner.spin(this.$el.find('.spinner')[0]);
        }

        return Symphony.View.prototype.render.apply(this, arguments);
    },

    didGetKeywordGroupRecommendations: function(rsp) {
        if (_.isArray(rsp.data) && rsp.data.length > 0) {
            this.keywordGroupsCollection.reset(rsp.data);
        } else {
            this.eventBus.trigger('screen:advance');
        }
    },

    filterToggled: function(model) {
        var name = model.get('name'),
            createdFilter = this.createdFilters[name],
            keywords = model.get('keywords');

        if (createdFilter) {
            model.set('id', createdFilter.id);

            if (model.get('selected')) {
                keywords = keywords.concat(createdFilter.keywords);
            } else {
                keywords = _.difference(createdFilter.keywords, keywords);
            }
        }

        if (keywords.length > 0) {
            this._updateFilter(model, keywords);
        } else {
            this._deleteFilter(model);
        }
    },

    _updateFilter: function(model, keywords) {
        var id = model.get('id'),
            name = model.get('name'),
            self = this;

        var opts = {
            sandbox: this.sandbox,
            userId: this.userId,
            operator: 'ANY',
            name: name
        };

        if (id) {
            opts.id = id;
        }

        var filterBuilder = new FilterBuilder(opts);

        for (var i = 0; i < keywords.length; i++) {
            var keyword = keywords[i];

            for (var j = 0; j < this.socialConnectors.length; j++) {
                filterBuilder.addRule({
                    text: keyword,
                    id: keyword,
                    connectorId: this.socialConnectors[j]
                });
            }
        }

        filterBuilder.save().then(function(rsp) {
            self.createdFilters[name] = {
                id: rsp._id,
                keywords: _.pluck(rsp.ruleGroup.rules, 'id')
            };
        }, function() {
            model.set('hasError', true);
        });
    },

    _deleteFilter: function(model) {
        var self = this;

        var filterBuilder = new FilterBuilder({
            id: model.get('id'),
            sandbox: this.sandbox
        });

        filterBuilder.delete().then(function(rsp) {
            delete self.createdFilters[rsp.name];
            model.set('id', null);
            self.sandbox.publish('view:removed', null, rsp._id);
        }, function() {
            model.set('hasError', true);
        });
    },

    _renderKeywordGroups: function() {
        var self = this,
            ul = document.createElement('ul');

        for (var i = 0; i < this.keywordGroupsCollection.length; i++) {
            var keywordGroup = this.keywordGroupsCollection.at(i);

            var view = new KeywordGroupView({
                sandbox: self.sandbox,
                eventBus: self.eventBus,
                userId: self.userId,
                model: keywordGroup
            });

            self.childViews.push(view);
            ul.appendChild(view.render().postRender().el);
        }

        this.$el.find('header').after(ul);
    }
});

_.extend(module.exports.prototype, ChildViewDestructor);
