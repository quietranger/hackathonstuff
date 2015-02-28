var ItemView = require('../itemView');

var template = require('../../../templates/views/keywordGroups/keyword-group');

module.exports = ItemView.extend({
    template: template,

    didSelectItem: function() {
        var selected = this.model.get('selected');

        this.eventBus.trigger('item:selected', selected);
    }
});
