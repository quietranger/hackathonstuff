var Backbone = require('backbone');
var messageModel = require('../models/message');

module.exports = Backbone.Collection.extend({
    model: messageModel,
    comparator: 'ingestionDate'
});