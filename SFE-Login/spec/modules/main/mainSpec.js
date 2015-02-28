var Q = require('q');

var Main = require('../../../src/js/modules/main');

describe("The main module", function() {
    var m, q;

    beforeEach(function() {
        q = Q.defer();
        m = new Main();

        spyOn(m, 'sendAjax').and.returnValue(q.promise);
        spyOn(m.eventBus, 'trigger');
    });

    describe("the start function", function() {
        it("should show an error if the ssoErrorCode URL parameter is set", function() {
            spyOn(m, '_getUrlParameter').and.returnValue('1');

            m.start();

            expect(m.eventBus.trigger).toHaveBeenCalledWith('error', jasmine.any(String));
        });

        it("should show a message if the testSsoSuccess parameter is set", function() {
            spyOn(m, '_getUrlParameter').and.callFake(function(param) {
                if (param === 'testSsoSuccess') {
                    return 'true';
                } else {
                    return;
                }
            });

            m.start();

            expect(m.eventBus.trigger).toHaveBeenCalledWith('success', jasmine.any(String));
        });

        it("should check auth", function() {
            m.start();

            expect(m.sendAjax).toHaveBeenCalledWith('GET', jasmine.any(String), {
                type: 'user'
            });
        });
    });

    describe("the _didCheckAuth function", function() {
        beforeEach(function() {
            spyOn(m, 'renderLoginView');
        });

        describe("when the response is 401", function() {
            it("should render the login view if authenticationType is password", function() {
                m._didCheckAuth({
                    status: 401,
                    responseJSON: {
                        authenticationType: 'password'
                    }
                });

                expect(m.renderLoginView).toHaveBeenCalled();
            });

            it("should render the login view if the authenticationType is SSO", function() {
                m._didCheckAuth({
                    status: 401,
                    responseJSON: {
                        authenticationType: 'sso',
                        redirectUrl: 'test'
                    }
                });

                expect(m.renderLoginView).toHaveBeenCalledWith('sso', 'test');
            });
        });

        describe("when the response is not 401", function() {
            it("should show an error", function() {
                spyOn(m.spinner, 'stop');

                m._didCheckAuth({
                    status: 500
                });

                expect(m.spinner.stop).toHaveBeenCalled();
                expect(m.eventBus.trigger).toHaveBeenCalledWith('error', jasmine.any(String));
            });
        });
    });

    describe("the renderLoginView/renderForgotPasswordView functions", function() {
        beforeEach(function() {
            spyOn(m, '_renderView');
        });

        it("the renderLoginView function should call _renderView appropriately", function() {
            m.renderLoginView('password');

            expect(m._renderView).toHaveBeenCalledWith('login', {
                authType: 'password',
                redirectUrl: null
            });
        });

        it("the renderForgotPasswordView function should call _renderView appropriately", function() {
            m.renderForgotPasswordView();

            expect(m._renderView).toHaveBeenCalledWith('forgot-password');
        });
    });

    describe("the showError function", function() {
        var message;

        beforeEach(function() {
            $('<div id="error"></div>').appendTo('body');
        });

        it("should add a message to the error div", function() {
            message = 'test';

            m.showError(message);

            expect($('#error').html()).toBe(message);
        });
    });

    describe("the showSuccess function", function() {
        var message;

        beforeEach(function() {
            $('<div id="success"></div>').appendTo('body');
        });

        it("should add a message to the success div", function() {
            message = 'test';

            m.showSuccess(message);

            expect($('#error').html()).toBe(message);
        });
    });

    describe("the _resetView function", function() {
        beforeEach(function() {
            m.view = jasmine.createSpyObj('view', [ 'remove' ]);
        });

        it("should remove the current view and null it", function() {
            var oldView = m.view;

            m._resetView();

            expect(oldView.remove).toHaveBeenCalled();
            expect(m.view).toBeNull();
        });
    });
});
