var Backbone = require('backbone');

var viewTmpl = require('./templates/useragreement.handlebars');
var Q = require('q');
var showErrorMessage = require('../common/mixins/showErrorMessage');
var Handlebars = require("hbsfy/runtime");
var welcomeTmpl = require('../welcomeTour/templates/welcome.handlebars');
var errors = require('../../config/errors');

module.exports = Backbone.View.extend({
    className: 'useragreement',
    sizeX: 12,
    sizeY: 8,
    events: {
        'click .submit': 'submit'
    },
    initialize: function (opts) {
        this.opts = opts || {};
        if (this.opts.acct.oneTimeUAPromptRequired) {
            this.key = this.opts.acct.oneTimeUAKey;
            this.legal_message = this.opts.acct.oneTimeUANotice;
        } else {
            this.key = 'STARTUP_LEGAL_NOTICE';
            this.legal_message = this.opts.acct.startupLegalNotice;
        }
        this.legal_message = new Handlebars.SafeString(this.legal_message);
    },
    render: function () {
        this.$el.html(viewTmpl({
            text: this.legal_message
        }));
        return this;
    },
    submit: function () {
        var self = this;
        this.opts.sandbox.send({
            'id': 'LEGAL_NOTICE',
            'payload': {
                "action": "useracknowledge",
                "key": self.key
            }
        }).then(function () {
            self.opts.callback();
            self.close();
            self.sandbox.publish('modal:show', null, {
                closable: false,
                contentView: new welcomeTmpl(),
                isFlat: true
            });
        }, function () {
            self.opts.sandbox.error(errors.USER_AGREEMENT.ERROR);
            self.showErrorMessage(errors.USER_AGREEMENT.ERROR);
        });
    },
    close: function () {
        this.opts.sandbox.publish('modal:hide');
    },
    exportJson: function () {
        return _.extend({}, {
            module: 'useragreement',
            sizeX: this.sizeX,
            sizeY: this.sizeY
        });
    }

});
_.extend(module.exports.prototype, showErrorMessage);