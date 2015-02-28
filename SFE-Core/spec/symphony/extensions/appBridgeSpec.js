var sandboxMock = require('../../mocks/sandboxMock');

var AppBridge = require('../../../src/symphony/extensions/appBridge');

describe("The appBridge core extension", function() {
    var a;

    beforeEach(function() {
        a = new AppBridge(sandbox, {});
    });

    it("should register the isRunningInClientApp sandbox method", function() {
        expect(sandboxMock.registerMethod).toHaveBeenCalledWith('isRunningInClientApp',
            jasmine.any(Function), true);
    });
});
