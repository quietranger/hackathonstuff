var Backbone = require('backbone');
var tableTokenTmpl = require('../templates/tableToken');
var tableTmpl = require('../views/table.js');

module.exports = Backbone.View.extend({
    className: 'table-token',
    tagName: 'span',

    events: {
        'click .open': 'openTable',
        'click .delete': 'close',
        'click .token-heading': 'openTable'
    },
    initialize: function(opts) {
        this.opts = opts || {};
        this.sandbox = opts.sandbox;
        this.self = this;
    },

    render: function() {
        this.$el.append(tableTokenTmpl(this.opts));
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
        this.remove();
    }
});