var Backbone = require('backbone');
var Symphony = require('symphony-core');
var Q = require('q');
var config = require('../../../../config/config');

var uploadTmpl = require('../templates/upload.handlebars');
var uploadItemView = require('../views/uploadItemView');
var uploadsCollection = require('../collections/uploadCollection');

module.exports = Symphony.View.extend({
    events: {
        'click .toggle'         : 'toggleDetails',
        'click .delete'         : 'deleteAll', //visible for single successful file upload
        'click .failed-remove'  : 'deleteAll' //visible when all uploads fail (even if its only 1)
    },

    initialize: function(opts) {
        Symphony.View.prototype.initialize.call(this, opts);

        this.model = opts.model;
        this.sandbox = opts.sandbox;
        this.completedUploads = 0;
        this.qRendered = Q.defer();
        this.uploads = new uploadsCollection();
        this.uploadTotalBytes = 1;
        this.uploadLoadedBytes = 0;
        this.percentLoaded = 0;

        this.listenTo(this.eventBus, 'upload:start', this.addFile);
        this.listenTo(this.eventBus, 'file:remove', this.fileRemoved);

        this.listenTo(this.uploads, 'add', this.addUpload);
        this.listenTo(this.uploads, 'add remove', this.addRemoveFile);
        this.listenTo(this.uploads, 'change:loaded', this.updateLoaded);
        this.listenTo(this.uploads, 'change:complete', this.checkComplete);
    },

    updateLoaded: function(model, loaded) {
        this.uploadLoadedBytes = 0; //have to iterate through the collection each time?

        this.uploads.each(function(file) {
            if(file.get('loaded')) { //the upload may not have begun
                this.uploadLoadedBytes = this.uploadLoadedBytes + file.get('loaded');
            }
        }, this);

        this.percentLoaded = Math.ceil(parseInt((this.uploadLoadedBytes / this.uploadTotalBytes * 100), 10));

        if(typeof this.percentLoaded === "number" && this.percentLoaded >= 0) {
            if(this.percentLoaded > 100) {
                this.percentLoaded = 100; //sometimes a difference between browser and server file size?
            }
            this.$uploadProgress.val(this.percentLoaded);
            this.$percentStatus.text(this.percentLoaded+'%');
        }
    },

    addFile: function(file) {
        var self = this;

        if(this.uploads.length >= config.MAX_UPLOAD_FILES) {
            return; //only 10 at a time
        }

        this.qRendered.promise.then(function() {
            var fileExists = false;

            if(!file.content) { //its not a screen clip
                self.uploads.each(function(model) {
                    if(file.name === model.get('name') && file.size === model.get('size')) {
                        fileExists = true;
                    }
                });
            }

            if(!fileExists) {
                if(file.content) {
                    self.uploads.add(file); //a screen clip
                } else {
                    self.uploads.add(_.extend({fileObject: file}, file)); //
                }

                self.eventBus.trigger('uploads:complete', []); //prevent the textInput from sending messages
                self.$progressContainer.addClass('processing').removeClass('success fail');
                self.$textStatus.text('Uploading ' + self.uploads.length + ' files.');
            }
        });
    },

    addUpload: function(model) {
        this.$uploadItems.append(new uploadItemView({
            sandbox: this.sandbox,
            eventBus: this.eventBus,
            model: model,
            supportedMimeTypes: this.opts.supportedMimeTypes
        }).render().el);
    },

    fileRemoved: function(model) {
        if(this.uploads.length === 1) {
            //remove the last one? destroy everything (text input parent handles this)
            this.eventBus.trigger('uploads:clear');
            return;
        }

        if(this.uploads.length === 2) {
            //if there will only be 1 left, we hide the details view
            this.collapseDetails();
        }

        this.uploads.remove(model);
        this.updateLoaded();
        this.checkComplete();
    },

    addRemoveFile: function() {
        this.uploadTotalBytes = 0;

        this.uploads.each(function(upload) {
            if(upload.get('size')) {
                this.uploadTotalBytes = this.uploadTotalBytes + upload.get('size');
            }
        }, this);

        this.checkComplete();
    },

    checkComplete: function() {
        var failedCount = 0,
            completeCount = 0,
            uploadFileMetaData = [],
            textStatus = "";

        this.uploads.each(function(upload){
            if(upload.get('complete')) {
                completeCount++;
            }
        }, this);

        if(this.uploads.length === completeCount) {
            this.uploads.each(function(file){
                if(file.get('fileId')) { //it might be a failed upload
                    uploadFileMetaData.push(file.get('serverResponse'));
                } else {
                    failedCount++;
                }
            });


            //todo radaja the below is a mess!!


            if(failedCount === this.uploads.length) {
                if(failedCount === 1) {
                    textStatus = "Failed to upload file.";
                } else {
                    textStatus = "All files failed to upload.";
                }
            } else if(failedCount) {
                if(failedCount === 1) {
                    textStatus = failedCount + ' file failed. Sending ' + uploadFileMetaData.length + ' with next message.';
                } else {
                    textStatus = failedCount + ' files failed. Sending ' + uploadFileMetaData.length + ' with next message.';
                }
            } else {
                if(this.uploads.length === 1) {
                    textStatus = 'Sending ' + uploadFileMetaData.length + ' file with next message.';
                } else {
                    textStatus = 'Sending ' + uploadFileMetaData.length + ' files with next message.';
                }
            }

            if(failedCount === this.uploads.length) {
                this.$progressContainer.removeClass('processing success').addClass('failed');
            } else {
                this.$progressContainer.removeClass('processing failed').addClass('success');
            }

            if(this.uploads.length === 1 && !failedCount) {
                this.$el.find('.toggle').addClass('hidden');
                this.$el.find('.delete-parent').removeClass('hidden');
                this.$textStatus.text('Sending with next message: '+this.uploads.at(0).get('filename'));
            } else {
                this.$el.find('.toggle').removeClass('hidden');
                this.$el.find('.delete-parent').addClass('hidden');
                this.$textStatus.text(textStatus);
            }
            this.eventBus.trigger('uploads:complete', uploadFileMetaData);
        }
    },

    render: function() {
        this.$el.html(uploadTmpl());

        this.$uploadItems = this.$el.find('.upload-items');
        this.$uploadProgress = this.$el.find('.upload-progress');
        this.$percentStatus = this.$el.find('.percent-status');
        this.$progressContainer = this.$el.find('.progress-container');
        this.$textStatus = this.$el.find('.file-name');
        this.$details = this.$el.find('.details');
        this.$toggle = this.$el.find('.toggle');

        this.eventBus.trigger('textinput:resize');

        this.qRendered.resolve();

        return Symphony.View.prototype.render.call(this);
    },

    toggleDetails: function(e) {
        this.$details.toggleClass('hidden');
        this.$toggle.toggleClass('expanded');
        this.eventBus.trigger('textinput:resize');
    },

    collapseDetails: function() {
        this.$details.addClass('hidden');
        this.$toggle.removeClass('expanded');
        this.eventBus.trigger('textinput:resize');
    },

    deleteAll: function() {
        this.eventBus.trigger('uploads:remove');
    },

    destroy: function() {
        this.uploads = null;
        this.remove();

        Symphony.View.prototype.destroy.call(this);
    }
});
