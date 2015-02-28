var onbehalfView = require('./views/onbehalf.js');

module.exports = {
    createView: function(param){
        return new onbehalfView(param);
    }
} ;