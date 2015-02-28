var Backbone = require('backbone');

var appModel = require('../models/appModel');

module.exports = Backbone.Collection.extend({
    model: appModel
});
