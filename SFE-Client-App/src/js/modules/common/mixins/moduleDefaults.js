var Backbone = require('backbone');
var Symphony = require('symphony-core');

var hasTooltips = require('./hasTooltips');
var subscribable = require('./subscribable');

var moduleOptionsTmpl = require('../templates/module-options.handlebars');

var defaults = {
    events: {
        'click .pin-view': 'togglePinned',
        'click .float-view': 'floatView',
        'click .unfloat-view': 'unfloatView',
        'click .remove': 'closeView',
        'click .show-more': 'toggleSettingsMenu',
        'click': 'closeSettingsMenu'
    },

    initialize: function (opts) {
        this.opts = opts || {};
        this.exportOpts = $.extend(true, {}, _.omit(opts, 'sandbox', 'account'));
        this.sandbox = opts.sandbox;
        this.viewId = opts.viewId;
        this.isPinned = opts.isPinned === undefined ? false : opts.isPinned;
        this.streamId = opts.streamId;
        this.module = opts.module;
        this.eventBus = opts.eventBus || _.extend({}, Backbone.Events);
        this.moduleMenuOpen = false;
        this.newlyFocused = false;

        this.init = opts.init === undefined ? false : opts.init;
        this._dropCache = {};
        this._aliasableCache = [];

        this._sb_defaultPsEvents = {
            'view:focus:requested': this.onFocusRequested.bind(this),
            'view:focus:changed': this.onFocusChanged.bind(this),
            'aliases:updated': this.updateAliases.bind(this),
        };

        for (var subEvent in this._sb_defaultPsEvents) {
            if (this._sb_defaultPsEvents.hasOwnProperty(subEvent)) {
                this.sandbox.subscribe(subEvent, this._sb_defaultPsEvents[subEvent]);
            }
        }

        this._bound_aliasableAdded = this.aliasableAdded.bind(this);

        this.prefixEvent(this.el, 'AnimationStart', this._bound_aliasableAdded);
    },

    takeFocus: function () {
        var self = this;
        this.$el[0].scrollIntoView();
        if (self.qRendered) {
            self.qRendered.promise.done(function () {
                self.$el.parent().trigger('focus');
                self.$el.parent().click();
                self.didTakeFocus();
            });
        }
    },

    didTakeFocus: $.noop,

    onFocusRequested: function (context, args) {
        // click it to really steal focus
        if (args.viewId === this.viewId) {
            this.takeFocus();
            if (this.moduleMenuOpen === true) {
                this.newlyFocused = true;
            }
        }
    },

    onFocusChanged: function(ctx, args) {
        if (args.viewId !== this.viewId) {
            this.toggleSettingsMenu(null, false);
        }
    },

    updateAliases: function(ctx, updated) {
        var self = this;

        _.each(updated, function(alias) {
            if (!_.contains(self._aliasableCache, alias.userId)) {
                return;
            }

            var $elements = self.$el.find('.aliasable[data-userid="' + alias.userId + '"]');

            if (!alias.alias) {
                //this could be batched, however since a user can only remove an alias from one user
                //at a time and the initial update doesn't touch names without aliases this code should be OK.
                self.sandbox.send({
                    id: 'USER_RESOLVE',
                    payload: {
                        ids: alias.userId
                    }
                }).then(function(rsp) {
                    var user = rsp[0];

                    if (user) {
                        $elements.each(function() {
                            var $this = $(this),
                                subAlias = $this.children('.subalias');

                            if(subAlias.length) {
                                subAlias.text(user.prettyName);
                            } else {
                                $this.text(user.prettyName);
                            }
                        });
                    }
                });
            } else {
                $elements.each(function() {
                    var $this = $(this),
                        subAlias = $this.children('.subalias');

                    if(subAlias.length) {
                       subAlias.text(alias.alias);
                    } else {
                        $this.text(alias.alias);
                    }
                });
            }
        });
    },

    aliasableAdded: function(e) {
        var $target = $(e.target);

        if (e.animationName == 'nodeInserted' && $target.hasClass('aliasable')) {
            var userId = $target.attr('data-userid');

            if (!_.contains(this._aliasableCache, userId)) {
                this._aliasableCache.push(userId);
            }

            this.sandbox.getData('documents.' + Symphony.Config.PER_USER_METADATA_DOCUMENT_ID + '.' + userId).then(function(rsp) {
                if (rsp && rsp.alias) {
                    var subAlias = $target.children('.subalias');

                    if(subAlias.length) {
                        subAlias.text(rsp.alias);
                    } else {
                        $target.text(rsp.alias);
                    }

                }
            });
        }
    },

    togglePinned: function () {
        if (!this.isPinned) {
            var pinIcon = this.$el.find('.pin-view');

            this.isPinned = true;

            pinIcon.addClass('pinned');
            pinIcon.attr('data-tooltip', 'Module Pinned');
            this.destroyTooltips();
            this.initTooltips();
            this.sandbox.publish('view:pin', null, this.viewId);
        }
    },

    floatView: function () {
        this.sandbox.publish('view:float', null, this.viewId);
    },

    unfloatView: function () {
        /**
         * This becomes a question when we allow multiple modules in a child popout.
         * */

        //todo a better way to get the floaterId from somewhere, this code already runs in coreFloat.js
        var match,
            pl = /\+/g,  // Regex for replacing addition symbol with a space
            search = /([^&=]+)=?([^&]*)/g,
            decode = function (s) {
                return decodeURIComponent(s.replace(pl, " "));
            },
            query = window.location.search.substring(1),
            params = {};

        while (match = search.exec(query)) {
            params[decode(match[1])] = decode(match[2]);
        }

        //tell layout manager in main window to show the view
        this.sandbox.publish('view:unfloat', null, _.defaults({
            'floaterId': params.floaterId,
            'isPinned': this.isPinned
        }, _.extend({}, this.exportOpts)));
    },

    closeView: function () {
        this.sandbox.publish('view:close', null, this.viewId);
    },

    destroy: function () {
        var keys = _.keys(this._sb_defaultPsEvents),
            self = this;

        _.each(keys, function (event) {
            self.sandbox.unsubscribe(event, self._sb_defaultPsEvents[event]);
            delete self._sb_defaultPsEvents[event];
        });

        this.removePrefixEvent(this.el, 'AnimationStart', this._bound_aliasableAdded);

        this.bulkUnsubscribe();
        this.destroyTooltips();

        this.remove();
    },

    exportJson: function () {
        this.exportOpts.init = true;
        this.exportOpts.isPinned = this.isPinned;

        return this.exportOpts;
    },

    renderSettingsMenu: function() {
        switch (this.module) {
            case 'search':
                this.opts.isSearch = true;
                break;
            case 'filter':
                this.opts.isFilter = true;
                break;
            case 'hashtag-context':
                this.opts.isTagContext = true;
                break;
            case 'chatroom':
                this.opts.isChatroom = true;
                break;
            case 'im':
                this.opts.isIM = true;
                break;
            case 'profile':
            case 'twitter-profile':
                this.opts.isProfile = true;
                break;
            case 'following':
                this.opts.isFilter = true;
                break;
            case 'keywords':
                this.opts.isFilter = true;
                break;
            case 'mentions':
                this.opts.isFilter = true;
                break;
            case 'my-department':
                this.opts.isFilter = true;
                break;
            case 'organizational-leaders':
                this.opts.isFilter = true;
                break;
            default:
                this.opts.isSearch = true;
        }
        var tmpl = moduleOptionsTmpl(this.opts);
        this.$el.find('.module-content').append(tmpl);
    },

    toggleSettingsMenu: function (e, state) {
        if (e) {
            e.stopPropagation();
        }

        if (typeof state === 'boolean') {
            this.moduleMenuOpen = !state;
        }

        if (this.moduleMenuOpen === true) {
            this.$el.find('.module-options').css('display', 'none');
            this.$el.find('.show-more').removeClass('opened');
            this.moduleMenuOpen = false;
        } else {
            this.$el.find('.module-options').css('display', 'block');
            this.$el.find('.show-more').addClass('opened');
            this.moduleMenuOpen = true;
        }
    },

    closeSettingsMenu: function(e) {
        // If module is just newly focused, donot close the submenu if it is opened
        if (this.moduleMenuOpen === true && this.newlyFocused === false) {
            this.$el.find('.module-options').css('display', 'none');
            this.$el.find('.show-more').removeClass('opened');
            this.moduleMenuOpen = false;
        } else {
            this.newlyFocused = false;
        }
    }
};

_.extend(defaults, hasTooltips, subscribable);

module.exports = function (view) {
    var to = view.prototype;
    _.defaults(to, defaults);
    _.defaults(to.events, defaults.events);
    var oldInitialize = to.initialize,
        oldDestroy = to.destroy;

    to.initialize = function () {
        defaults.initialize.apply(this, arguments);
        oldInitialize.apply(this, arguments);
    };
    to.destroy = function () {
        oldDestroy.apply(this, arguments);
        defaults.destroy.apply(this, arguments);
    };
};
