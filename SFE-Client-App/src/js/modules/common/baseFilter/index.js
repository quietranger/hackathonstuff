var Symphony = require('symphony-core');
var Q = require('q');

var filteredMessagesView = require('../filterSocialMessageList/index');

var settingsView = require('./views/settingsView');
var editView = require('./views/editView');
var deactivationPromptView = require('./views/deactivationPromptView');

var filterContainerTmpl = require('./templates/filter-container.handlebars');
var filterRulesTmpl = require('./templates/filter-rules.handlebars');
var menuTmpl = require('./templates/menu');

var config = require('../../../config/config');

module.exports = Symphony.Module.extend({
    className: 'filter-module module',

    moduleHeader: '<h2>Loading filter...</h2>',

    initialResults: {},
    initialTotalMessageCount: 0,

    messagesView: null,

    events: {
        'click .show-settings': 'showSettings',
        'click .edit-rules': 'showEdit',
        'click .show-deactivation-confirmation': 'showDeactivationPrompt',
        'click .social-connector': 'toggleSocialConnector',
        'click .edit-sources': 'toggleSocialConnectorDropdown',
        'click .header-toggle': 'toggleFilterHeader'
    },

    psEvents: {
        'following:change': 'onFollowingChange',
        'click': 'clickAny'
    },

    initialize: function(opts) {
        Symphony.Module.prototype.initialize.apply(this, arguments);

        var self = this;
        this.opts = opts;
        this.opts.socialConnectors = [];
        this.channels = [];
        this.mainModules = [];
        this.opts.tag = 'Filter';
        if (this.opts.module === 'organizational-leaders' || this.opts.module === 'my-department') {
            this.opts.tag = 'Channel';
        } else if (this.opts.module === 'following' || this.opts.module === 'keywords' || this.opts.module === 'mentions') {
            this.opts.tag = 'Main';
        }
        this.opts.showSourcesDropdown = true;
        this.opts.collapsed = false;
        this.opts.dropdownId = _.uniqueId(this.opts.module+'_');
        this.didRender = Q.defer();

        this.listenTo(this.eventBus, 'settings:saved', function(evt) {
            //empty messages in datastore to force fetch messages from server
            self.sandbox.setData('messages.' + self.streamId, [], false)
                .done(function (rsp) {
                    self.messagesView.loadInitialMessages();
                    if(evt && evt.name) {
                        self.changeName(evt.name);
                        self.sandbox.publish('filter:update', null, {threadId: self.streamId, name: evt.name});
                    }
                    if (self.opts.module !== 'mentions') {
                        self.sandbox.getData('app.account').then(function(rsp) {
                            var filter = _.find(rsp.filters, function (item) {
                                return item._id == self.streamId;
                            });
                            self.opts.filterRules = filter.ruleGroup.rules;
                            self.renderFilterRules(self.opts.filterRules);
                        });
                    }

                }, function () {
                    //error handling
                    self.sandbox.error('Error when modify filter:', 'Can not empty message list in dataStore!');
                });

        });

        this.listenTo(this.eventBus, 'filter:deactivated', function () {
            self.sandbox.publish('view:close', null, self.viewId);
            self.sandbox.publish('view:removed', null, self.streamId);
        });

        var renderPromise = Q.all([this.sandbox.isRunningInClientApp(), this.accountDataPromise ]),
            oldRender = this.render.bind(this);

        renderPromise.spread(function(isRunningInClientApp, rsp) {
            self.isRunningInClientApp = isRunningInClientApp;

            self.didGetAccountData(rsp);
        });

        this.render = function() {
            renderPromise.then(function() {
                oldRender();
            });
            
            return Symphony.Module.prototype.render.apply(this, arguments);
        };

        this.sandbox.getData('documents.' + config.FILTER_ID + '.filtersHeaderState').then(function(rsp) {
            _.forEach(rsp, function(v) {
                if (v.streamId === self.streamId) {
                    self.opts.collapsed = v.collapsed;
                }
            });
        });
    },

    onFollowingChange: function(ctx, rsp){
        //if current filter contains any following rule that doesn't exist in the new following rules
        var self = this;
        var curRuleIds = _.pluck(_.filter(self.opts.filterRules, function(rule){
            return rule.definitionType == 'USER_FOLLOW';
        }), 'id');
        if(!curRuleIds.length) {
            //if this filter doesn't contain any user_follow rules, no need to check
            return;
        }
        var availableIds = _.pluck(rsp.ruleGroup.rules, 'id');
        var invalidIds = _.difference(curRuleIds, availableIds);
        if((this.module == 'following' && curRuleIds.length != availableIds.length) || invalidIds.length){
            this.eventBus.trigger('settings:saved', true);
        }
    },

    didGetAccountData: function(rsp) {
        var self = this;

        _.extend(self.opts, {account: rsp});

        self.canCall = self.isRunningInClientApp && rsp.entitlement.callEnabled;

        self.streamMap = {}; //rooms map {streamId: stream} for quick lookup in messageResult see whether the user have local stream to open
        _.each(rsp.roomParticipations, function(room) {
            var obj = {
                threadId: room.threadId,
                name: room.name
            };
            self.streamMap[room.threadId] = obj;
        });

        _.each(rsp.filters, function(v, k) {
            if (v.filterType === 'FOLLOWING' || v.filterType === 'KEYWORD' || v.filterType === 'MENTIONS') {
                self.mainModules.push(v);
            } else if (v.filterType === 'DEPT_FOLLOWING' || v.filterType === 'LEADERSHIP_FOLLOWING') {
                self.channels.push(v);
            }
        });

        var filter;

        if (self.streamId) {
            filter = _.find(rsp.filters, function (item) {
                return item._id === self.streamId;
            });

            self.opts.name = filter.name;
            self.opts.isNormalFilter = filter.filterType === 'FILTER';
            self.opts.editable = filter.editable;
            self.opts.filterRules = filter.ruleGroup.rules;

            self.moduleHeader = '<h2><span class="name">' + self.opts.name + '</span></h2><div class="tag filter">' +
                self.opts.tag + '</div></h2>';

            if (self.opts.showEditButton === undefined || filter.filterType === 'DEPT_FOLLOWING' || filter.filterType == 'LEADERSHIP_FOLLOWING') {
                self.opts.showEditButton = self.opts.editable;
            }

            self.moduleMenu = menuTmpl({
                isNormalFilter: self.opts.isNormalFilter,
                showEditButton: self.opts.showEditButton
            });

            if (filter.filterType === 'MENTIONS') {
                self.opts.showSourcesDropdown = false;
            }
        }

        // a little hack to add lc tag to the socialConnectors object since
        // socialConnectors does not contain LC
        var _socialConnectors = _.extend([], rsp.socialConnectors);
        _socialConnectors.push('lc');

        if (_socialConnectors) {
            if (filter && filter.filterType !== 'LEADERSHIP_FOLLOWING' &&
                filter.filterType !== 'DEPT_FOLLOWING' && filter.filterType !== 'MENTIONS')  {
                var connectorActive;
                _.each(_socialConnectors, function(con) {
                    // don't add twitter or any ther social connectors to My Department,  My Leadership and Mentions for now
                    switch (con) {
                        case 'lc':
                            connectorActive = rsp.config.viewSettings[self.streamId] ? rsp.config.viewSettings[self.streamId].hideLcMsg : false;
                            break;
                        case 'tw':
                            connectorActive = rsp.config.viewSettings[self.streamId] ? rsp.config.viewSettings[self.streamId].hideTwMsg : false;
                            break;
                    }

                    self.opts.socialConnectors.push({
                        id: con,
                        active: !connectorActive
                    });
                });
            } else if (this.module === 'hashtag-context') {
                self.opts.socialConnectors.push({
                    id: 'lc',
                    active: true
                });
                _.each(rsp.socialConnectors, function(v, k) {
                    self.opts.socialConnectors.push({
                        id: v,
                        active: true
                    });
                });

            } else {
                // Add lc to My Department/My Leadership/Mentions
                self.opts.socialConnectors.push({
                    id: 'lc',
                    active: true
                });
            }
            self.activeConnectorIds = _.pluck(self.opts.socialConnectors, 'id');
        }
    },

    render: function(accountData) {
        this.$content.html(filterContainerTmpl(this.opts));

        this.currentUserId = accountData.userName;
        this.messagesView = new filteredMessagesView({
            streamId: this.streamId,
            type: 'social-filter',
            sandbox: this.sandbox,
            eventBus: this.eventBus,
            currentUserId: accountData.userName,
            canCall: this.canCall,
            currentUserProfileId: accountData.myCurrentThreadId,
            socialConnectors: this.opts.socialConnectors,
            streamMap: this.streamMap,
            parentViewId: this.viewId
        });

        this.messagesView.render();

        this.$content.find('.container').html(this.messagesView.$el);

        if (this.opts.module === 'organizational-leaders' || this.opts.module === 'my-department') {
            this.renderFilterRules(this.opts.filterRules);
        } else if (this.opts.module !== 'mentions') {
            this.renderFilterRules(this.opts.filterRules);
        }

        this.didRender.resolve();

        return Symphony.Module.prototype.render.apply(this, arguments);
    },

    renderFilterRules: function(filterRules) {
        var _filterRules = _.first(filterRules, 10);
        this.$el.find('.module-content .filter-rules').html(filterRulesTmpl({filterRules: _filterRules}));
    },

    clickAny: function(ctx, e) {
        var $elem = $(e.target);

        if($elem.closest('.edit-sources').length === 0 && $elem.closest('.sources-dropdown').length === 0) {
            if(!this.$el.find('.sources-dropdown').hasClass('hidden')) {
                this.toggleSocialConnectorDropdown();
            }
        }
    },

    toggleSocialConnector: function(e) {
        var $target = $(e.currentTarget),
            id = $target.attr('data-connector-id');

        var actives = _.filter(this.opts.socialConnectors, function(con) {
            return con.active;
        });

        if (actives.length == 1 && actives[0].id == id && actives[0].active === true) {
            e.preventDefault();
            e.stopPropagation();
            return; // don't allow people to deactivate all
        }

        var connector = _.find(this.opts.socialConnectors, function(con) {
            return con.id == id;
        });

        connector.active = !connector.active;

        if (connector.active) {
            this.activeConnectorIds.push(connector.id);
        } else {
            this.activeConnectorIds = _.without(this.activeConnectorIds, connector.id);
        }

        $target.toggleClass('active');

        this.eventBus.trigger('connector:toggled');

        var self = this;
        this.sandbox.getData('app.account.config').then(function(rsp) {
            var viewSettings = _.extend({}, rsp.viewSettings);
            var lcActive = _.find(self.activeConnectorIds, function(connector) { return connector === 'lc'; });
            var twActive = _.find(self.activeConnectorIds, function(connector) { return connector === 'tw'; });
            viewSettings[self.streamId] = {
                hideLcMsg: lcActive ? false : true,
                hideTwMsg: twActive ? false : true
            };
            self.sandbox.setData('app.account.config.viewSettings', viewSettings).then(function(data) {
                console.log(data);
            });

            var sourcesCount = self.$el.find('ul.options li.edit-sources span.sources');
            if (lcActive && twActive) {
                sourcesCount.text('All');
            } else if (lcActive) {
                sourcesCount.text('Symphony');
            } else if (twActive) {
                sourcesCount.text('Twitter');
            }
        });
    },

    postRender: function(){
        var self = this;

        this.didRender.promise.then(function(){
            self.messagesView.postRender();

            self.sandbox.publish('view:focus:requested', null, {
                viewId: self.viewId
            });
        });

        return Symphony.Module.prototype.postRender.apply(this, arguments);
    },

    showSettings: function() {
        var contentView = new settingsView({
            eventBus: this.eventBus,
            sandbox: this.sandbox,
            streamId: this.streamId,
            editable: this.opts.editable,
            isRunningInClientApp: this.isRunningInClientApp
        });

        this.sandbox.publish('modal:show', null, {
            title: 'Filter Settings',
            contentView: contentView
        });
    },

    showEdit: function() {
        console.log(this);
        var contentView = new editView({
            eventBus: this.eventBus,
            sandbox: this.sandbox,
            streamId: this.streamId,
            editable: this.opts.editable
        });

        this.sandbox.publish('modal:show', null, {
            title: 'Edit Filter',
            contentView: contentView,
            isFlat: true
        });
    },

    showDeactivationPrompt: function() {
        var contentView = new deactivationPromptView({
            eventBus: this.eventBus,
            sandbox: this.sandbox,
            filterId: this.streamId
        });

        this.sandbox.publish('modal:show', null, {
            title: 'Delete Filter',
            contentView: contentView,
            isFlat: true
        });
    },

    changeName: function(name) {
        this.$el.find('header h2 span.name').text(name);
    },

    toggleSocialConnectorDropdown: function(e) {
        var sourcesDropdown = this.$el.find('.sources-dropdown');
        if (sourcesDropdown.hasClass('hidden')) {
            sourcesDropdown.removeClass('hidden');
        } else {
            sourcesDropdown.addClass('hidden');
        }
    },

    toggleFilterHeader: function(e) {
        var self = this;
        var filtersHeaderState = [];
        this.opts.collapsed = !this.opts.collapsed;

        if (this.opts.collapsed === true) {
            this.$el.find('.filter-rules').addClass('collapsed')
            this.$el.find('.options').addClass('collapsed')
            this.$el.find('.module-content .container').addClass('collapsed')
            this.$el.find('.header-toggle').addClass('collapsed');
        } else {
            this.$el.find('.filter-rules').removeClass('collapsed')
            this.$el.find('.options').removeClass('collapsed')
            this.$el.find('.module-content .container').removeClass('collapsed')
            this.$el.find('.header-toggle').removeClass('collapsed');
        }
        this.sandbox.getData('documents.' + config.FILTER_ID + '.filtersHeaderState').then(function(rsp) {
            var filterHeaderStateExist = false;
            _.extend(filtersHeaderState, rsp);
            for (var i=0; i<filtersHeaderState.length; i++) {
                if (filtersHeaderState[i].streamId === self.streamId) {
                    filtersHeaderState[i].collapsed = self.opts.collapsed;
                    filterHeaderStateExist = true;
                    break;
                }
            }

            if (!filterHeaderStateExist) {
                var data = {
                    streamId : self.streamId,
                    collapsed: self.opts.collapsed
                };
                filtersHeaderState.push(data);
            }

            self.sandbox.setData('documents.' + config.FILTER_ID + '.filtersHeaderState', filtersHeaderState).then(function(rsp) {
                console.log(rsp);
            });
        });
    },

    destroy: function() {
        if(this.messagesView) {
            this.messagesView.destroy();
            this.messagesView = null;
        }

        Symphony.Module.prototype.destroy.apply(this, arguments);
    }
});
