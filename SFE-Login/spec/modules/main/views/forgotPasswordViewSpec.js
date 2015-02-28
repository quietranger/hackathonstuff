var Q = require('q');
var Backbone = require('backbone');

var ForgotPasswordView = require('../../../../src/js/modules/views/forgotPasswordView');

describe("The forgot password view", function() {
    var f, q, $email;

    beforeEach(function() {
        q = Q.defer();

        global.captchaLoaded = true;
        global.grecaptcha = jasmine.createSpyObj('recaptcha', [ 'render', 'getResponse' ]);

        spyOn(ForgotPasswordView.prototype, '_didResetPassword');

        f = new ForgotPasswordView({
            eventBus: _.extend({}, Backbone.Events)
        });

        spyOn(f, '_renderCaptcha');

        f.render().$el.appendTo('body');

        $email = f.$el.find('#email');

        spyOn(f.eventBus, 'trigger');
        spyOn(f, 'sendAjax').and.returnValue(q.promise);
    });

    describe("the render function", function() {
        it("should render a captcha", function() {
            expect(f._renderCaptcha).toHaveBeenCalled();
        });

        it("should render a captcha when the captchaDidLoad event is raised", function() {
            f.captchaLoaded = false;

            f._renderCaptcha.calls.reset();
            f.render();

            $(document).trigger('captchaDidLoad');

            expect(f._renderCaptcha).toHaveBeenCalled();
        });
    });

    describe("the resetPassword function", function() {
        beforeEach(function() {
            global.grecaptcha.getResponse.and.returnValue('key');
        });

        it("should raise an error if the email is empty", function() {
            f.resetPassword({
                preventDefault: $.noop
            });

            expect(f.eventBus.trigger).toHaveBeenCalledWith('error', jasmine.any(String));
        });

        it("should send a reset password request if an e-mail is present", function() {
            $email.val('test@example.com');

            f.resetPassword({
                preventDefault: $.noop
            });

            expect(f.sendAjax).toHaveBeenCalledWith('POST', jasmine.any(String), {
                email: 'test@example.com',
                'g-recaptcha-response': 'key'
            });
        });

        describe("when the backend returns with data", function() {
            beforeEach(function() {
                $email.val('test@example.com');

                f.resetPassword({
                    preventDefault: $.noop
                });
            });

            it("should call _didResetPassword when the backend responds successfully", function(done) {
                q.resolve();

                q.promise.done(function() {
                    expect(ForgotPasswordView.prototype._didResetPassword).toHaveBeenCalled();
                    done();
                });
            });

            it("should trigger an error if the there is an error", function(done) {
                q.reject();

                q.promise.fail(function() {
                    expect(f.eventBus.trigger).toHaveBeenCalledWith('error', jasmine.any(String));
                    done();
                });
            });
        });
    });

    describe("the showLogin function", function() {
        it("should trigger the show:login event", function() {
            f.showLogin();

            expect(f.eventBus.trigger).toHaveBeenCalledWith('show:login');
        });
    });

    describe("the _renderCaptcha function", function() {
        beforeEach(function() {
            f._renderCaptcha.and.callThrough();

            f._renderCaptcha();
        });

        it("should render a captcha", function() {
            expect(global.grecaptcha.render).toHaveBeenCalled();
        });
    });
});