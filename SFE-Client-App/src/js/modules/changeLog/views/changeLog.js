var Symphony = require('symphony-core');

var versionHistoryTmpl = require('../templates/versionHistory.handlebars');

require('../../common/helpers/index');

module.exports = Symphony.Module.extend({
    moduleHeader: '<h2>Symphony Change Log</h2>',

    className: 'module change-log',

    requiresAccountData: false,

    events: {
        'click .version-title': 'showDetails',
        'click .remove': 'closeView'
    },

    initialize: function() {
        Symphony.Module.prototype.initialize.apply(this, arguments);

        this.sandbox.send({
            'id': 'APP_VERSION'
        }).then(this.render.bind(this));
    },

    render: function(rsp) {
        if (rsp) {
            this.$content.html(versionHistoryTmpl(rsp)).addClass('module-scrollable');
        }
        
        return Symphony.Module.prototype.render.apply(this, arguments);
    }
});