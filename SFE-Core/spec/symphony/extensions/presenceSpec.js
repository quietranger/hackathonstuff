var sandboxMock = require('../../mocks/sandboxMock');

var Presence = require('../../../src/symphony/extensions/presence');

describe("The presence core extension", function() {
    var p;

    beforeEach(function() {
        p = new Presence(sandboxMock, {});
    });

    it("should register the correct sandbox methods", function() {
        expect(sandboxMock.registerMethod).toHaveBeenCalledWith('getPresenceForId',
            jasmine.any(Function), true);
    });
});
