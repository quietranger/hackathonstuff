var leadersView = require('../common/baseFilter/index');

module.exports = {
    createView: function(opts) {
        opts.showEditButton = true;
        return new leadersView(opts);
    }
};