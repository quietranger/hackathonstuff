var Backbone = require('backbone');

var RoomView = require('../../../src/js/modules/search/views/roomView');

var sandbox = require('../../mocks/sandboxMock');

describe("The advanced search room result view", function() {
    var r;

    beforeEach(function() {
        r = new RoomView({
            sandbox: sandbox,
            eventBus: _.extend({}, Backbone.Events),
            model: new Backbone.Model()
        });
    });

    describe("the joinOrOpenRoom function", function() {
        it("should open rooms to which the user belongs", function() {
            spyOn(r, 'openRoom');

            r.model.set('isMember', true);
            r.joinOrOpenRoom();

            expect(r.openRoom).toHaveBeenCalled();
        });

        it("should join public rooms to which the user does not belong", function() {
            spyOn(r, 'joinRoom');

            r.model.set('publicRoom', true);
            r.joinOrOpenRoom();

            expect(r.joinRoom).toHaveBeenCalled();
        });
    });
});