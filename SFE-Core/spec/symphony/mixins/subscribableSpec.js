var sandbox = require('../../mocks/sandboxMock');

var subscribable = require('../../../src/symphony/mixins/subscribable');

describe('The susbcribable mixin', function() {
    var inst, events1;

    beforeEach(function() {
        sandbox.subscribe.calls.reset();

        var Obj = $.noop;
        Obj.prototype.sandbox = sandbox;
        Obj.prototype.test1 = $.noop;
        Obj.prototype.test4 = 'non-function';
        $.extend(true, Obj.prototype, subscribable);

        inst = new Obj();
    });

    describe('when subscribing new PubSub handlers', function() {
        beforeEach(function() {
            events1 = {
                'test1': 'test1',
                'test2': $.noop
            };

            inst.subscribeAll(events1);
        });

        it('should subscribe to the appropriate sandbox events', function() {
            //subscribable binds the function, so have to use jasmine.any
            expect(inst.sandbox.subscribe).toHaveBeenCalledWith('test1', jasmine.any(Function));
            expect(inst.sandbox.subscribe).toHaveBeenCalledWith('test2', events1.test2);
            expect(inst.sandbox.subscribe.calls.count()).toBe(2);
        });

        it('should throw an error when string handlers do not correspond to a method', function() {
            expect(function() {
                inst.subscribeAll({
                    'test3': 'nonexistent'
                }).toThrowError();
            });
        });

        it('should add events to the _subscribed map', function() {
            expect(_.keys(inst._subscribed).length).toBe(2);
        });

        it('should not subscribe to something twice', function() {
            inst.sandbox.subscribe.calls.reset();

            inst.subscribeAll({
                'test1': $.noop
            });

            expect(inst.sandbox.subscribe.calls.count()).toBe(0);
            expect(_.keys(inst._subscribed).length).toEqual(2);
        });
    });

    describe('when unsubscribing from PubSub handlers', function() {
        beforeEach(function() {
            inst.sandbox.unsubscribe.calls.reset();

            events1 = {
                'test1': 'test1',
                'test2': $.noop
            };

            inst.subscribeAll(events1);
            inst.unsubscribeAll(events1);
        });
        
        it('should unsubscribe from the appropriate events', function() {
            expect(inst.sandbox.unsubscribe).toHaveBeenCalledWith('test1', jasmine.any(Function));
            expect(inst.sandbox.unsubscribe).toHaveBeenCalledWith('test2', events1.test2);
            expect(inst.sandbox.unsubscribe.calls.count()).toBe(2);
        });

        it('should remove events from the _subscribed map', function() {
            expect(_.keys(inst._subscribed).length).toBe(0);
        });

        it('should not remove events twice', function() {
            inst.sandbox.unsubscribe.calls.reset();

            inst.unsubscribeAll({
                'test1': $.noop
            });

            expect(inst.sandbox.unsubscribe.calls.count()).toBe(0);
        });
    });
});
