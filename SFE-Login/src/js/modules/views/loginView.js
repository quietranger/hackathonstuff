var Backbone = require('backbone');
var CryptoLib = require('symphony-cryptolib');

var API_CONFIG = require('../../config/api');

var sendAjax = require('../../mixins/sendAjax');

var loginTemplate = require('../templates/login-form');

module.exports = Backbone.View.extend({
    tagName: 'form',

    events: {
        'submit': 'validateLogin',
        'click .forgot-password': 'showForgotPassword'
    },

    initialize: function(opts) {
        this.userName = null;
        this.password = null;
        this.hPassword = null;
        this.eventBus = opts.eventBus;
        this.authType = opts.authType || 'login';
        this.redirectUrl = opts.redirectUrl;
    },

    validateLogin: function(e) {
        e.preventDefault();

        var userName = $('#username').val(),
            password = $('#password').val();

        if (!userName || userName === '') {
            this.eventBus.trigger('error', 'A username is required.');
            return;
        }

        if (!password || password === '') {
            this.eventBus.trigger('error', 'A password is required');
            return;
        }

        this.userName = userName;
        this.password = password;

        this.performLogin();

        return false;
    },

    render: function() {
        this.$el.html(loginTemplate({
            isSSO: this.authType === 'sso',
            redirectUrl: this.redirectUrl
        }));

        return this;
    },

    performLogin: function() {
        var self = this;

        this.sendAjax('GET', API_CONFIG.saltUrl, {
            userName: this.userName
        }).then(this._sendLogin.bind(this), function() {
            self.eventBus.trigger('error', 'An error occurred during authentication. Please try again later.');
        }).then(this._redirectToApp.bind(this), function(err) {
            if (err && err.status === 401) {
                self.eventBus.trigger('error', 'Invalid username or password.');
            } else {
                self.eventBus.trigger('error', 'An error occurred during login. Please try again later.');
            }
        });
    },

    showForgotPassword: function(e) {
        e.preventDefault();

        this.eventBus.trigger('show:forgot-password');
    },

    _sendLogin: function(rsp) {
        if (!rsp && !this.hPassword) {
            throw new Error('Cannot send login without salt or hashed password.');
        }

        this.hPassword = CryptoLib.PBKDF2(rsp.salt, 10000, this.password);

        var payload = {
            userName: this.userName,
            hPassword: this.hPassword
        };

        if (this.publicKey && this.ePrivateKey) {
            payload.publicKey = this.publicKey;
            payload.ePrivateKey = this.ePrivateKey;
        }

        return this.sendAjax('POST', API_CONFIG.loginUrl, payload);
    },

    _redirectToApp: function() {
        window.location = '/client/index.html';
    }
});

_.extend(module.exports.prototype, sendAjax);
