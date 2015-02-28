var Handlebars = require("hbsfy/runtime");

Handlebars.registerHelper('ifEqual', function (options) {
    var args = _.values(options.hash);
    var equal = true;
    for (var i = 0; i < args.length - 1; i++) {
        for (var j = i + 1; j < args.length; j++) {
            if (args[i] != args[j]) {
                equal = false;
                break;
            }
        }
    }
    if (equal) {
        return options.fn(this);
    }
    return options.inverse(this);
});
