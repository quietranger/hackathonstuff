var textInput = require('../../common/textInput/textInput');
module.exports = textInput.extend({
    onSafeCount: function () {
        var overCountBefore = this.overCount;
        this.overCount = false;
        if(overCountBefore){
            this.eventBus.trigger('input:overcount:change');
        }
    },
    onOverCount: function () {
        var overCountBefore = this.overCount;
        this.overCount = true;
        if(!overCountBefore){
            this.eventBus.trigger('input:overcount:change');
        }
    }
});