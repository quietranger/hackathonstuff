var Backbone = require('backbone');
var uploadAgreementTmpl = require('./uploadAgreement.handlebars');
var errors = require('../../../config/errors');

module.exports = Backbone.View.extend({
    initialize: function(opts) {
        this.opts = opts || {};
        this.sandbox = opts.sandbox;

    },
    events: {
        'click .submit': 'acceptAgreement',
        'click .cancel': 'hide'
    },
    render: function() {
        this.$el.append(uploadAgreementTmpl({
            'uploadAgreement' : errors.COMMON.UPLOAD_AGREEMENT
        }));

        return this;
    },
    hide: function() {
        this.sandbox.publish('modal:hide');
    },
    acceptAgreement: function() {
        var self = this;

        self.sandbox.publish('modal:hide');

        if(this.opts.type === 'file') {
            $(this.opts.container).find('.file-upload-input').trigger('click');
        }

        if(this.opts.type === 'screenClip') {
            setTimeout(function(){ //wait for modal background to be removed
                self.sandbox.publish('appBridge:fn', null, {
                    'fnName': 'openScreenSnippetTool'
                });
            }, 100);
        }


        this.sandbox.setData('app.acceptUploadAgreement', true);
        this.sandbox.publish('uploadAgreement', null, true);
        //placing the callback in the setdata .then success cb breaks the file upload click trigger in the CEF wrapper!
        //chome only allows programmatic file upload clicks through user initiated events, i think putting the cb
        //inside the async setData method makes chrome lose track of where the click is coming from
    }
});