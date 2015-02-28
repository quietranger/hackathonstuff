var Q = require('q');
var CryptoLib = require('symphony-cryptolib');

var ResetPasswordView = require('../../../../src/js/modules/views/resetPasswordView.js');

describe("The reset password view", function() {
    var r, q;

    beforeEach(function() {
        q = Q.defer();

        spyOn(sessionStorage, 'getItem').and.returnValue('testPem');
        spyOn(ResetPasswordView.prototype, 'sendAjax').and.returnValue(q.promise);
        spyOn(ResetPasswordView.prototype, '_getPlIdDidFail');

        r = new ResetPasswordView({
            plId: 'plId',
            userId: 'matt',
            eventBus: jasmine.createSpyObj('eventBus', [ 'trigger' ])
        });

        r.eventBus.trigger.calls.reset();
    });

    it("should raise an error if instantiated without a plId and userId", function() {
        expect(function() {
            new ResetPasswordView();
        }).toThrow();
    });

    describe("after verifying the plId", function() {
        it("should set hasCheckedPlId to true and render when successful", function(done) {
            spyOn(r, 'render');

            q.resolve();

            q.promise.done(function() {
                expect(r.hasCheckedPlId).toBe(true);
                expect(r.render).toHaveBeenCalled();

                done();
            });
        });

        it("should call _getPlIdDidFail on error", function(done) {
            q.reject();

            q.promise.fail(function() {
                expect(ResetPasswordView.prototype._getPlIdDidFail).toHaveBeenCalled();

                done();
            });
        });
    });

    describe("the render function", function() {
        it("should start the spinner if hasCheckedPlId is false", function() {
            r.render();

            expect(r.eventBus.trigger).toHaveBeenCalledWith('spin:start');
        });

        it("should stop the spinner if hasCheckedPlId is true", function() {
            r.hasCheckedPlId = true;
            r.render();

            expect(r.eventBus.trigger).toHaveBeenCalledWith('spin:stop');
        });
    });

    describe("the resetPassword function", function() {
        beforeEach(function() {
            spyOn(r, 'validate').and.returnValue(true);
            spyOn(CryptoLib, 'PBKDF2').and.returnValue('hash');
            spyOn(CryptoLib.Utils, 'bits2b64').and.returnValue('salt');
            spyOn(ResetPasswordView.prototype, '_resetDidFail');
            spyOn(ResetPasswordView.prototype, '_resetDidSucceed');

            r.resetPassword({
                preventDefault: $.noop
            });
        });

        it("should validate", function() {
            expect(r.validate).toHaveBeenCalled();
        });

        it("should send a password reset request with all required values", function() {
            expect(ResetPasswordView.prototype.sendAjax).toHaveBeenCalledWith('POST', jasmine.any(String), {
                salt: 'salt',
                hPassword: 'hash',
                plid: 'plId',
                userId: 'matt'
            });
        });

        describe("when the backend sends data", function() {
            it("should call _resetDidSuccess on success", function(done) {
                q.resolve();

                q.promise.done(function() {
                    expect(ResetPasswordView.prototype._resetDidSucceed).toHaveBeenCalled();

                    done();
                });
            });

            it("should call _resetDidFail on failure", function(done) {
                q.reject();

                q.promise.fail(function() {
                    expect(ResetPasswordView.prototype._resetDidFail).toHaveBeenCalled();

                    done();
                });
            });
        });
    });

    describe("the validate function", function() {
        var validPassword = 'testingtestingtesting1A#';

        it("should return true when passwords are ok", function() {
            r.password = r.passwordConfirmation = validPassword;

            expect(r.validate()).toBe(true);
        });

        it("should trigger an error when the password don't match", function() {
            r.password = validPassword;
            r.passwordConfirmation = validPassword + 'test';

            expect(r.validate()).toBe(false);
            expect(r.eventBus.trigger).toHaveBeenCalledWith('error', jasmine.any(String));
        });

        it("should trigger an error when the passwords are empty", function() {
            expect(r.validate()).toBe(false);
            expect(r.eventBus.trigger).toHaveBeenCalledWith('error', jasmine.any(String));
        });

        it("should trigger an error when the password does not match the Symphony standard", function() {
            r.password = r.passwordConfirmation = 'test';
            spyOn(r, '_validatePassword').and.returnValue(false);

            expect(r.validate()).toBe(false);
            expect(r.eventBus.trigger).toHaveBeenCalledWith('error', jasmine.any(String));
        });
    });

    describe("the _validatePassword function", function() {
        it("should work on 3 of 4 character classes", function() {
            var tests = ['HONK!3456789012', 'honk!PADTOFIFTEEN', '1234567890!!!!h' ];

            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];

                r.password = test;

                expect(r._validatePassword()).toBe(true);
            }
        });

        it("should not work if less than 3 character classes are included", function() {
            var test = 'honk12345678901';

            r.password = test;

            expect(r._validatePassword()).toBe(false);
        });

        it("should ensure password are 15 characters in length", function() {
            var test = 'honk!123456789';

            r.password = test;

            expect(r._validatePassword()).toBe(false);
        });
    });

    describe("the returnToReset function", function() {
        it("should show the reset page", function() {
            r.returnToForgot();

            expect(r.eventBus.trigger).toHaveBeenCalledWith('show:forgot-password');
        });
    });

    describe("the _getPlIdDidFail function", function() {
        beforeEach(function() {
            ResetPasswordView.prototype._getPlIdDidFail.and.callThrough();

            r._getPlIdDidFail();
        });

        it("should stop the spinner", function() {
            expect(r.eventBus.trigger).toHaveBeenCalledWith('spin:stop');
        });

        it("should trigger an error", function() {
            expect(r.eventBus.trigger).toHaveBeenCalledWith('error', jasmine.any(String));
        });
    });

    describe("the _resetDidSucceed function", function() {
        beforeEach(function() {
            r._resetDidSucceed();
        });

        it("should show a success message", function() {
            expect(r.eventBus.trigger).toHaveBeenCalledWith('success', jasmine.any(String));
        });

        it("should show the login form", function() {
            expect(r.eventBus.trigger).toHaveBeenCalledWith('show:login');
        });
    });

    describe("the _resetDidFail function", function() {
        it("should trigger an error", function() {
            r._resetDidFail();

            expect(r.eventBus.trigger).toHaveBeenCalledWith('error', jasmine.any(String));
        });
    });
});