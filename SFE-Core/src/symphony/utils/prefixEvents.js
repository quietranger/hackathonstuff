/**
 * @module Utils/PrefixEvents
 */
module.exports = {
    /**
     * Add browser-specific prefixed events to the supplied element.
     *
     * @static
     *
     * @param element
     * @param type
     * @param callback
     */
    addPrefixEvent: function (element, type, callback) {
        var pfx = ["webkit", "moz", "MS", "o", ""];

        for (var p = 0; p < pfx.length; p++) {
            if (!pfx[p]) type = type.toLowerCase();
            element.addEventListener(pfx[p] + type, callback, false);
        }
    },

    /**
     * Remove the supplied event and all prefixes from the supplied element.
     *
     * @static
     *
     * @param element
     * @param type
     * @param cb
     */
    removePrefixEvent: function (element, type, cb) {
        var pfx = ["webkit", "moz", "MS", "o", ""];

        for (var p = 0; p < pfx.length; p++) {
            if (!pfx[p]) type = type.toLowerCase();
            element.removeEventListener(pfx[p] + type, cb);
        }
    }
};