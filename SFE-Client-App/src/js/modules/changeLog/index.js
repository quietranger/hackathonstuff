var changeLogView = require('./views/changeLog.js');

module.exports = {
    createView: function(param){
        return new changeLogView(param);
    }
} ;