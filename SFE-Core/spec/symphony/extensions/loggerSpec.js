var sandboxMock = require('../../mocks/sandboxMock');

var Logger = require('../../../src/symphony/extensions/logger');

describe("The logger core extension", function() {
    var l;

    beforeEach(function() {
        l = new Logger(sandboxMock, {});
    });

    it("should register the correct sandbox methods", function() {
        _.each(['debug', 'info', 'warn', 'error'], function(item) {
            expect(sandboxMock.registerMethod).toHaveBeenCalledWith(item,
                jasmine.any(Function));
        });
    });
});
