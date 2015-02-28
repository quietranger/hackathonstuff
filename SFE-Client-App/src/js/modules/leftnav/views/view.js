var Backbone = require('backbone');
var Q = require('q');
var config = require('../../../config/config');
var leftNavTmpl = require('../templates/leftnav.handlebars'),
    navItemTmpl = require('../templates/navItem.handlebars'),
    navItemCollectionTmpl = require('../templates/navItemCollection.handlebars'),
    imToNavTmpl = require('../templates/imToNav.handlebars'),
    filterToNavTmpl = require('../templates/filterToNav.handlebars'),
    goIm = require('../../common/goIm/goIm'),
    goRoom = require('../../common/goRoom/goRoom'),
    goFilter = require('../../common/goFilter/goFilter'),
    Utils = require('../../../utils')
require('groupablelist');
require('../../common/helpers/index');
var Handlebars = require("hbsfy/runtime");

Handlebars.registerPartial('navItem', navItemTmpl);
Handlebars.registerPartial('navItemCollection', navItemCollectionTmpl);

var mixinDefaults = require('../../common/mixins/moduleDefaults');

Handlebars.registerHelper('icon', function (name) {
    var ret = '';

    if (name === 'Following') {
        ret += 'following';
    }
    else if (name === 'Keywords') {
        ret += 'keywords';
    }
    else if (name === 'Mentions') {
        ret += 'mentions';
    }
    else if (name === 'My Profile') {
        ret += 'profile';
    }

    if (!_.isEmpty(ret)) {
        ret += ' icon';
    }

    return ret;
});

