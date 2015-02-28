var Backbone = require('backbone');
var Q = require('q');

var sandbox = require('../mocks/sandboxMock');
var SymphonyView = require('../../src/symphony').View;
var Subscribable = require('../../src/symphony/mixins/subscribable');
var HasPresence = require('../../src/symphony/mixins/hasPresence');

describe('A Symphony view', function() {
    var view, defer;

    beforeEach(function() {
        defer = Q.defer();
        sandbox.getData.and.returnValue(defer.promise);

        spyOn(SymphonyView.prototype, 'subscribeAll');
        spyOn(SymphonyView.prototype, 'initPresence');

        view = new SymphonyView({
            sandbox: sandbox
        });
    });

    it('should throw an error if instantiated without a sandbox', function() {
        expect(function() {
            new SymphonyView();
        }).toThrowError();
    });

    it('should always have an eventBus instance', function() {
        var eventBus = _.extend({}, Backbone.Events);

        expect(view.eventBus).not.toBeUndefined();

        var view2 = new SymphonyView({
            sandbox: sandbox,
            eventBus: eventBus
        });

        expect(view2.eventBus).toBe(eventBus);
    });

    it('should have a postRender function', function() {
        expect(view.postRender).toEqual(jasmine.any(Function));
    });

    it('should by default require account data', function() {
        expect(view.requiresAccountData).toBe(true);
    });

    it('should merge the default events with events', function() {
        expect(view.events).toEqual(view.defaultEvents); //same props
        expect(view.events).not.toBe(view.defaultEvents); //different object
    });

    it('should merge the default psEvents with psEvents', function() {
        expect(view.psEvents).toEqual(view.defaultPsEvents);
        expect(view.psEvents).not.toBe(view.defaultPsEvents);
    });

    it('should subscribe to all psEvents', function() {
        expect(view.subscribeAll).toHaveBeenCalledWith(view.psEvents);
    });

    it('should initialize presence', function() {
        expect(view.initPresence).toHaveBeenCalled();
    });

    describe('and account data is required', function() {
        it('should set the account data promise', function() {
            expect(view.accountDataPromise).toBe(defer.promise);
        });

        it('should get account data from the sandbox', function() {
            expect(view.sandbox.getData).toHaveBeenCalledWith('app.account');
        });

        describe('when rendered', function() {
            var rsp;

            beforeEach(function(done) {
                rsp = {};

                spyOn(SymphonyView.prototype, 'render').and.callThrough();
                spyOn(SymphonyView.prototype, 'postRender').and.callThrough();

                view = new SymphonyView({
                    sandbox: sandbox
                });

                spyOn(view.eventBus, 'trigger').and.callThrough();

                view.render().postRender();

                defer.resolve(rsp);

                view.accountDataPromise.done(done);
            });

            it('should return itself', function() {
                expect(view.render()).toBe(view);
            });

            it('should trigger the view:post-rendered event', function() {
                expect(view.eventBus.trigger).toHaveBeenCalledWith('view:post-rendered', view);
            });

            it('should trigger the view:rendered event', function() {
                expect(view.eventBus.trigger).toHaveBeenCalledWith('view:rendered', view);
            });

            it('should set the isRendered property to true', function() {
                expect(view.isRendered).toBe(true);
            });

            it('should wrap the render and postRender functions with the account data promise', function() {
                expect(SymphonyView.prototype.render).toHaveBeenCalledWith(rsp);
                expect(SymphonyView.prototype.postRender).toHaveBeenCalledWith(rsp);
            });
        });
    });

    describe('when destroyed', function() {
        beforeEach(function() {
            spyOn(view, 'remove');
            spyOn(view, 'unsubscribeAll');
            spyOn(view, 'destroyPresence');

            view.destroy();
        });

        it('should remove itself', function() {
            expect(view.remove).toHaveBeenCalled();
        });

        it('should unsubscribe from all psEvents', function() {
            expect(view.unsubscribeAll).toHaveBeenCalled();
        });

        it('should destroy presence', function() {
            expect(view.destroyPresence).toHaveBeenCalled();
        });
    });
});
