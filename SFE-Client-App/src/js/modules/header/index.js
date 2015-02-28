var HeaderView = require('./views/view.js');

module.exports = {
    createView: function(viewOpts){
        return new HeaderView(viewOpts);
    }
};