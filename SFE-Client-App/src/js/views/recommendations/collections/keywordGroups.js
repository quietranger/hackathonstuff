var Backbone = require('backbone');

var KeywordGroup = require('../models/keywordGroup');

module.exports = Backbone.Collection.extend({
    model: KeywordGroup
});
