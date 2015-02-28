/**
 * Created by whinea on 11/18/2014.
 */
var Backbone = require('backbone');
var TokenView = require('./tableToken');
var TableView = require('./table');

module.exports = Backbone.View.extend({
    tagName: 'span',

    initialize: function(opts) {
        this.self = this;
        this.opts = opts;
        this.sandbox = opts.sandbox;
        this.tokenView = new TokenView(opts);
        this.tableView = new TableView(opts);
        this.viewId = opts.viewId;
        this.tableWidth = 0;
        this.renderOnlyToken = opts.renderOnlyToken;
        if (!this.renderOnlyToken) {
            this.viewWidth = opts.viewWidth;
            this.sandbox.subscribe('module:afterResize:' + this.viewId, this.onResizeOfPanel.bind(this));
        }
    },

    onResizeOfPanel: function(args, data) {
        if (data.id === this.viewId) {
            this.toggleTableOrToken(data.width);
        }
    },

    toggleTableOrToken: function(sizeOfPanel) {
        if (this.tableWidth < (sizeOfPanel - 200)) {
            this.tableView.$el.removeClass("hidden");
            this.tokenView.$el.addClass("hidden");
            this.tokenView.$el.removeClass("table-token");
        }
        else {
            this.tableView.$el.addClass("hidden");
            this.tokenView.$el.removeClass("hidden");
            this.tokenView.$el.addClass("table-token");
        }
    },

    render: function() {
        this.$el.append(this.tokenView.render(this.opts).el);
        if (!this.renderOnlyToken) {
            this.tableWidth = this.calculateMaxTableWidth();
            this.$el.append(this.tableView.render(this.opts).el);
            this.toggleTableOrToken(this.viewWidth);
        }
        return this;
    },

    calculateMaxTableWidth: function() {
        var table = this.tableView.render(this.opts).$el.children().eq(0);
        var temp = $('<div></div>').css({"position": "absolute", "top": "-10000px", "left": "-10000px"});
        temp.append(table);
        $('body').append(temp);
        var width = table.width();
        temp.remove();
        return  width;
    },

    destroy: function(){
        if (!this.renderOnlyToken) {
            this.sandbox.unsubscribe('module:afterResize:' + this.viewId);
        }
    }
});