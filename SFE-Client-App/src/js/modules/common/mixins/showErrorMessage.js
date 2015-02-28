var errorTmpl = require('./templates/error.handlebars');

module.exports = {
    //if timeout == 0, will never time out but provide a x button for user to dismiss error message
    showErrorMessage: function (message, timeout) {
        var self = this;
        var errorMessageEl;
        var fragment;

        if (!this.$el.find('.alert-box').length) {
            this.$el.prepend('<div class="alert-box alert"></div>');
        }

        var $errorBox = this.$el.find('.alert-box.alert');
        var errorId = message.hashCode();
        var markup = errorTmpl({
            message: message,
            removable: !timeout,
            id: errorId
         });

        errorMessageEl = $errorBox.find("p[id="+ errorId +"]");
        /*
         TODO @lamjeff errorTimeout is always undefined. need to handle this somehow

         if(errorMessageEl.length){
            clearTimeout(errorTimeout);
            errorMessageEl.remove();
        }
         */

        $errorBox.append(markup);

        if (timeout && timeout > 0) {
            setTimeout(function () {
                errorMessageEl = self.$el.find('.alert-box.alert p');
                if (errorMessageEl.length > 1) {
                    errorMessageEl.last().remove();
                } else {
                    self.$el.find('.alert-box.alert').remove();
                }
            }, timeout);
        } else {
            errorMessageEl = self.$el.find('.alert-box.alert p');
            errorMessageEl.off('click');
            errorMessageEl.on('click', '.dismiss-error-msg', function (e) {
                $(e.currentTarget).parent().remove();
                if (!self.$el.find('.alert-box.alert p').length) {
                    self.$el.find('.alert-box.alert').remove();
                }
            });
        }
    }
};