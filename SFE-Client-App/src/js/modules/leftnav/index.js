var leftNavView = require('./views/view');

module.exports = {
    createView: function(opts) {
        return new leftNavView(opts);
    }
};