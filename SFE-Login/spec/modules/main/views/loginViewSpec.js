var Q = require('q');
var Backbone = require('backbone');
var CryptoLib = require('symphony-cryptolib');

var LoginView = require('../../../../src/js/modules/views/loginView');

describe('The login view', function() {
    var m, q;
    
    beforeEach(function() {
        q = Q.defer();

        m = new LoginView({
            eventBus: _.extend({}, Backbone.Events)
        });

        m.render().$el.appendTo('body');

        spyOn(m.eventBus, 'trigger');
        spyOn(m, 'sendAjax').and.returnValue(q.promise);
    });
    
    describe("the validateLogin function", function() {
        var e;

        beforeEach(function() {
            e = {
                preventDefault: function() {}
            };

            spyOn(m, 'performLogin');
        });

        it("should show an error if the username is empty", function() {
            m.validateLogin(e);

            expect(m.eventBus.trigger).toHaveBeenCalledWith('error', jasmine.any(String));
        });

        it("should show an error if the password is empty", function() {
            $('#username').val('test');

            m.validateLogin(e);

            expect(m.eventBus.trigger).toHaveBeenCalledWith('error', jasmine.any(String));
        });

        it("should perform the login if validation passes", function() {
            $('#username').val('test');
            $('#password').val('test');

            m.validateLogin(e);

            expect(m.performLogin).toHaveBeenCalled();
        });
    });

    describe("the showForgotPassword function", function() {
        it("should trigger the show:forgot-password event", function() {
            m.showForgotPassword({
                preventDefault: $.noop
            });

            expect(m.eventBus.trigger).toHaveBeenCalledWith('show:forgot-password');
        });
    });

    describe("the _sendLogin function", function() {
        beforeEach(function() {
            spyOn(CryptoLib, 'PBKDF2').and.returnValue('test');

            m.userName = 'test';

            window.onbeforeunload = null;
        });

        it("should throw if called without arguments or hPassword", function() {
            expect(function() {
                m._sendLogin();
            }).toThrow();
        });

        it("should hash the password if called with rsp", function() {
            m._sendLogin({
                salt: 'testSalt'
            });

            expect(CryptoLib.PBKDF2).toHaveBeenCalled();
        });
    });
});