var Symphony = require('symphony-core');
var Handlebars = require('hbsfy/runtime');
var contentPreviewTmpl = require('./templates/content-preview.handlebars');


var contentPreview = Symphony.View.extend({
    className: 'content-preview-modal',
    events: {
        'click .download': 'download',
        'click .image-preview': 'openLink',
        'click .cancel': 'cancel'
    },
    initialize: function(opts) {
        this.opts = opts || {};
        this.sandbox = opts.sandbox;
    },

    render: function() {
        if (this.opts.download == null) {
            this.opts.download = "download." + this.opts.filetype;
        }
        this.$el.append(contentPreviewTmpl({
            'url': this.opts.url,
            'contentTitle': this.opts.url,
            'download': this.opts.download
        }));

        return this;
    },

    postRender: function() {

    },
    cancel: function() {
        var self = this;
        self.sandbox.publish('modal:hide');
    },

    openLink: function(e) {
        e.preventDefault();
        var url = $(e.currentTarget).attr('href');
        this.sandbox.publish('appBridge:fn', null, {
            fnName: 'openLink',
            param: {url: url}
        });
    }
});

module.exports = contentPreview;