// symphony
var config = require("../../../../config/config");
var utils = require("../../../../utils");

// 3rd party
var Symphony = require("symphony-core");

// templates
var listTmpl = require("../../templates/tools/list.handlebars");


module.exports = Symphony.View.extend({

    // backbone methods

    initialize: function (opts) {
        Symphony.View.prototype.initialize.apply(this, arguments);
        this._items = opts.items || [];
        this._header = opts.header;
    },

    render: function () {
        this.$el.html(listTmpl({
            items: this._items,
            header: this._header
        }));
        return Symphony.View.prototype.render.apply(this, arguments);
    },


    // helpers

    _add: function (item) {
        if (typeof item == "object" && item.id && item.value) {
            this._items.push(item);
        } else {
            throw new Error("Please pass an object with the list item\'s id and value");
        }
    },

    _removeAllItems: function () {
        this._items = [];
    }
});
