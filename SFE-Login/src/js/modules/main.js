var Backbone = require('backbone');

var API_CONFIG = require('../config/api');

var LoginView = require('./views/loginView');
var ForgotPasswordView = require('./views/forgotPasswordView');
var ResetPasswordView = require('./views/resetPasswordView');

var Spinner = require('spin');

var sendAjax = require('../mixins/sendAjax');

var APPS = {
    ADMIN: 'admin',
    CLIENT: 'user'
};

var SSO_ERROR_CODES = {
    '1': 'No valid SAML assertion found. Please try again.',
    '2': 'SAML validation error. Please contact your administrator.',
    '3': 'SSO is not configured. Please contact your administrator.',
    '4': 'SSO configuration error. Please contact your administrator.',
    '5': 'User does not exist.'
};

var TEST_SSO_SUCCESSFUL = 'SSO is configured properly.';

var Main = function() {
    this.appType = null;
    this.eventBus = _.extend({}, Backbone.Events);
    this.spinner = new Spinner({
        color: '#FFF'
    });
    this.$body = $("body");
    this.$content = $('#content');
    this.view = null;

    this.eventBus.on('error', this.showError.bind(this));
    this.eventBus.on('success', this.showSuccess.bind(this));
    this.eventBus.on('show:forgot-password', this.renderForgotPasswordView.bind(this));
    this.eventBus.on('show:login', this.renderLoginView.bind(this));
    this.eventBus.on('spin:start', this.startSpinner.bind(this));
    this.eventBus.on('spin:stop', this.stopSpinner.bind(this));
};

Main.prototype.start = function() {
    var errorCode = this._getUrlParameter('ErrorCode'),
        successCode = this._getUrlParameter('testSsoSuccess'),
        plId = this._getUrlParameter('plid'),
        userId = this._getUrlParameter('userId');

    if (errorCode) {
        var error =  SSO_ERROR_CODES[errorCode];

        if (!error) {
            error = 'An unknown error occurred.';
        }

        this.eventBus.trigger('error', error);
        return;
    }

    if (successCode) {
        this.eventBus.trigger('success', TEST_SSO_SUCCESSFUL);

        return;
    }

    if (plId && userId) {
        this.renderResetPasswordView(plId, userId);
        return;
    }

    this.eventBus.trigger('spin:start');

    this.appType = window.location.hostname.match(/admin/i) ? APPS.ADMIN : APPS.CLIENT;

    this.sendAjax('GET', API_CONFIG.checkAuthUrl, {
        type: this.appType
    }).then(this._redirectToApp.bind(this), this._didCheckAuth.bind(this));
};

Main.prototype._didCheckAuth = function(rsp) {
    this.spinner.stop();

    if (rsp && rsp.status === 401) {
        var body = rsp.responseJSON,
            authType = body.authenticationType,
            redirectUrl = body.redirectUrl;

        this.renderLoginView(authType, redirectUrl);
    } else {
        this.eventBus.trigger('spin:stop');
        this.eventBus.trigger('error', 'Could not check authentication status. Please try again later.');
    }
};

Main.prototype.renderLoginView = function(authType, redirectUrl) {
    if (redirectUrl === undefined) {
        redirectUrl = null;
    }

    this._renderView('login', {
        authType: authType,
        redirectUrl: redirectUrl
    });
};

Main.prototype.renderForgotPasswordView = function() {
    this._renderView('forgot-password');
};

Main.prototype.renderResetPasswordView = function(plId, userId) {
    this._renderView('reset-password', {
        plId: plId,
        userId: userId
    });
};

Main.prototype._renderView = function(view, opts) {
    opts = opts || {};

    var views = {
        'login': LoginView,
        'forgot-password': ForgotPasswordView,
        'reset-password': ResetPasswordView
    };

    this._resetView();

    this.view = new views[view](_.extend({
        eventBus: this.eventBus
    }, opts));

    this.$body.toggleClass("admin", this.appType === APPS.ADMIN);

    this.view.render().$el.appendTo(this.$content);
};

Main.prototype._redirectToApp = function() {
    this._redirectTo('/client/index.html');
};

Main.prototype._redirectTo = function(url) {
    window.location = url;
};

//https://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
Main.prototype._getUrlParameter = function(name){
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");

    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);

    return results === null ? null : decodeURIComponent(results[1].replace(/\+/g, " "));
};

Main.prototype.showError = function(message) {
    var $error = $('#error');

    if ($error.length === 0) {
        $error = $('<div id="error"></div>').prependTo('#content');
    }

    $error.html(message).show('fast');
};

Main.prototype.showSuccess = function(message) {
    var $success = $('#success'),
        $error = $('#error');

    if ($error.length > 0) {
        $error.fadeOut('fast');
    }

    if ($success.length === 0) {
        $success = $('<div id="success"></div>').prependTo('#content');
    }

    $success.html(message).show('fast');
};

Main.prototype.startSpinner = function() {
    var $spinner = $('<div id="spinner"></div>').appendTo('#content');

    this.spinner.spin($spinner[0]);
};

Main.prototype.stopSpinner = function() {
    this.spinner.stop();
};

Main.prototype._resetView = function() {
    $('#error, #success').remove();

    if (this.view) {
        this.view.remove();
        this.view = null;
    }
};

module.exports = Main;

_.extend(module.exports.prototype, sendAjax);
