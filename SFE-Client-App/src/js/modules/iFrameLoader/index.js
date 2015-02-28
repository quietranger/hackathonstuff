/**
 * Created by radaja on 9/13/2014.
 */

var iFrameLoaderView = require('./views/iFrameLoader.js');

module.exports = {
    createView: function(viewOpts){
        return new iFrameLoaderView(viewOpts);
    }
};