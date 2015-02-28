var Backbone = require('backbone');
var CryptoLib = require('symphony-cryptolib');

var API_CONFIG = require('../../config/api');

var resetPasswordTemplate = require('../templates/reset-password');

var sendAjax = require('../../mixins/sendAjax');

module.exports = Backbone.View.extend({
    tagName: 'form',

    events: {
        'submit': 'resetPassword',
        'click .forgot': 'returnToForgot'
    },

    initialize: function(opts) {
        var self = this;

        this.plId = opts.plId;
        this.userId = opts.userId;

        if (!this.plId || !this.userId) {
            throw new Error('Both plId and userId are required.');
        }

        this.password = null;
        this.passwordConfirmation = null;
        this.eventBus = opts.eventBus;
        this.hasCheckedPlId = false;

        this.plIdPromise = this.sendAjax('GET', API_CONFIG.resetPasswordUrl, {
            plid: this.plId,
            userId: this.userId
        });

        this.plIdPromise.then(function() {
            self.hasCheckedPlId = true;
            self.render();
        }, this._getPlIdDidFail.bind(this));
    },

    render: function() {
        if (this.hasCheckedPlId) {
            this.eventBus.trigger('spin:stop');
        } else {
            this.eventBus.trigger('spin:start');
            return this;
        }

        this.$el.html(resetPasswordTemplate());

        return this;
    },

    resetPassword: function(e) {
        e.preventDefault();

        this.password = this.$el.find('#password').val();
        this.passwordConfirmation = this.$el.find('#password-confirmation').val();

        if (!this.validate()) {
            return;
        }

        var salt = CryptoLib.Utils.bits2b64(CryptoLib.Convenience.randomBytes(16)),
            hPassword = CryptoLib.PBKDF2(salt, 10000, this.password);

        this.sendAjax('POST', API_CONFIG.resetPasswordUrl, {
            salt: salt,
            hPassword: hPassword,
            plid: this.plId,
            userId: this.userId
        }).then(this._resetDidSucceed.bind(this), this._resetDidFail.bind(this));
    },

    validate: function() {
        if (_.isEmpty(this.password)) {
            this.eventBus.trigger('error', 'A new password is required.');
            return false;
        }

        if (!this._validatePassword()) {
            this.eventBus.trigger('error', 'Passwords must be at least 15 characters long and contain' +
            ' at least three of the following: one uppercase character, one lowercase character, one special' +
            ' character, and one number.');
            return false;
        }

        if (_.isEmpty(this.passwordConfirmation)) {
            this.eventBus.trigger('error', 'The passwords do not match. Please enter the new password in both fields.');
            return;
        }

        if (this.password !== this.passwordConfirmation) {
            this.eventBus.trigger('error', 'The passwords to not match.');
            return false;
        }

        return true;
    },

    returnToForgot: function() {
        this.eventBus.trigger('show:forgot-password');
    },

    _validatePassword: function() {
        var matches = 0,
            regexes = [ /[A-Z]+/, /[a-z]+/, /[\W]+/, /[\d]+/ ];

        if (this.password.length < 15) {
            return false;
        }

        for (var i = 0; i < regexes.length; i++) {
            var regex = regexes[i];

            if (this.password.match(regex)) {
                matches++;
            }

            if (matches === 3) {
                return true;
            }
        }

        return false;
    },

    _getPlIdDidFail: function(err) {
        this.eventBus.trigger('spin:stop');

        var message = err && err.status === 401 ? 'The link has expired. Please request a new one' +
            ' via the link below.': 'An unknown error occurred. Please try again.';

        this.eventBus.trigger('error', message);

        this.$el.html('<a class="forgot small" href="#forgot">Get New Link</a>');
    },

    _resetDidSucceed: function() {
        this.eventBus.trigger('show:login');
        this.eventBus.trigger('success', 'Your password was successfully reset.');
    },

    _resetDidFail: function() {
        this.eventBus.trigger('error', 'An error occurred. Please try again.');
    }
});

_.extend(module.exports.prototype, sendAjax);