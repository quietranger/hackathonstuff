'use strict';

var Q = require('q');
var View = require('../../view');

var containerTmpl = require('./templates/container');

var Tooltipable = require('../../mixins/tooltipable');
var Aliasable = require('../../mixins/aliasable');
var HasPresence = require('../../mixins/hasPresence');

module.exports = View.extend(
/** @lends module:Symphony.Module.prototype */
{
    /**
     * Default module DOM events. Handles opening/closing of modules and the settings menu.
     *
     * @private
     */
    defaultEvents: {
        'click .pin-view': 'pin',
        'click .float-view': 'float',
        'click .unfloat-view': 'unfloat',
        'click .remove': 'close',
        'click .show-more': 'toggleMenu',
        'click': 'closeMenu'
    },

    /**
     * Default module PubSub (sandbox) events. Handles focus.
     *
     * @private
     */
    defaultPsEvents: {
        'view:focus:requested': 'focusRequested',
        'view:focus:changed': 'focusChanged',
        'aliases:updated': 'didUpdateAliases'
    },

    /**
     * Whether the module should include the container or not.
     */
    includeContainer: true,

    /**
     * Wether a headless view that should always exist in the DOM
     */
    runHeadless: false,

    /**
     * HTML string containing markup to be inserted into the module
     * container's header area.
     */
    moduleHeader: '<h2>Untitled Module</h2>',

    /**
     * HTML string containing markup to be inserted into the module's
     * settings menu when opened.
     *
     * @type {String|Null}
     */
    moduleMenu: null,

    /**
     * Flag for if the module menu is shown or hidden.
     *
     *
     */
    moduleMenuOpen: false,

    /**
     * Handlebars template that contains the markup for the module container.
     *
     * @private
     */
    containerTmpl: containerTmpl,

    /**
     * Flag describing if the module is newly focused.
     */
    newlyFocused: false,

    /**
     * @constructs
     * @extends Symphony.View
     * @mixes Tooltipable
     *
     * @param {object} opts
     * @param opts.sandbox A sandbox instance
     * @param opts.viewId A viewId for the module
     * @param [opts.eventBus] An eventbus instance
     * @param [opts.isPinned] Flag for whether the module should render as pinned
     * @param [opts.init] Flag for if the module is being rendered as part of app bootstrap
     * @param [opts.streamId] The streamId of the module, if applicable
     * @param [opts.module] The module's name
     */
    initialize: function(opts) {
        var self = this;

        View.prototype.initialize.call(this, opts);

        this.viewId = opts.viewId;

        if (!this.viewId) {
            throw new Error('Module instantiated without valid viewId.');
        }

        this.isPinned = !!opts.isPinned;
        this.init = !!opts.init;
        this.streamId = opts.streamId;
        this.module = opts.module;

        /**
         * The module's content. Should be used in place of $el in subclasses in most cases.
         *
         * @type {*|jQuery|HTMLElement}
         */
        this.$content = this.includeContainer ? $('<div></div>') : this.$el;

        this.listenTo(this.eventBus, 'view:rendered', function(view) {
            //why not call this in postRender function and enforce developer to always call View.prototype.postRender.call(this);
            if (self === view) {
                self.initTooltips();
            }
        });

        this.initAliases();
    },

    /**
     * Inserts the contents of the $content property into the
     * module's container. Also inserts the module header and menu.
     *
     * @returns {object}
     */
    render: function() {
        if (this.includeContainer) {
            this.$el.html(this.containerTmpl({
                moduleHeader: typeof this.moduleHeader === "function" ? this.moduleHeader() : this.moduleHeader,
                moduleMenu: this.moduleMenu,
                isPinned: this.isPinned
            }));

            this.$content.appendTo(this.$el.find('section.module-content div.content'));
        }

        //a headless view should always be attached to the DOM
        //hide/show is achieved through the display css property, rather
        //than destroying/initializing the view itself.
        if(this.runHeadless) {
            this.$el
                .attr('id', this.runHeadless.htmlId)
                .attr('data-viewid', this.runHeadless.viewId)
                .addClass('simple_grid_container simple_grid_main_container')
                .css({'display': 'none'});
        }

        // if includeContainer is false, the module still should append content to
        // $content for convention's sake. $content is just a reference to $el
        // when includeContainer is false.
        return View.prototype.render.call(this);
    },

    /**
     * Performs actions after rendering is completed. Useful
     * for attaching event handlers, etc.
     * Should always return this.
     *
     * @returns {object}
     */
    postRender: function() {
        return View.prototype.postRender.call(this);
    },

    /**
     * PubSub callback that determines if a module should be focused. If
     * the module isn't rendered yet but is being focused, sets an
     * event handler that will take focus after the view is rendered;
     *
     * @param context
     * @param args
     *
     * @private
     */
    focusRequested: function(context, args) {
        var self = this;

        if (args.viewId === this.viewId) {
            if (this.isRendered) {
                this._focus();
            } else {
                this.listenToOnce(this.eventBus, 'view:rendered', function(view) {
                    if (view === self) {
                        self._focus();
                    }
                });
            }

            if (this.moduleMenuOpen === true) {
                this.newlyFocused = true;
            }
           /* TODO: remove below code if we are not going to use promise, above logic is ugly
           this.qRendered.promise.then(function(){
                self._focus();
                if (self.moduleMenuOpen === true) {
                    self.newlyFocused = true;
                }
            });*/
        }
    },

    /**
     * Handles for when focus changes. Currently, only closes the module menu.
     *
     * @param context
     * @param args
     */
    focusChanged: function(context, args) {
        if (args.viewId !== this.viewId) {
            this.closeMenu();
        }
    },

    /**
     * Actually take focus. Should not be called externally.
     *
     * @private
     */
    _focus: function() {
        this.el.scrollIntoView();
        this.$el.parent().trigger('focus');
        this.$el.parent().click();//for unknown reason, the above focus event doesn't trigger _dom_trackActiveElement in layout.js, need this line
        this.eventBus.trigger('module:focused', this);
    },

    /**
     * Pin the module.
     */
    pin: function () {
        if (!this.isPinned) {
            this.isPinned = true;

            this.$el.find('.pin-view').addClass('pinned')
                .attr('data-tooltip', 'Module Pinned');

            this.initTooltips(true);

            this.sandbox.publish('view:pin', null, this.viewId);
        }
    },

    /**
     * Floats the module.
     */
    float: function () {
        this.sandbox.publish('view:float', null, this.viewId);
    },

    /**
     * Unfloats the module.
     */
    unfloat: function () {
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
        }, _.extend({}, this.exportJson())));
    },

    /**
     * Shows/hides the module menu.
     *
     * @param {Event} e
     * @param {Boolean} [state] The desired open/close state. If undefined, will
     * set itself to the opposite of moduleMenuOpen.
     */
    toggleMenu: function (e, state) {
        var hasState = state === undefined;

        if (hasState) {
            e.stopPropagation();
        }

        this.moduleMenuOpen = hasState ? !this.moduleMenuOpen : state;
        this.$el.find('.module-options').toggle(this.moduleMenuOpen);
        this.$el.find('.show-more').toggleClass('opened', this.moduleMenuOpen);
    },

    /**
     * Closes the module menu.
     */
    closeMenu: function() {
        this.toggleMenu(null, false);
    },

    /**
     * Closes the module.
     */
    close: function () {
        this.sandbox.publish('view:close', null, this.viewId);
    },

    /**
     * Exports the view's constructor options. By default,
     * simply returns the exportOpts property.
     */
    exportJson: function() {
        return $.extend(true,_.omit(this.opts, 'sandbox', 'account', 'symphony', 'replace'), {
            isPinned: this.isPinned
        });
    },

    /**
     * Thin wrapper around aliasable that remove the unneeded ctx argument
     *
     * @param context
     * @param updated
     */
    didUpdateAliases: function(context, updated) {
        this.updateAliases(updated);
    },

    /**
     * Destroy this module. Unbinds all events and calls the super
     * destructor.
     */
    destroy: function() {
        this.destroyTooltips();
        this.destroyAliases();

        View.prototype.destroy.call(this);
    }
});

$.extend(true, module.exports.prototype, Tooltipable, Aliasable);
