var Backbone = require('backbone');
var moment = require('moment');
module.exports = Backbone.Model.extend({
    idAttribute: 'messageId',
    shareCount: 0,
    readBy: [],
    deliveredTo: [],
    previousMessage: null,

    initialize: function() {
        Backbone.Model.prototype.initialize.apply(this, arguments);
        //can't just use time divide by MS_IN_DAY, timezone offset will be ignored and thus cause the wrong grouping bug
        this.set('dateStamp', moment(this.get('ingestionDate')).format('YYYYMMDD'));
    }
});