module.exports = Backbone.View.extend({
    el: '#nav',
    className: 'left-nav',

    events: {
        'click .navlink': 'onClickNavLink',
        'click .create-btn': 'showGo',
        'click .add-im-shortcut': 'showGoIm',
        'click .add-room-shortcut': 'showGoRoom',
        'click .add-filter-shortcut': 'showGoFilter',
        'click .nav-close-im': 'closeIm',
        'mousedown #simple_nav': 'initResize',
        'click .nav_expander': 'resetNavSize',
        'click .nav-header': 'collapseCategory',
        'mousedown .nav-header' : 'sectionMouseDown'
        /*'click .show-hello-world': 'showHelloWorld'*/
    },

    initialize: function (opts) {
        var self = this,
            q = Q.defer();

        var psEvents = {
            'view:created': this.onCreate.bind(this),
            'view:removed': this.onRemove.bind(this),
            'room:update': this.onUpdate.bind(this),
            'filter:update': this.onUpdate.bind(this),
            'messagecounts:set': this.onMessageCountSet.bind(this),
            'view:focus:changed': this.onViewFocus.bind(this),
            'view:show': this.onShow.bind(this),
            'view:close': this.onClose.bind(this),
            'settings:streamalerts:changed': this.onStreamAlertsChange.bind(this),
            'leftnav:savegrouping': this.saveGrouping.bind(this),
            'removeInactiveIM': this.toggleRemoveInactiveIM.bind(this),
            'removeInactiveIM:trigger': this.removeInactiveIM.bind(this),
            'grid:ready': function() {
                self.qRendered.promise.done(function(){
                    self.setNavSize(self.viewConfig.config.width || 255, self.$el, false);
                })
            }
        };

        this.bulkSubscribe(psEvents);
        this.orderedLists = {};
        this.qRendered = Q.defer();
        this.acctData = q.promise;
        this.drag = {};
        this._boundMouseMove = this.sectionMouseMove.bind(this);
        this._boundMouseUp = this.sectionMouseUp.bind(this);

        Q.all([
            this.sandbox.getData('app.account'),
            this.sandbox.getData('documents.' + config.LEFTNAV_GROUPS_DOCUMENT_ID),
            this.sandbox.getData('documents.apps.activeApps'),
            this.sandbox.getData('documents.cronKeeper'),
            this.sandbox.getData('documents.leftnav')
        ]).spread(function(acctData, navGroups, activeApps, cronKeeper){
            _.extend(self.opts, acctData);

            var viewConfig = _.find(acctData.userViewConfigs, function (cfg) {
                return cfg.viewId == 'leftnav';
            });

            if (viewConfig) {
                self.viewConfig = viewConfig;
            } else {
                self.viewConfig = {
                    config: {},
                    viewId: 'leftnav',
                    userId: acctData.userName,
                    clientType: config.CLIENT_VERSION,
                    pinnedChat: false
                };
            }

            if (navGroups) {
                _.extend(self.orderedLists, navGroups);
            }

            if(activeApps) {
                self.opts.activeApps = activeApps;
            }

            if(acctData.config.removeInactiveIM === true) {
                var lastOpenedTime = cronKeeper,
                    mostRecentMidnight = new Date();

                mostRecentMidnight.setHours(0, 1, 0, 0);

                if(Number(lastOpenedTime) < mostRecentMidnight.getTime()) {
                    self.qRendered.promise.then(self.removeInactiveIM.bind(self));
                }

                self.toggleRemoveInactiveIM(null, true);
            }

            q.resolve(acctData);
        });
    },

    render: function () {
        var self = this;

        Q.all([
            this.acctData,
            this.sandbox.getData('documents.leftnav')
        ]).spread(function(acct, leftNav){
            self.$el.html(leftNavTmpl({
                lists: self._parseLists(),
                orderedLists: {},
                collapse: leftNav ? leftNav.collapse : {},
                enableApplications: process.env.ENABLE_APPLICATIONS === 'true'
            }));

            if(leftNav && leftNav.order) {
                var $navItemContainer = self.$el.find('#nav-items-container');

                _.each(leftNav.order, function(section){
                    $navItemContainer.children("[data-section='"+section+"']").detach().appendTo($navItemContainer);
                });
            }

            self.qRendered.resolve();
        });

        return this;
    },

    postRender: function() {
        var self = this;

        this.qRendered.promise.done(function() {
            self._instantiateGroupableLists();
        });
    },

    _parseLists: function() {
        var filters = [],
            staticFilters = [],
            mainFilters = [],
            mainFilterNames = [ 'KEYWORD', 'MENTIONS', 'FOLLOWING' ],
            self = this;

        for (var i in this.opts.filters) {
            var filter = this.opts.filters[i];
            if (filter.filterType == 'FILTER') {
                filter.isUserAdded = true;
                filters.push(filter);
            }  else if (_.contains(mainFilterNames, filter.filterType)) {
                mainFilters.push(filter);
            } else {
                staticFilters.push(filter);
            }
        }

        var map = {
            apps: this.opts.activeApps,
            rooms: this.opts.roomParticipations,
            ims: this.opts.pinnedChats,
            main: mainFilters,
            channels: staticFilters,
            filters: filters
        };

        _.each(map, function(value, key) {
            if (self.orderedLists[key]) {
                var lookup = {};

                _.each(value, function(item) {
                    var obj = self._parseListItem(item);

                    if (obj) {
                        lookup[obj.streamId] = obj;
                    }
                });

                var ordered = self._orderList(self.orderedLists[key], lookup);

                map[key] = _.values(lookup).concat(ordered);
            } else {
                var out = [];
                _.each(value, function(item) {
                    var obj = self._parseListItem(item);

                    if (obj) {
                        out.push(obj);
                    }
                });

                map[key] = out;
            }
        });

        return map;
    },

    _orderList: function(orderedList, lookup) {
        var out = [];

        for (var i = 0; i < orderedList.length; i++) {
            var orderedItem = orderedList[i],
                lookupKey = orderedItem['data-streamid'],
                lookupItem = lookup[lookupKey];

            if (lookupKey && lookupItem) {
                out.push(lookupItem);

                delete lookup[lookupKey];
            } else if (orderedItem.items) {
                orderedItem.items = this._orderList(orderedItem.items, lookup);

                out.push(orderedItem);
            }
        }

        return out;
    },

    _parseListItem: function(item) {
        var obj = _.extend({}, item);
        if (item.filterType) {
            if (item.filterType === 'LEADERSHIP_FOLLOWING') {
                obj.name = 'My Leadership'; // TODO remove this hack after everyone is on the new version of the app and we change the name in MongoDB
            }

            var moduleMap = {
                FOLLOWING: 'following',
                KEYWORD: 'keywords',
                MENTIONS: 'mentions',
                DEPT_FOLLOWING: 'my-department',
                LEADERSHIP_FOLLOWING: 'organizational-leaders',
                FILTER: 'filter'
            };

            obj.moduleName = moduleMap[item.filterType];
            obj.streamId = item._id;
            obj.isFilter = true;
        } else if (item.roomType === 'CHATROOM') { //its a chatroom
            obj.moduleName = 'chatroom';
            obj.streamId = item.threadId;
            obj.isChatroom = true;
        } else if (item.appId) {
            obj.isApp = true;
            obj.steamId = item.appId;
        } else {
            if (!item.roomType) {
                obj.moduleName = 'im';
                obj.name = Utils.aliasedShortenedChatName(item.userPrettyNames, item.userIds, this.opts.prettyName);
                obj.textName = Utils.getShortenedChatName(item.userPrettyNames, this.opts.prettyName);
                obj.oneToOneUserId = this.getOneToOneUserId(item);
                obj.streamId = item.threadId;
                obj.isIm = true;
            } else {
                //PRIVATE_CHANNEL or event
                return;
            }
        }

        this.subscribeMessageCounting(obj.streamId);

        return obj;
    },

    _instantiateGroupableLists: function() {
        var groupableLists = [
            {
                storeKey: 'filters',
                className: 'filter-nav',
                allowGrouping: true
            },
            {
                storeKey: 'ims',
                className: 'im-nav',
                allowGrouping: true
            },
            {
                storeKey: 'rooms',
                className: 'room-nav',
                allowGrouping: true
            }
        ], self = this;

        _.each(groupableLists, function(groupable) {
            var selector = '.ui-sortable.' + groupable.className;

            self.$el.find(selector).groupableList({
                useOffsetParent: true,
                itemIdAttribute: 'data-streamid',
                allowGrouping: groupable.allowGrouping,
                didDeleteGroup: function(list) {
                    //if they delete a group before committing it, save the new order anyway
                    self._saveLeftNav(list, groupable.storeKey);
                },
                didReorderContent: function(list) {
                    self._saveLeftNav(list, groupable.storeKey);
                },
                didFinishEditingGroup: function(group, list) {
                    if (!group.name) {
                        return;
                    }

                    self._saveLeftNav(list, groupable.storeKey);
                    self.syncGroupNotifications($(group.element));
                },
                didCollapseGroup: function(group, list) {
                    self._saveLeftNav(list, groupable.storeKey);
                    self.syncGroupNotifications($(group.element));
                },
                didTriggerSave: function(list) {
                    self._saveLeftNav(list, groupable.storeKey);
                }
            });
        });
    },

    _saveLeftNav: function(list, storeKey) {
        list = this._stripElement(list);

        this.sandbox.setData('documents.' + config.LEFTNAV_GROUPS_DOCUMENT_ID + '.' + storeKey, list);
    },

    _stripElement: function(list) {
        var self = this;

        list = _.map(list, function(item) {
            var ret = _.omit(item, 'element');

            if (item.items) {
                ret.items = self._stripElement(item.items)
            }

            return ret;
        });

        return list;
    },

    saveGrouping: function(context, list) {
        this.$el.find('.ui-sortable.'+list+"-nav").trigger('triggersave');
    },

    onCreate: function (context, args) {
        this.addNavLink(args, true);
    },
    onRemove: function (context, args) {
        this.removeNavLink(args);
    },
    onUpdate: function (context, args) {
        var streamId = args.threadId || args.filterId;

        if (args.maestroObject) {
            this.$el.find('.navlink[data-streamid="' + streamId + '"]').find('.nav-view-name').text(args.maestroObject.name);
        } else {
            this.$el.find('.navlink[data-streamid="' + streamId + '"]').find('.nav-view-name').text(args.name);
        }

    },
    onMessageCountSet: function (context, leftNavItem) {
        var self = this;
        this.qRendered.promise.then(function(){
            //should only query dom after it's rendered
            self.acctData.done(function(rsp){
                // messagecounts:set can be an array of left nav items or a left nav item
                if(Object.prototype.toString.call(leftNavItem) === '[object Array]') {
                    if(rsp.config.sortLeftNavByUnread) {
                        leftNavItem.sort(function(a,b){
                            return a.lastReadTime - b.lastReadTime
                        });
                    }

                    _.each(leftNavItem, function(item){
                        self.doMessageCountSet(item, rsp.config.sortLeftNavByUnread)
                    });

                } else {
                    self.doMessageCountSet(leftNavItem)
                }
            });
        });
    },

    doMessageCountSet: function(args, pushToTop) {
        var streamId = args.streamId,
            count = args.count <= 50 ? args.count : '50+',
            navlink = this.$el.find('[data-streamid="' + streamId + '"]'),
            badge = navlink.find('.nav-view-badge');
        //if it doesn't exist, add the nav link
        if(count.toString() !== '0') {
            if (navlink.length) {
                navlink.removeClass('blink');
                badge.text(count).removeClass('hide-badge');
                this.syncGroupNotifications(navlink);
            } else {
                this.fetchIm(streamId, count, false);
            }
        } else {
            navlink.removeClass('blink').addClass('focused');
            badge.text('0').addClass('hide-badge');
            this.syncGroupNotifications(navlink);
        }
        if(pushToTop) {
            this.pushNavLinkToTopOfGroup(navlink)
        }
    },

    fetchIm: function(streamId, unreadCount, activate) {
        console.log('fetch im', streamId, unreadCount, activate);
        var self = this;

        this.sandbox.send({
            'id': 'IM_MANAGER_THREAD',
            'payload': {
                'action': 'instantchat',
                'threadid': streamId
            }
        }).done(function (rsp) {
            self.sandbox.getData('app.account').then(function (acct){
                var imViewConfig;

                imViewConfig = _.findWhere(acct.userViewConfigs, {viewId: rsp.result.threadId});

                if (!imViewConfig) {
                    imViewConfig = {};
                    imViewConfig.viewId = rsp.result.threadId;
                    imViewConfig.viewType = 'IM';
                    imViewConfig.clientType = config.CLIENT_VERSION;
                    imViewConfig.config = {};
                }

                if (rsp.result.userIds.length > 3) {
                    imViewConfig.pinnedChat = false;
                } else {
                    imViewConfig.pinnedChat = true;
                }

                if (imViewConfig.pinnedChat){
                    acct.pinnedChats.push(rsp.result);
                    self.sandbox.setData('app.account.pinnedChats', acct.pinnedChats);
                }

                self.sandbox.setData('app.account.userViewConfigs', imViewConfig);
                self.addNavLink(rsp.result, true);
                //since previously the view is not created we need to publish increase count event again
                var navlink = self.$el.find('[data-streamid="' + streamId + '"]'),
                    badge = navlink.find('.nav-view-badge');

                if (unreadCount) {
                    navlink.removeClass('blink');
                    badge.text(unreadCount).removeClass('hide-badge');
                }

                if (activate) {
                    navlink.addClass('active');
                }

                self.syncGroupNotifications(navlink);
            });
        }, function(error){
            console.log(error.responseText);
        });
    },

    onViewFocus: function (context, args) {
        var streamId = args.streamId,
            navlinkFocused = this.$el.find('[data-streamid="' + streamId + '"]'),
            badge = $('.nav-view-badge', navlinkFocused);

        this.$el.find('.group.focused, .navlink.focused').removeClass('focused');
        navlinkFocused.removeClass('blink').addClass('focused');

        if (badge.length > 0) {
            badge.text('0').addClass('hide-badge');
        }

        this.syncGroupNotifications(navlinkFocused);
    },

    onClickNavLink: function (e) {
        var target = $(e.currentTarget),
            module = target.attr('data-module');

        if (module == 'profile') {
            this.sandbox.publish('view:show', null, {
                module: 'profile',
                'userId': this.opts.userName
            });
        } else if(module){
            this.sandbox.publish('view:show', null, {
                'streamId': target.attr('data-streamId'),
                'module': module,
                'appId': target.attr('data-appid')
            });
        }
    },
    onShow: function (context, args) {
        var self = this;

        this.qRendered.promise.then(function() {
            var navlink;

            if (args.module == 'profile' && args.userId == self.opts.userName) {
                navlink = self.$el.find('.show-my-profile').parent();
            } else if(args.module == 'appStore'){
                navlink = self.$el.find('.show-app-store').parent();
            } else if (args.module === 'hello-world') {
                navlink = self.$el.find('.show-hello-world').parent();
            } else {
                var streamId = args.streamId;
                navlink = self.$el.find('.navlink[data-streamid="' + streamId + '"]');

                if (navlink.length == 0 && args.module == 'im') {
                    self.fetchIm(streamId, 0, true);
                    return;
                }
            }

            navlink.addClass('active');
        });
    },
    onClose: function (context, args) {
        var streamId = typeof args === "string" ? args : args.viewId;

        if (!streamId) {
            return;
        }

        var navlink;

        if (streamId.match('profile')) {
            navlink = this.$el.find('.show-my-profile').parent();
        } else if (streamId.match('hello-world')) {
            navlink = this.$el.find('.show-hello-world').parent();
        } else {
            if (streamId.match('following')) {
                streamId = streamId.replace('following', '');
            } else if (streamId.match('keywords')) {
                streamId = streamId.replace('keywords', '');
            } else if (streamId.match('mentions')) {
                streamId = streamId.replace('mentions', '');
            } else if (streamId.match('my-department')) {
                streamId = streamId.replace('my-department', '');
            } else if (streamId.match('organizational-leaders')) {
                streamId = streamId.replace('organizational-leaders', '');
            } else if (streamId.match('filter')) {
                streamId = streamId.replace('filter', '');
            } else if (streamId.match('im')) {
                streamId = streamId.replace('im', '');
            } else if (streamId.match('chatroom')) {
                streamId = streamId.replace('chatroom', '');
            } else if (streamId.match('iFrameLoader')) {
                streamId = streamId.replace('iFrameLoader', '');
            } else if(streamId.match('appStore')) {
                streamId = streamId.replace('appStore', 'app-store');
            } else if(streamId.match('trendingTooltrending')) {
                streamId = streamId.replace('trendingTooltrending', 'trending');
            }

            navlink = this.$el.find('.navlink[data-streamid="' + streamId + '"]');
        }

        navlink.removeClass('active');
    },

    addNavLink: function (model, prepend) {
        var streamId = model._id || model.threadId;

        if (this.$el.find('.navlink[data-streamid="' + streamId + '"]').length) {
            return; //the nav link already exists
        }

        var markup = navItemTmpl(this._parseListItem(model)),
            navListClass;

        if (model.filterType) {
            navListClass = '.filter-nav';
        } else if(model.roomType === 'CHATROOM') {
            navListClass = '.room-nav'
        } else if (model.appId) {
            navListClass = '.app-nav'
        } else {
            navListClass = '.im-nav';
        }

        if(model.replace) {
            this.$el.find('li[data-streamid="' + model.replace + '"]').after(markup);
            this.removeNavLink(model.replace);
            this.closeImRemoveAcctData(model.replace);
        } else {
            if (!prepend) {
                this.$el.find(navListClass).append(markup);
            } else {
                this.$el.find(navListClass).prepend(markup);
            }
        }
    },

    getOneToOneUserId: function (imModel) {
        if (imModel.userIds.length > 2) {
            return '';
        }
        // it's either [0] or [1]
        if (imModel.userIds[0] != this.opts.userName) {
            return imModel.userIds[0];
        } else {
            return imModel.userIds[1];
        }
    },
    removeNavLink: function (streamId) {
        this.$el.find('li[data-streamid="' + streamId + '"]').remove();
        var subEvent = 'messagecounts:increment:' + streamId;
        this.bulkUnsubscribe([ subEvent ]);
    },
    subscribeMessageCounting: function (streamId) {
        var subEvent = 'messagecounts:increment:' + streamId,
            obj = {};

        obj[subEvent] = this.onMessageCountIncremented.bind(this);

        this.bulkSubscribe(obj);
    },
    onMessageCountIncremented: function (context, streamId) {
        var self = this;
        if (this.sandbox.getActiveViewStreamId() == streamId) {
            return; // don't touch the badge
        } else {
            var navlink = this.$el.find('.navlink[data-streamid="' + streamId + '"]');
            var badge = navlink.find('.nav-view-badge');
            // check if you blink on this
            this.sandbox.getData('app.account').done(function (rsp) {
                var showStreamAlerts = false;
                var viewConfigFound = false;
                for (var i = 0, len = rsp.userViewConfigs.length; i < len; i++) {
                    var viewConfig = rsp.userViewConfigs[i];
                    if (viewConfig.viewId === streamId && !_.isEmpty(viewConfig.config)) {
                        viewConfigFound = true;
                        if (viewConfig.config.showStreamAlerts) {
                            showStreamAlerts = viewConfig.config.showStreamAlerts;
                        }
                        break; // leave the for loop no matter what
                    }
                }
                if (!viewConfigFound) {
                    // There's no view config found , so let's flash the stream by default!
                    switch (navlink.data('module')) {
                        case 'im':
                            showStreamAlerts = rsp.config.appWideViewConfigs.DESKTOP.IM.showStreamAlerts;
                            break;
                        case 'chatroom':
                            showStreamAlerts = rsp.config.appWideViewConfigs.DESKTOP.CHATROOM.showStreamAlerts;
                            break;
                        case 'filter':
                            showStreamAlerts = rsp.config.appWideViewConfigs.DESKTOP.FILTER.showStreamAlerts;
                            break;
                        case 'following':
                            showStreamAlerts = rsp.config.appWideViewConfigs.DESKTOP.CHANNEL.showStreamAlerts;
                            break;
                        case 'keywords':
                            showStreamAlerts = rsp.config.appWideViewConfigs.DESKTOP.CHANNEL.showStreamAlerts;
                            break;
                        case 'mentions':
                            showStreamAlerts = rsp.config.appWideViewConfigs.DESKTOP.CHANNEL.showStreamAlerts;
                            break;
                        case 'my-department':
                            showStreamAlerts = rsp.config.appWideViewConfigs.DESKTOP.CHANNEL.showStreamAlerts;
                            break;
                        case 'organizational-leaders':
                            showStreamAlerts = rsp.config.appWideViewConfigs.DESKTOP.CHANNEL.showStreamAlerts;
                            break;
                    }
                }
                if (showStreamAlerts) {
                    // this came back async so have to check if not 0 unread
                    if (!navlink.hasClass('blink')) {
                        navlink.addClass('blink');
                    }
//                    if (badge.text() != 0) {
//                        navlink.addClass('blink');
//                    }
                }
            });
            if (badge.length > 0) {
                var newBadgeNumber = parseInt(badge.text()) + 1;
                if (newBadgeNumber > 50) {
                    newBadgeNumber = '50+';
                }
                badge.text(newBadgeNumber);
                badge.removeClass('hide-badge');
            }
            self.syncGroupNotifications(navlink);

            self.sandbox.getData('app.account.config.sortLeftNavByUnread').done(function(rsp){
                if(rsp) {
                    self.pushNavLinkToTopOfGroup(navlink)
                }
            })
        }
    },

    pushNavLinkToTopOfGroup: function(navlink){
        var $group = navlink.closest('.group');

        if ($group.length == 1) {
            // is navlink is in a group
            $group = $group.find('ul').eq(0);
            if ($group.eq(0).children().length < 2)
                return;
        }
        else if ($group.length == 0){
            // treat the entire category as a group since the message doesnt have a group
            $group = navlink.parent()
        }

        if (!!$group.attr('class') && $group.attr('class').indexOf('main-nav') > -1){
            // navlink is My Profile, Following, Keywords, or Mentions. Dont Move it!
            return;
        }
        // pop, lock, and drop it
        navlink.detach();
        $($group).prepend(navlink);
    },

    syncGroupNotifications: function($group) {
        var $section = null;

        if(!$group.hasClass('nav-section') && !$group.hasClass('group')) {
            $section = $group.parents('.nav-section');
            $group = $group.closest('.group'); //a nav link was passed in, so find and update the group
        }


        if($section && $section.length) {
            this.syncGroupNotifications($section);
        }

        if (!$group || $group.length == 0) {
            return;
        }

        var $badge = $group.find('.nav-view-badge').eq(0);

        if (!$group.hasClass('collapsed')) {
            $badge.empty();
            $group.removeClass('blink');
            return;
        }

        var items = $group.find('li.navlink'),
            aggUnreadCount = 0,
            blink = false,
            stops = 0,
            i = 0;

        while (i < items.length && stops < 2) {
            var $item = $(items[i]),    //dear author, why are you creating a 2nd jquery object when you already have one- radaja
                unreadCount = $item.find('.nav-view-badge').text();

            if (unreadCount == '50+') {
                aggUnreadCount = 51;
                stops++;
            } else {
                var parsed = parseInt(unreadCount);

                if (!_.isNaN(parsed)) {
                    aggUnreadCount += parsed;
                }
            }

            if ($item.hasClass('blink')) {
                blink = true;
                stops++;
            }

            i++;
        }

        $group.toggleClass('blink', blink);

        if (aggUnreadCount === 0) {
            $badge.empty();
        } else if (aggUnreadCount > 50) {
            $badge.text('50+');
        } else {
            $badge.text(aggUnreadCount);
        }

        if ($group.find('li.focused').length > 0) {
            $group.addClass('focused');
        }
    },

    showGoIm: function (e) {
        var self = this;

        e.stopPropagation();

        var contentView = new goIm({
            'sandbox': self.sandbox
        });

        this.sandbox.publish('modal:show', null, {
            contentView: contentView,
            title: 'Instant Message',
            isFlat: true
        });
    },

    showGoRoom: function (e) {
        var self = this;

        e.stopPropagation();

        var contentView = new goRoom({
            'sandbox': self.sandbox
        });

        this.sandbox.publish('modal:show', null, {
            contentView: contentView,
            title: 'Chat Room',
            isFlat: true
        });
    },

    showGoFilter: function (e) {
        e.stopPropagation(); //otherwise its a left nav click to open the view

        var contentView = new goFilter({
            sandbox: this.sandbox,
            createNew: true
        });

        this.sandbox.publish('modal:show', null, {
            contentView: contentView,
            title: 'Filter',
            isFlat: true
        });
    },

    closeIm: function (e) {
        var self = this,
            $target = $(e.currentTarget),
            $container = $target.parents('li'),
            streamId = $container.attr('data-streamid'),
            moduleType = $container.attr('data-module'),
            imViewConfig = null;


        e.stopPropagation(); //otherwise its a left nav click to open the view

        this.sandbox.publish('view:removed', null, streamId);
        this.sandbox.publish('view:close', null, moduleType + streamId);

        this.closeImRemoveAcctData(streamId)
    },
    closeImRemoveAcctData: function(streamId) {
        var self = this;

        self.sandbox.getData('app.account').done(function (acct) {
            //update userViewConfig (saves to server automatically)
            var imViewConfig = _.findWhere(acct.userViewConfigs, {viewId: streamId});

            imViewConfig.pinnedChat = false; //no matter what
            self.sandbox.setData('app.account.userViewConfigs', imViewConfig);

            //also remove it from the pinnedChats array
            for (var i = 0, len = acct.pinnedChats.length; i < len; i++) {
                if (acct.pinnedChats[i].threadId === streamId) {
                    acct.pinnedChats.splice(i, 1);
                    break;
                }
            }
            self.sandbox.setData('app.account.pinnedChats', acct.pinnedChats);
        });
    },
    onStreamAlertsChange: function (context, args) {
        var self = this;

        switch (args.moduleType) {
            case 'CHANNEL':
                var channels = [];
                channels.push(this.$el.find('.navlink[data-module="following"]'));
                channels.push(this.$el.find('.navlink[data-module="keywords"]'));
                channels.push(this.$el.find('.navlink[data-module="mentions"]'));
                channels.push(this.$el.find('.navlink[data-module="my-department"]'));
                channels.push(this.$el.find('.navlink[data-module="organizational-leaders"]'));
                if (args.showStreamAlerts) {
                    _.each(channels, function (channel) {
                        if ($(channel).find('.hide-badge').length === 0) {
                            var streamHasUserViewConfig = _.find(self.opts.userViewConfigs, function (userViewConfig) {
                                return $(channel).data('streamid') === userViewConfig.viewId;
                            });

                            if (streamHasUserViewConfig !== undefined && !_.isEmpty(streamHasUserViewConfig.config)) {
                                if (streamHasUserViewConfig.config.showStreamAlerts) {
                                    $(channel).addClass('blink');
                                }
                            } else {
                                $(channel).addClass('blink');
                            }
                        }
                    });
                } else {
                    _.each(channels, function (channel) {
                        if ($(channel).find('.hide-badge').length === 0) {
                            var streamHasUserViewConfig = _.find(self.opts.userViewConfigs, function (userViewConfig) {
                                return $(channel).data('streamid') === userViewConfig.viewId;
                            });

                            if (streamHasUserViewConfig !== undefined && !_.isEmpty(streamHasUserViewConfig.config)) {
                                if (streamHasUserViewConfig.config.showStreamAlerts) {
                                    $(channel).addClass('blink');
                                }
                            } else {
                                $(channel).removeClass('blink');
                            }
                        }
                    });
                }
                break;
            case 'FILTER':
                var filters = this.$el.find('.navlink[data-module="filter"]');
                if (args.showStreamAlerts) {
                    _.each(filters, function (filter) {
                        if ($(filter).find('.hide-badge').length === 0) {
                            var streamHasUserViewConfig = _.find(self.opts.userViewConfigs, function (userViewConfig) {
                                return $(filter).data('streamid') === userViewConfig.viewId
                            });

                            if (streamHasUserViewConfig !== undefined && !_.isEmpty(streamHasUserViewConfig.config)) {
                                if (streamHasUserViewConfig.config.showStreamAlerts) {
                                    $(filter).addClass('blink');
                                }
                            } else {
                                $(filter).addClass('blink');
                            }
                        }
                    });
                } else {
                    _.each(filters, function (filter) {
                        if ($(filter).find('.hide-badge').length === 0) {
                            var streamHasUserViewConfig = _.find(self.opts.userViewConfigs, function (userViewConfig) {
                                return $(filter).data('streamid') === userViewConfig.viewId
                            });

                            if (streamHasUserViewConfig !== undefined && !_.isEmpty(streamHasUserViewConfig.config)) {
                                if (streamHasUserViewConfig.config.showStreamAlerts) {
                                    $(filter).addClass('blink');
                                }
                            } else {
                                $(filter).removeClass('blink');
                            }
                        }
                    });
                }
                break;
            case 'IM':
                var ims = this.$el.find('.navlink[data-module="im"]');
                if (args.showStreamAlerts) {
                    _.each(ims, function (im) {
                        if ($(im).find('.hide-badge').length === 0) {
                            var streamHasUserViewConfig = _.find(self.opts.userViewConfigs, function (userViewConfig) {
                                return $(im).data('streamid') === userViewConfig.viewId
                            });

                            if (streamHasUserViewConfig !== undefined && !_.isEmpty(streamHasUserViewConfig.config)) {
                                if (streamHasUserViewConfig.config.showStreamAlerts) {
                                    $(im).addClass('blink');
                                }
                            } else {
                                $(im).addClass('blink');
                            }
                        }
                    });
                } else {
                    _.each(ims, function (im) {
                        if ($(im).find('.hide-badge').length === 0) {
                            var streamHasUserViewConfig = _.find(self.opts.userViewConfigs, function (userViewConfig) {
                                return $(im).data('streamid') === userViewConfig.viewId
                            });

                            if (streamHasUserViewConfig !== undefined && !_.isEmpty(streamHasUserViewConfig.config)) {
                                if (streamHasUserViewConfig.config.showStreamAlerts) {
                                    $(im).addClass('blink');
                                }
                            } else {
                                $(im).removeClass('blink');
                            }
                        }
                    });
                }
                break;
            case 'CHATROOM':
                var chatrooms = this.$el.find('.navlink[data-module="chatroom"]');
                if (args.showStreamAlerts) {
                    _.each(chatrooms, function (chatroom) {
                        if ($(chatroom).find('.hide-badge').length === 0) {
                            var streamHasUserViewConfig = _.find(self.opts.userViewConfigs, function (userViewConfig) {
                                return $(chatroom).data('streamid') === userViewConfig.viewId
                            });

                            if (streamHasUserViewConfig !== undefined && !_.isEmpty(streamHasUserViewConfig.config)) {
                                if (streamHasUserViewConfig.config.showStreamAlerts) {
                                    $(chatroom).addClass('blink');
                                }
                            } else {
                                $(chatroom).addClass('blink');
                            }
                        }
                    });
                } else {
                    _.each(chatrooms, function (chatroom) {
                        if ($(chatroom).find('.hide-badge').length === 0) {
                            var streamHasUserViewConfig = _.find(self.opts.userViewConfigs, function (userViewConfig) {
                                return $(chatroom).data('streamid') === userViewConfig.viewId
                            });

                            if (streamHasUserViewConfig !== undefined && !_.isEmpty(streamHasUserViewConfig.config)) {
                                if (streamHasUserViewConfig.config.showStreamAlerts) {
                                    $(chatroom).addClass('blink');
                                }
                            } else {
                                $(chatroom).removeClass('blink');
                            }
                        }
                    });
                }
                break;
        }
    },

    initResize: function (e) {
        e.preventDefault();
        this.navObject = $('#nav');
        this.placeHolderObject = $('#simple_nav_placeholder');

        this.prevWidth = e.pageX;
        this.placeHolderObject.css('width', this.navObject.outerWidth()).show();

        $('.simple_nav_guide').show();

        $(document).mouseup({'self': this}, this.endResize);
        $(document).mousemove({'self': this}, this.displayResize);
    },
    displayResize: function (e) {
        var self = e.data.self;
        var o = self.placeHolderObject;
        var w = Math.round(parseInt(o.css('width'), 10) - (self.prevWidth - e.pageX));

        // Max width
        if (w > 300) {
            w = 300;
        }
        else if (w < 255 && w > 225) {
            w = 242;
        }
        else if (w < 87) {
            w = 30;
        }
        else {
            self.prevWidth = e.pageX;
        }


        o.css('width', w);
    },
    endResize: function (e) {
        var self = e.data.self;
        var o = self.placeHolderObject;
        var w = parseInt(o.css('width'), 10);

        o.hide();
        $('.simple_nav_guide').hide();

        self.setNavSize(w, self.navObject);

        $(document).off('mouseup', this.endResize);
        $(document).off('mousemove', this.displayResize);
    },
    resetNavSize: function (e) {
        this.setNavSize(242, $('#nav'));
    },
    setNavSize: function (width, navigationObject, skipPaint) {
        if (width < 87) {
            navigationObject.addClass('nav_minimized');
        }
        else {
            navigationObject.removeClass('nav_minimized');
        }
        navigationObject.css('width', width);
        $('#simple_nav').css('left', width);

        this.viewConfig.config.width = width;

        this.sandbox.setData('app.account.userViewConfigs', this.viewConfig);

        this.sandbox.publish('leftnav:resized', null, {
            'navWidth': width,
            'skipPaint': skipPaint
        });
    },
    toggleRemoveInactiveIM: function(context, active) {
        var self = this;

        if(active) {
            this.sandbox.registerCronJob({
                cronName: 'removeInactiveIM',
                cronOpts: {
                    cronTime: '1 0 * * *', //1 minute after midnight, every day... http://crontab.org/
                    onTick: function(){
                        var waitTimeSeconds = Math.floor((Math.random() * 1800) + 1); // random 0 to 1800 seconds (30 minutes)

                        setTimeout(function(){
                            self.sandbox.publish('removeInactiveIM:trigger', null, {})
                        }, waitTimeSeconds*1000);
                    },
                    start: true
                }
            });
        } else {
            this.sandbox.removeCronJob({'cronName':'removeInactiveIM'});
        }
    },

    removeInactiveIM: function() {
        var self = this;

        return Q.all([ this.sandbox.getData('app.account.pinnedChats'), this.sandbox.getData('documents') ]).spread(function(pinnedChats, documents) {
            var pinnedChatIds = _.pluck(pinnedChats, 'threadId'),
                toKeep = _.union(self._getGroupedIMs(documents.leftnavGroups), self._getOpenIMs(documents.layout)),
                toClose = _.difference(pinnedChatIds, toKeep);

            for (var i = 0; i < toClose.length; i++) {
                var id = toClose[i],
                    $link = self.$el.find('[data-streamid="' + id + '"]');

                //on initial page load, new messages come in after initial removal
                if ($link.find('.hide-badge').length === 0) {
                    continue;
                }

                self.removeNavLink(id);
                self.closeImRemoveAcctData(id);
            }
        });
    },

    _getGroupedIMs: function(leftnavGroups) {
        var ret = [];

        if (leftnavGroups && leftnavGroups.ims) {
            var ims = leftnavGroups.ims;

            var rows = _.filter(ims, function(item) {
                return !!item.items;
            });

            if (rows.length > 0) {
                for (var i = 0; i < rows.length; i++) {
                    var row = rows[i];

                    ret = ret.concat(_.pluck(row.items, 'data-streamid'));
                }
            }
        }

        return ret;
    },

    _getOpenIMs: function(layout) {
        var layoutKeys = _.keys(layout),
            ret = [];

        for (var i = 0; i < layoutKeys.length; i++) {
            var key = layoutKeys[i];

            if (layout[key].module === 'im') {
                ret.push(key.substr(2));
            }
        }

        return ret;
    },

    collapseCategory: function(e) {
        console.log('clicked');
        var self = this,
            $elem = $(e.target),
            category = $elem.parents('section').attr('data-section');

        this.toggleCategory({
            'section': category
        });

        this.sandbox.getData('documents.leftnav.collapse.'+category).done(function(rsp){
            self.sandbox.setData('documents.leftnav.collapse.'+category, {
                'isCollapsed': rsp ? !rsp.isCollapsed : true
            });
        });
    },
    toggleCategory: function(opts) {
        var $parent = this.$el.find('.'+opts.section+'-nav').parent('.nav-section');

        $parent.toggleClass('collapsed');

        this.syncGroupNotifications($parent)
    },
    sectionMouseDown: function(e){
        this.drag = {};
        this.drag.dropAreas = [];
        this.drag.$target = $(e.currentTarget).parent();

        var self = this,
            offset = this.drag.$target.offset(),
            elOffset = this.$el.position(),
            sectionType = this.drag.$target.attr('data-section');

        this.drag.elementX = offset.left;
        this.drag.elementY = offset.top;
        this.drag.parentY = elOffset.top;
        this.drag.elementWidth = this.drag.$target.width();
        this.drag.mouseY = e.pageY;

        this.$el.find('.nav-section').not("[data-section='"+sectionType+"']").each(function(i, elem){
            var $this = $(elem),
                offset = $this.offset(),
                height = $this.height();

            self.drag.dropAreas.push({
                $target: $this,
                top: offset.top,
                bottom: offset.top+height,
                middle: (offset.top+(offset.top+height))/2
            });
        });

        $(document).on('mousemove', this._boundMouseMove).on('mouseup', this._boundMouseUp);

        return false;
    },
    sectionMouseMove: function(e) {
        e.preventDefault(); //dont select text

        var delta = this.drag.mouseY - e.pageY;

        if (this.drag.mouseY === null || Math.abs(delta) < 10) {
            return;
        }

        if (!this.drag.startedDrag) {
            this.drag.startedDrag = true;

            this.drag.$target.addClass('dragging');

            var height = this.drag.$target.height();

            this.drag.$clone = $('<section />').css({
                opacity: 0,
                height: height,
                float: 'left',
                width: '100%'
            }).insertAfter(this.drag.$target);
        }

        var top = this.drag.elementY - (delta),
            contBottom = this.drag.parentY + this.$el.height();

        if (top < this.drag.parentY) {
            top = this.drag.parentY;
        } else if (top > contBottom) {
            top = contBottom;
        }

        this.drag.$target.css({
            top: top-50,
            left: this.drag.elementX,
            width: this.drag.elementWidth
        });

        top = top + 10;

        if(this.drag.dropTarget) {
            this.drag.dropTarget.$target.removeClass('drop-bottom drop-top');
            delete this.drag.dropTarget.dropTop;
            delete this.drag.dropTarget.dropBottom;
            this.drag.dropTarget = null;
        }

        //check if above the top half of the first one
        if(top < this.drag.dropAreas[0].middle) {
            this.drag.dropTarget = this.drag.dropAreas[0];
            this.drag.dropTarget.dropTop = true;
        }

        //check if below the bottom half of the bottom one
        if(!this.drag.dropTarget) {
            if(top > this.drag.dropAreas[this.drag.dropAreas.length-1].middle) {
                this.drag.dropTarget = this.drag.dropAreas[this.drag.dropAreas.length-1];
                this.drag.dropTarget.dropBottom = true;
            }
        }

        //check everything in between
        if(!this.drag.dropTarget) {
            for(var i = 0, len = this.drag.dropAreas.length; i < len; i++) {
                if(top > this.drag.dropAreas[i].top && top <= this.drag.dropAreas[i].bottom) {
                    this.drag.dropTarget = this.drag.dropAreas[i];

                    if(top < this.drag.dropAreas[i].middle) {
                        this.drag.dropTarget.dropTop = true;
                    } else {
                        this.drag.dropTarget.dropBottom = true;
                    }

                    break;
                }
            }
        }

        if(this.drag.dropTarget) {
            if(this.drag.dropTarget.dropTop) {
                this.drag.dropTarget.$target.addClass('drop-top')
            } else {
                this.drag.dropTarget.$target.addClass('drop-bottom')
            }
        }

    },
    sectionMouseUp: function(e){
        $(document).off('mousemove', this._boundMouseMove).off('mouseup', this._boundMouseUp);

        this.drag.mouseY = null;
        this.drag.elementX = null;
        this.drag.elementY = null;
        this.drag.parentY = null;
        this.drag.elementWidth = null;
        this.drag.dropAreas = [];

        if (!this.drag.startedDrag) {
            return;
        }

        this.drag.$clone.remove();
        this.drag.$clone = null;

        this.drag.$target.removeClass('dragging').removeAttr('style');

        if (this.drag.dropTarget) {
            var order = [];

            this.drag.dropTarget.$target.removeClass('drop-top drop-bottom');
            if(this.drag.dropTarget.dropTop) {
                this.drag.$target.detach().insertBefore(this.drag.dropTarget.$target);
            } else {
                this.drag.$target.detach().insertAfter(this.drag.dropTarget.$target);
            }

            this.$el.find('.nav-section').each(function(i, elem){
                order.push($(this).attr('data-section'));
            });

            this.sandbox.setData('documents.leftnav.order', order);
        } else {
            //an interesting way to prevent a click event from firing if an item is dragged but not resorted
            var prevSibling = this.drag.$target.prev();
            this.drag.$target.detach().insertAfter(prevSibling);
        }

        this.drag.dropTarget = null;
        this.drag.startedDrag = false;
    }
    /*,
    showHelloWorld: function () {
        this.sandbox.publish('view:show', null, {
            'module': 'helloworld',
            'randomData': {
                'name': 'Rusty'
            }
        });
    }*/
});

var presenceMixin = require('../../common/mixins/presenceMixin');
mixinDefaults(module.exports);
presenceMixin(module.exports);
