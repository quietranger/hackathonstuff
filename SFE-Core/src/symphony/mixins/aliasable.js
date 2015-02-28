var PrefixEvents = require('../utils/prefixEvents');

var config = require('../../../config');

/**
 * Mixin that provides alias functionality.
 *
 * @deprecated
 * @requires module:Utils/PrefixEvents
 * @mixin
 */
var Aliasable = {
    /**
     * Internal array of user IDs appearing within this module that
     * should be aliased.
     *
     * @private
     */
    _aliasedUsers: [],

    /**
     * Initialize aliases for use in this module. Adds an event listener
     * to the element created animation event.
     */
    initAliases: function() {
        this._boundAliasableAdded = this.aliasableAdded.bind(this);

        PrefixEvents.addPrefixEvent(this.el, 'AnimationStart', this._boundAliasableAdded);
    },

    /**
     * Callback function for when an element requiring an alias is added to the DOM.
     *
     * @param {Event} e
     */
    aliasableAdded: function(e) {
        var $target = $(e.target),
            self = this;

        if (e.animationName == 'nodeInserted' && $target.hasClass('aliasable')) {
            var userId = $target.attr('data-userid');

            if (!_.contains(this._aliasedUsers, userId)) {
                this._aliasedUsers.push(userId);
            }

            this.sandbox.getData('documents.' + config.PER_USER_METADATA_DOCUMENT_ID + '.' + userId).then(function(rsp) {
                if (rsp && rsp.alias) {
                    self._updateAliasElement($target, rsp.alias);
                }
            });
        }
    },

    /**
     * Callback function for when aliases are updated.
     *
     * @param {Array} updated Array of updated alias objects
     */
    updateAliases: function(updated) {
        var self = this;

        _.each(updated, function(alias) {
            if (!_.contains(self._aliasedUsers, alias.userId)) {
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
                            self._updateAliasElement($(this), user.prettyName);
                        });
                    }
                });
            } else {
                $elements.each(function() {
                    self._updateAliasElement($(this), alias.alias);
                });
            }
        });
    },

    /**
     * Empties the alias cache and unbinds all prefixed listeners.
     */
    destroyAliases: function() {
        this._aliasedUsers = [];

        PrefixEvents.removePrefixEvent(this.el, 'AnimationStart', this._boundAliasableAdded);
    },

    /**
     * Convenience method to actually swap out the aliasable's text
     * with the alias.
     *
     * @param $element
     * @param alias
     * @private
     */
    _updateAliasElement: function($element, alias) {
        var subAlias = $element.find('.subalias');

        if(subAlias.length) {
            subAlias.text(alias);
        } else {
            $element.text(alias);
        }
    }
};

module.exports = Aliasable;
