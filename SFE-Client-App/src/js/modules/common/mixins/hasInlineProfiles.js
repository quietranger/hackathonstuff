var Popover = require('../popover');

var InlineProfileView = require('../inlineProfile');

/**
 * Map of user ids to inline profile view instances. This allows such views to be shared across modules.
 *
 * @type {Object}
 * @private
 */
var inlineProfileMap = {};

/**
 * List of userIds that have active inline profiles. Serves as a queue of sorts - when new inline profile
 * views are rendered, their managed userId will be moved to the front of this array. Once this array exceeds
 * 20 people in length, it will pop the last userId off the end and delete that userId from the inlineProfileMap
 * object.
 *
 * @type {Array}
 * @private
 */
var inlineProfileList = [];

/**
 * Provides inline profile view functionality to views. Adds mouse enter and mouse out event handlers to HTML
 * elements with the class 'has-hover-profile' and a 'data-userid' attribute.
 *
 * To use this mixin, simply call initInlineProfiles() in your view constructor and destroyInlineProfiles() in your view
 * destroy method.
 *
 * @mixin
 */
var HasInlineProfiles = {
    /**
     * Events hash.
     *
     * @private
     */
    _inlineProfileEvents: {
        'mouseenter .has-hover-profile': '_delayedShowInlineProfile',
        'mouseout .has-hover-profile': 'hideInlineProfile'
    },

    /**
     * Delay to show/hide the inline profile view.
     *
     * @constant
     */
    INLINE_PROFILE_DELAY: 250,

    /**
     * Private function that handles the logic to show the inline profile after INLINE_PROFILE_DELAY has elapsed.
     *
     * @param e
     * @private
     */
    _delayedShowInlineProfile: function(e) {
        this._inlineProfileShowTimer = _.delay(this.showInlineProfile.bind(this), this.INLINE_PROFILE_DELAY, e);
    },

    /**
     * Initialize inline profiles for the mixed-in module.
     */
    initInlineProfiles: function() {
        this._inlineProfileShowTimer = null;
        this._currentInlineProfile = null;

        this.events = _.defaults({}, this.events, this._inlineProfileEvents);
    },

    /**
     * Destroy inline profiles for the mixed-in module. This does not erase the global inline profile cache, rather it
     * only destroys the popover instances for this particular view.
     */
    destroyInlineProfiles: function() {
        if (this._currentInlineProfile) {
            this._currentInlineProfile.destroy(true);
            this._currentInlineProfile = null;
        }
    },

    /**
     * Actually shows an inline profile. Consumes a jQuery mouseenter event. This function will manage the global lists
     * of inline profile views.
     *
     * @param e
     */
    showInlineProfile: function(e) {
        var userId = e.currentTarget.dataset.userid,
            userType = e.currentTarget.dataset.usertype || 'lc',
            profile = inlineProfileMap[userId];

        if (!userId) {
            console.warn('No data-userid attribute present on hover profile target.');
            return;
        }

        // Check if profile is cached
        if (profile) {
            var idx = inlineProfileList.indexOf(userId);

            //if cached profile is not the first array element, make it the first
            if (idx > 0) {
                inlineProfileList.splice(0, 0, inlineProfileList.splice(idx, 1)[0]);
            }
        } else {
            //if not cached, create a new inline profile view...
            profile = new InlineProfileView({
                sandbox: this.sandbox,
                eventBus: this.eventBus,
                userId: userId,
                userType: userType
            });

            //... and place it as the first element in the cache
            inlineProfileMap[userId] = profile;
            inlineProfileList.splice(0, 0, userId);

            //if this view busts the cache, then pop the last element off the array
            if (inlineProfileList.length > 10) {
                var lastId = inlineProfileList.pop(),
                    lastView = inlineProfileMap[lastId];

                lastView.destroy();
                delete inlineProfileMap[lastId];
            }
        }

        //make a pointer to the current popover...
        this._currentInlineProfile = new Popover({
            target: e.currentTarget,
            contentView: profile,
            hideDelay: this.INLINE_PROFILE_DELAY,
            tetherOptions: {
                offset: '0 60px'
            }
        });

        //...and show it
        this._currentInlineProfile.show();
    },

    /**
     * Hides the current inline profile view.
     */
    hideInlineProfile: function() {
        clearTimeout(this._inlineProfileShowTimer);

        if (this._currentInlineProfile) {
            this._currentInlineProfile.destroy(true);
            this._currentInlineProfile = null;
        }
    }
};

module.exports = HasInlineProfiles;