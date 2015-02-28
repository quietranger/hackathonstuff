var Backbone = require('backbone');
var Symphony = require('symphony-core');

var uploadItemTmpl = require('../templates/uploadItem.handlebars');
var errors = require('../../../../config/errors');

module.exports = Symphony.View.extend({
    model: null,

    className: 'upload-item',

    events: {
        'click .delete'             : 'deleteItem',
        'click .failed-remove'      : 'deleteItem'
    },

    initialize: function(opts) {
        Symphony.View.prototype.initialize.call(this, opts);

        this.model = opts.model;
        this.sandbox = opts.sandbox;

        this.listenTo(this.eventBus, 'uploads:remove', this.deleteItem);
    },

    render: function() {
        this.$el.html(uploadItemTmpl(this.model.toJSON()));

        this.$progressContainer = this.$el.find('.progress-container');

        var badUpload = this.checkUpload();

        if(badUpload) {
            //not allowed, bad mime, or no extension etc (fail before upload attempt)
            this.uploadFailed(badUpload);
        } else {
            this.uploadFile();
        }

        this.eventBus.trigger('textinput:resize'); //only necessary when the details view is open (otherwise this view is hidden, no resize event is needed)

        return Symphony.View.prototype.render.call(this);
    },

    checkUpload: function() {
        var validMime = null;

        if(this.model.get('encodedImage')) {
            return false;
        }

        if(!this.model.get('type')) { //if no type, let backend decide
            return false;
        }

        for(var i = 0, len = this.opts.supportedMimeTypes.length; i < len; i++) {
            if(this.model.get('type') === this.opts.supportedMimeTypes[i]) {
                validMime = true;
                break;
            }
        }

        if(validMime) {
            return false;
        } else {
            return errors.COMMON.TEXT_INPUT.UPLOAD.FILE_TYPE_SUPPORT;
        }
    },

    uploadFailed: function(reason) {
        this.model.set({
            'complete'      : true,
            'badReason'     : reason
        });
        this.$el.find('.failed-reason').text(reason);
        this.$progressContainer.addClass('failed').removeClass('success processing');
    },

    uploadFile: function() {
        var self = this,
            formData = new FormData(),
            $progressBar = this.$el.find('.upload-progress'),
            $progressText = this.$el.find('.percent-status');


        if(this.model.get('name') && (this.model.get('fileObject') || this.model.get('content'))) {
            formData.append(this.model.get('name'), this.model.get('fileObject') || this.base64toBlob(this.model.get('content'), 'image/jpeg'));
        }

        self.opts.sandbox.send({
            id: 'UPLOAD_FILE',
            payload: formData,
            onProgress: function(evt) {
                if (evt.lengthComputable && self.model) {
                    var percentComplete = parseInt( (evt.loaded / evt.total * 100), 10);

                    self.model.set('total', evt.total);
                    self.model.set('loaded', evt.loaded);

                    $progressText.text(percentComplete+'%');
                    $progressBar.val(percentComplete);
                    //console.log("Loaded " + parseInt( (evt.loaded / evt.total * 100), 10) + "%");
                }
            }
        }).then(function(rsp){
            if(rsp.fileMetaDatas[0].fileId) {
                //self.uploadRsp = rsp;
                self.$progressContainer.addClass('success').removeClass('failed processing');
                self.$el.find('.icon-status').html('');
                self.model.set('filename', self.model.get('name'));
                self.model.set(rsp.fileMetaDatas[0]);
                self.model.set('serverResponse', rsp.fileMetaDatas[0]); //used later when sending attachment data in a message. backbone prefers flat structure

            } else {
                self.uploadFailed(rsp.message);
            }

            self.model.set('complete', true);

        }, function(rsp){
            self.model.set('complete', true);

            self.uploadFailed(rsp.responseJSON ? rsp.responseJSON.message : 'Upload failed.');
        });
    },

    base64toBlob: function(b64Data, contentType, sliceSize) {
        contentType = contentType || '';
        sliceSize = sliceSize || 512;

        var byteCharacters = atob(b64Data);
        var byteArrays = [];

        for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
            var slice = byteCharacters.slice(offset, offset + sliceSize);

            var byteNumbers = new Array(slice.length);
            for (var i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }

            var byteArray = new Uint8Array(byteNumbers);

            byteArrays.push(byteArray);
        }

        return new Blob(byteArrays, {type: contentType});
    },

    deleteItem: function() {
        //tell the parent, remove the view, delete the file from the cloud if necessary

        if(this.model.get('fileId')) {
            this.sandbox.send({
                'id': 'DELETE_FILE',
                'payload': {
                    'fileid': this.model.get('fileId')
                }
            });
        }

        this.eventBus.trigger('file:remove', this.model);

        this.destroy();
    },

    destroy: function() {
        this.remove();
        this.model = null;

        Symphony.View.prototype.destroy.call(this);
    }
});
