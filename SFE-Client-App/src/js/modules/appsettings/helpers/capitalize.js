var Handlebars = require("hbsfy/runtime");
var _ = require('underscore');
var _s = require("underscore.string");

Handlebars.registerHelper('capitalize', function (value) {
    return _s.capitalize(s.toLowerCase());
});
