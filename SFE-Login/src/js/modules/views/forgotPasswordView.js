var API_CONFIG = require('../../config/api');

var CAPTCHA_CONFIG = require('../../config/captcha');

var Backbone = require('backbone');

var resetPasswordTemplate = require('../templates/forgot-password');

var sendAjax = require('../../mixins/sendAjax');

module.exports = Backbone.View.extend({
    tagName: 'form',

    className: 'forgot-password',

    events: {
        'submit': 'resetPassword',
        'click .login': 'showLogin'
    },

    initialize: function(opts) {
        this.email = null;
        this.eventBus = opts.eventBus;
        this.captchaId = null;
    },

    render: function() {
        var self = this;

        this.$el.html(resetPasswordTemplate());

        if (global.captchaLoaded) {
            this._renderCaptcha();
        } else {
            $(document).on('captchaDidLoad', this._renderCaptcha.bind(this));
        }

        return this;
    },

    resetPassword: function(e) {
        e.preventDefault();

        var self = this;

        this.email = this.$el.find('#email').val();

        if (_.isEmpty(this.email)) {
            this.eventBus.trigger('error', 'An e-mail address is required.');
            return;
        }

        this.sendAjax('POST', API_CONFIG.forgotPasswordUrl, {
            email: this.email,
            'g-recaptcha-response': global.grecaptcha.getResponse(this.captchaId)
        }).then(this._didResetPassword.bind(this), function() {
            self.eventBus.trigger('error', 'An error occurred. Please try again.');
        });
    },

    showLogin: function() {
        this.eventBus.trigger('show:login');
    },

    _didResetPassword: function() {
        var self = this;

        this.$el.fadeOut('fast', function() {
            self.eventBus.trigger('success', 'Password reset link mailed to ' + self.email + '.');
        });
    },

    _renderCaptcha: function() {
        this.captchaId = global.grecaptcha.render(this.$el.find('.captcha')[0], {
            sitekey: CAPTCHA_CONFIG.SITE_KEY
        });
    }
});

_.extend(module.exports.prototype, sendAjax);