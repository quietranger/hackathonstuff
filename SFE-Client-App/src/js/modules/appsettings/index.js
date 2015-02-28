var ModuleView = require('./views/module.js');

module.exports = {
    createView: function (opts) {
        return new ModuleView(opts);
    }
};