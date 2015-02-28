var Symphony = require('symphony-core');
var SpinnerView = require('../../../common/spinner');

var updateAvatarModalTmpl = require('../../templates/modals/update-avatar-modal');

var showErrorMessage = require('../../../common/mixins/showErrorMessage');

var config = require('../../../../config/config');
var errors = require('../../../../config/errors');

/**
 * Constant local variable that maps validation statuses to error messages in errors.js.
 *
 * @type {VALIDATION_STATUS}
 */
var VALIDATION_STATUS = {
    TOO_LARGE: 'TOO_LARGE',
    INVALID: 'INVALID',
    VALID: 'VALID'
};

module.exports = Symphony.View.extend(
/** @lends Symphony.View **/
{
    className: 'update-avatar-modal',

    events: {
        'click .submit': 'saveAvatar',
        'click .upload-new': 'showFilePicker',
        'click .cancel': 'close'
    },

    requiresAccountData: false,

    initialize: function(opts) {
        Symphony.View.prototype.initialize.apply(this, arguments);

        this.file = opts.file;

        if (!this.file) {
            throw new Error('The update avatar modal must be instantiated a valid file object.');
        }

        this.validationStatus = this.validateFile();

        this.cropData = null;
        this.externsLoaded = false;
        this.userId = null;
        this.uploading = false;

        var self = this;

        this.sandbox.getData('app.account.userName').then(function(rsp) {
            self.userId = rsp;
        });

        this.spinner = new SpinnerView({
            sandbox: this.sandbox,
            eventBus: this.eventBus
        });

        this.uploadingSpinner = new SpinnerView({
            sandbox: this.sandbox,
            eventBus: this.eventBus,
            spinnerOpts: {
                lines: 12,
                length: 5,
                width: 2,
                radius: 5
            }
        });

        if (this.validationStatus === VALIDATION_STATUS.VALID) {
            this.dependenciesPromise = this.loadDependencies();
        }
    },

    /**
     * Validates a file based off of its size and extension. Displays error messages based off of the validation failures.
     *
     * @returns {VALIDATION_STATUS}
     */
    validateFile: function() {
        var extension = _.last(this.file.name.split('.')),
            ret = VALIDATION_STATUS.VALID;

        if (config.VALID_AVATAR_FILE_EXTENSIONS.indexOf(extension) === -1) {
            ret = VALIDATION_STATUS.INVALID;
        } else if (this.file.size > config.VALID_AVATAR_FILE_SIZE) {
            ret = VALIDATION_STATUS.TOO_LARGE;
        }

        return ret;
    },

    /**
     * Loads the cropper dependency asynchronously.
     *
     * @returns Q
     */
    loadDependencies: function() {
        var self = this,
            ret = $.getScript('./js/external/cropper.js');

        ret.then(function() {
            self.externsLoaded = true;
            self.render(true);
        });

        return ret;
    },

    render: function() {
        this.$el.html(updateAvatarModalTmpl({
            error: errors.UPDATE_AVATAR_MODAL.IMAGE_ERRORS[this.validationStatus]
        }));

        if (this.validationStatus !== VALIDATION_STATUS.VALID) {
            return Symphony.View.prototype.render.apply(this, arguments);
        }

        if (!this.externsLoaded) {
            this.$el.html(this.spinner.render().el);
            return Symphony.View.prototype.render.apply(this, arguments);
        }

        if (this.spinner) {
            this.spinner.stop();
        }

        var reader = new FileReader();
        reader.onload = this._readerDidLoadFile.bind(this);
        reader.readAsDataURL(this.file);

        return Symphony.View.prototype.render.apply(this, arguments);
    },

    /**
     * Callback to the uploaded image's FileReader. Actually displays the chosen image and initializes the cropper.
     * @param e
     * @private
     */
    _readerDidLoadFile: function(e) {
        var $container = this.$el.find('.avatar'),
            image = document.createElement('img');

        image.src = e.target.result;

        $container.append(image);

        var css = {
            width: image.naturalWidth > 480 ? 480 : image.naturalWidth
        };

        $container.css(css);
        $(image).css(css).cropper({
            aspectRatio: 1,
            done: this._didCropArea.bind(this)
        });
    },

    /**
     * Rounds the crop data.
     *
     * @param data
     * @private
     */
    _didCropArea: function(data) {
        var rounded = {};

        _.each(data, function(value, key) {
            rounded[key] = Math.floor(value);
        });

        this.cropData = rounded;
    },

    /**
     * Saves the cropped avatar on the backend. Sets the 'uploading' parameter to prevent people from uploading
     * the same file multiple times before requests complete.
     *
     * @void
     */
    saveAvatar: function() {
        if (!this.file || !this.cropData || this.uploading) {
            return;
        }

        this.uploading = true;

        var data = new FormData(),
            self = this;

        data.append('xCoordinate', this.cropData.x);
        data.append('yCoordinate', this.cropData.y);
        data.append('size', this.cropData.width);
        data.append('file', this.file);

        this.showUploadingSpinner();

        this.sandbox.send({
            id: 'UPDATE_AVATAR',
            payload: data
        }).then(this._didSaveAvatar.bind(this), this._saveAvatarDidFail.bind(this)).finally(function() {
            self.hideUploadingSpinner();
            self.uploading = false;
        });
    },

    /**
     * Shows a spinner next to the save and cancel buttons while the avatar is being uploaded.
     *
     * @void
     */
    showUploadingSpinner: function() {
        this.$el.find('.buttons').after(this.uploadingSpinner.render().el);
    },

    /**
     * Hides the uploading spinner.
     *
     * @void
     */
    hideUploadingSpinner: function() {
        this.uploadingSpinner.stop();
        this.uploadingSpinner.remove();
    },

    close: function() {
        this.sandbox.publish('modal:hide');
    },

    /**
     * Callback function for when the avatar is successfully saved. Raises an 'avatar:change' event with the userId
     * and images object as parameters. Also updates the datastore and closes the modal.
     *
     * @param rsp
     * @private
     */
    _didSaveAvatar: function(rsp) {
        this.sandbox.setData('app.account.images', rsp.data);
        this.sandbox.publish('avatar:change', null, {
            userId: this.userId,
            images: rsp.data
        });

        this.close();
    },

    /**
     * Failure callback when saving the avatar.
     *
     * @param rsp
     * @private
     */
    _saveAvatarDidFail: function(rsp) {
        switch(rsp.status) {
            case 422:
                this.showErrorMessage('The crop area you have chosen is invalid. Please try another.', 5000);
                break;
            case 400:
                this.showErrorMessage('The file you have chosen is corrupt or invalid. Please try another.', 5000);
                break;
            default:
                this.showErrorMessage('An internal error occurred. Please try again.', 5000);
                break;
        }
    },

    /**
     * Destroys the image cropper.
     *
     * @void
      */
    destroy: function() {
        this.spinner.destroy();
        this.uploadingSpinner.destroy();

        var $img = this.$el.find('.avatar img');

        if ($img.length > 0) {
            $img.cropper('destroy');
        }

        this.eventBus.trigger('update-avatar-modal:destroying');

        Symphony.View.prototype.destroy.apply(this, arguments);
    }
});

_.extend(module.exports.prototype, showErrorMessage);
