var Backbone = require('backbone');
var tableTmpl = require('../templates/table');

module.exports = Backbone.View.extend({
    className: 'excel-full-table',
    tagName: 'span',
    events: {
        'click .open': 'openTable',
        'click .close': 'close'
    },
    initialize: function(opts) {
        this.opts = opts || {};
        this.sandbox = opts.sandbox;
        this.self = this;
    },

    render: function() {
        this.$el.append(tableTmpl(this.opts));
        return this;
    },

    openTable: function() {
        console.log('test-Opening Table');
        this.sandbox.publish('modal:show', null, {
            'contentView': new tableTmpl(this.opts),
            'isFlat': true,
            title: 'Pasted Table'
        });
    },
    close: function() {
        console.log('test-Close Table');
    }
});