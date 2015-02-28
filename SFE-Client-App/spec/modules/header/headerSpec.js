var Header = require('../../../src/js/modules/header/views/view');

var sandbox = require('../../mocks/sandboxMock');

describe("The header module", function() {
    var h;

    beforeEach(function() {
        $('<div id="header"></div>').appendTo('body');

        h = new Header({
            sandbox: sandbox,
            viewId: 123
        });
    });

    describe("the logOut function", function() {
        beforeEach(function() {
            spyOn(h, '_redirectToLogin');

            document.cookie = 'skey=honk;path=/;domain=.symphony.com';

            h.logOut();
        });

        it("should clear the skey cookie", function() {
            expect(document.cookie).toBe('');
        });

        it("should redirect to the login page", function() {
            expect(h._redirectToLogin).toHaveBeenCalled();
        });
    });
});