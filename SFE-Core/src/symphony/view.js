'use strict';

var Backbone = require('backbone');
var Q = require('q');
var Subscribable = require('./mixins/subscribable');
var HasPresence = require('./mixins/hasPresence');

module.exports = Backbone.View.extend(
/** @lends module:Symphony.View.prototype */
{
    /**
     * Default events hash. Used to prevent required events being overwritten by
     * subclasses. Mixed into events during initialize.
     */
    defaultEvents: {},

    /**
     * DOM events hash.
     */
    events: {},

    /**
     * Default module PubSub (sandbox) events.
     *
     * @private
     */
    defaultPsEvents: {},

    /**
     * Placeholder for module PubSub (sandbox) events.
     */
    psEvents: {},

    /**
     * Flag that determines if account data is required to render the view. If yes,
     * render and postRender will be wrapped in a promise that resolves once the
     * dataStore grabs account data.
     */
    requiresAccountData: true,

    /**
     * The account data promise that wraps render and postRender.
     */
    accountDataPromise: null,

    /**
     * Flag set once the view is rendered for the first time.
     */
    isRendered: false,

    /**
     * A Symphony View.
     *
     * @constructs
     * @extends Backbone.View
     * @mixes Subscribable
     *
     * @param opts View options
     * @param opts.sandbox A sandbox instance
     * @param [opts.eventBus] An eventBus instance
     */
    initialize: function(opts) {
        var self = this;

        this.opts = opts || {};
        this.sandbox = opts.sandbox;
        this.eventBus = opts.eventBus || _.extend({}, Backbone.Events);

        if (!this.sandbox) {
            throw new Error('View instantiated without a valid sandbox instance.')
        }

        this.events = _.defaults({}, this.defaultEvents, typeof this.events === 'function' ? this.events() : this.events);
        this.psEvents = _.defaults({}, this.defaultPsEvents, this.psEvents);

        this.subscribeAll(this.psEvents);
        this.initPresence();

        _.bindAll(this, 'render', 'postRender', 'destroy');

        if (this.requiresAccountData) {
            //wrap render function in account data promise
            var oldRender = this.render,
                oldPostRender = this.postRender;

            this.accountDataPromise = this.sandbox.getData('app.account');
            this.render = function() {
                var args = Array.prototype.slice.call(arguments, 0);

                this.accountDataPromise.then(function(rsp) {
                    oldRender.apply(self, [rsp].concat(args)); //oldRender already bound
                }).catch(function(err){
                    if(err) {
                        console.error(err.stack);
                    }
                });

                return this;
            };

            this.postRender = function() {
                var args = Array.prototype.slice.call(arguments, 0);

                this.accountDataPromise.then(function(rsp) {
                    oldPostRender.apply(self, [rsp].concat(args));
                }).catch(function(err){
                    if(err) {
                        console.error(err.stack);
                    }
                });
                return this;
            };
        }

        this.listenToOnce(this.eventBus, 'view:rendered', function(obj) {
            //why not just set isRender in render function?
            //If you are concerned that render function is overrided, should enforce developer to always call View.prototype.render.call(this);
            if (obj === self) {
                self.isRendered = true;
            }
        });
    },

    /**
     * Renders the view's HTML. Should always return this.
     *
     * @returns {object}
     */
    render: function() {
        this.eventBus.trigger('view:rendered', this);

        return this;
    },

    /**
     * Performs actions after rendering is completed. Useful
     * for attaching event handlers, etc. A no-op by default.
     * Should always return this.
     *
     * @returns {object}
     */
    postRender: function() {
        //no one use this yet
        this.eventBus.trigger('view:post-rendered', this);
        return this;
    },

    /**
     * Performs cleanup when the view is destroyed. By default,
     * simply removes the view's element from the DOM and unsubscribes
     * from all psEvents.
     */
    destroy: function() {
        this.destroyPresence();
        this.unsubscribeAll();
        this.remove();
    }
});

$.extend(true, module.exports.prototype, Subscribable, HasPresence);
