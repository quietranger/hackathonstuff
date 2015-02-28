var Backbone = require('backbone');

var uploadModel = require('../models/uploadModel');

module.exports = Backbone.Collection.extend({
    model: uploadModel
});
