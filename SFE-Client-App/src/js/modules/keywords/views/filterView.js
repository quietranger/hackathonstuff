var baseFilterView = require('../../common/baseFilter/index');

var editView = require('../../common/baseStaticFilterSettings/index');

module.exports = baseFilterView.extend({
    showEdit: function() {
        var contentView = new editView({
            eventBus: this.eventBus,
            sandbox: this.sandbox,
            streamId: this.streamId,
            editable: this.editable,
            ruleType: editView.prototype.ruleTypes.KEYWORDS
        });

        this.sandbox.publish('modal:show', null, {
            title: 'Modify Your Keywords',
            contentView: contentView
        });
    }
});