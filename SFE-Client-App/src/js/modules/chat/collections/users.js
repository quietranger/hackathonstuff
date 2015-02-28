var Backbone = require('backbone');

var userModel = require('../models/user');

module.exports = Backbone.Collection.extend({
    model: userModel,
    comparator: 'joinDate'
});