var Q = require('q');
var Backbone = require('backbone');
var Symphony = require('symphony-core');

var UserView = require('../../../../../../src/js/views/recommendations/views/items/users/userView');

var sandbox = require('../../../../../mocks/sandboxMock');

describe("The user view", function() {
    var u, q1, q2;

    beforeEach(function() {
        q1 = Q.defer();
        q1.resolve({
            userViewConfigs: [{
                viewId: 3
            }],
            pinnedChats: [{
                threadId: 3
            }]
        });

        q2 = Q.defer();

        spyOn(Symphony.Utils, 'startChat').and.returnValue(q2.promise);

        sandbox.getData.and.returnValue(q1.promise);

        u = new UserView({
            sandbox: sandbox,
            model: new Backbone.Model({
                selected: true,
                id: 2,
                prettyName: 'honk'
            })
        });

        u.userId = 1;
    });

    describe("the didSelectItem method", function() {
        beforeEach(function() {
            sandbox.send.calls.reset();

            spyOn(u.eventBus, 'trigger');
        });

        describe("when selecting", function() {
            beforeEach(function() {
                u.didSelectItem();
            });

            it("should raise the item:selected event", function() {
                expect(u.eventBus.trigger).toHaveBeenCalledWith('item:selected', jasmine.any(Boolean));
            });

            it("should add the follower", function() {
                expect(sandbox.send).toHaveBeenCalledWith({
                    id: 'ADD_FOLLOWING',
                    payload: [{
                        type: 'DEFINITION',
                        definitionType: 'USER_FOLLOW',
                        id: 2,
                        text: 'honk',
                        connectorId: 'lc'
                    }]
                });
            });

            it("should create an IM in the left nav", function() {
                expect(Symphony.Utils.startChat).toHaveBeenCalledWith({
                    sandbox: sandbox,
                    userId: [ 2, 1 ],
                    skipPaint: true
                });
            });
        });

        describe("when deselecting", function() {
            var q3;

            beforeEach(function(done) {
                q3 = Q.defer();
                q3.resolve();

                sandbox.send.and.returnValue(q3.promise);

                u.imThreadId = 3;

                u.model.set('selected', false);

                u.didSelectItem();

                Q.all([ q1.promise, q3.promise ]).done(done);
            });

            it("should remove and close the IM from the left nav", function(done) {
                Q.all([ q1.promise, q3.promise ]).done(function() {
                    expect(sandbox.publish).toHaveBeenCalledWith('view:removed', null, 3);
                    expect(sandbox.publish).toHaveBeenCalledWith('view:close', null, 'im3');

                    done();
                });
            });

            it("should clear the pinned chat out of the data store", function(done) {
                Q.all([ q1.promise, q3.promise ]).done(function() {
                    expect(sandbox.setData).toHaveBeenCalledWith('app.account.userViewConfigs', {
                        viewId: 3,
                        pinnedChat: false
                    });

                    expect(sandbox.setData).toHaveBeenCalledWith('app.account.pinnedChats', []);

                    done();
                });
            });

            it("should unfollow the user", function() {
                expect(sandbox.send).toHaveBeenCalledWith({
                    id: 'DELETE_FOLLOWING',
                    urlExtension: 'lc/2'
                });
            });
        });
    });
});
