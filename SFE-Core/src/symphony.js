/**
 * @module Symphony
 */

var Core = require('./symphony/core');
var View = require('./symphony/view');
var Module = require('./symphony/views/module');
var Config = require('../config');
var Extensions = require('./symphony/extensions');
var Mixins = require('./symphony/mixins');
var Utils = require('./symphony/utils');

/**
 * The base Symphony namespace.
 * @type {{Core: exports, View: exports, Module: exports, Config: exports}}
 */
module.exports = {
    Core: Core,
    View: View,
    Module: Module,
    Config: Config,
    Extensions: Extensions,
    Mixins: Mixins,
    Utils: Utils
};
