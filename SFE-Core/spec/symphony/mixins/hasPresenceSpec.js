var Q = require('q');
var Sandbox = require('../../mocks/sandboxMock');
var Subscribable = require('../../../src/symphony/mixins/subscribable');
var HasPresence = require('../../../src/symphony/mixins/hasPresence');
var PrefixEvents = require('../../../src/symphony/utils/prefixEvents');

describe('The presence mixin', function() {
    var inst, $presenceEl = $('<span class="has-presence presence-indicator presence presence-text" data-userid="slippm">' +
        '</span>');

    beforeEach(function() {
        Sandbox.subscribe.calls.reset();

        var el = document.createElement('div');

        var Obj = $.noop;
        Obj.prototype.el = el;
        Obj.prototype.$el = $(el);
        Obj.prototype.sandbox = Sandbox;

        $.extend(true, Obj.prototype, Subscribable, HasPresence);

        inst = new Obj();
    });

    describe('when initialized', function() {
        var changeArgs;
        beforeEach(function() {
            spyOn(inst, 'subscribeAll').and.callThrough();
            spyOn(PrefixEvents, 'addPrefixEvent').and.callThrough();

            changeArgs = { slippm: { className: 'busy', pretty: 'Busy' } };

            inst.initPresence();
        });

        it('should subscribe to all psEvents', function() {
            expect(inst.subscribeAll).toHaveBeenCalledWith(inst._presencePsEvents);
        });

        it('should add the required prefix events', function() {
            expect(PrefixEvents.addPrefixEvent).toHaveBeenCalledWith(inst.el, 'AnimationStart', jasmine.any(Function));
        });

        it('should create the throttled request function', function() {
            expect(inst.throttledPresenceReq).not.toBeUndefined();
        });

        describe('and a presence element is added', function() {
            var q;

            beforeEach(function(done) {
                q = Q.defer();

                spyOn(inst, 'throttledPresenceReq').and.callThrough();
                spyOn(inst, 'presenceDidChange').and.callThrough();
                spyOn(inst, '_pushPresenceUser').and.callThrough();

                Sandbox.getPresenceForId.and.returnValue(q.promise);

                inst.el.addEventListener('webkitAnimationStart', done, false);
                inst.$el.appendTo('body').append($presenceEl);
            });

            it('should push the user into presence tracking', function() {
                expect(inst._pushPresenceUser).toHaveBeenCalledWith('slippm');
            });

            it('should call the throttled presence request', function() {
                expect(inst.throttledPresenceReq).toHaveBeenCalled();
            });

            it('should get the presence info for that user id', function(done) {
                q.resolve(changeArgs);

                setTimeout(function() {
                    expect(Sandbox.getPresenceForId).toHaveBeenCalledWith(['slippm']);

                    q.promise.done(function() {
                        expect(inst.presenceDidChange).toHaveBeenCalledWith(null, changeArgs);
                        done();
                    });
                }, 251);
            });
        });

        describe('and presence changes', function() {
            beforeEach(function() {
                inst.$el.appendTo('body').append($presenceEl);

                inst.presenceDidChange(null, changeArgs);
            });

            it('should apply the appropriate class', function() {
                expect($presenceEl.hasClass('presence-busy')).toBe(true);
            });

            it('should apply the appropriate text', function() {
                expect($presenceEl.text()).toBe('Busy');
            });
        });
    });

    describe('when presence ids are requested', function() {
        beforeEach(function() {
            inst.initPresence();
            inst._presenceUsers = ['test'];
            inst._presenceUsersMap = { test: true };
            inst.$el.append($presenceEl);

            spyOn(inst, 'throttledPresenceReq').and.callThrough();
            spyOn(inst, '_pushPresenceUser').and.callThrough();

            inst.presenceDidRequestIds();
        });

        it('should replace the presence tracking data', function() {
            expect(inst._presenceUsers).toEqual(['slippm']);
            expect(inst._presenceUsersMap).toEqual({slippm: true});
        });

        it('should request presence', function() {
            expect(inst.throttledPresenceReq).toHaveBeenCalled();
        });

        it('should push presence users', function() {
            expect(inst._pushPresenceUser).toHaveBeenCalledWith('slippm');
        });
    });

    describe('the _pushPresenceUser function', function() {
        beforeEach(function() {
            inst._pushPresenceUser('slippm');
        });

        it('should add the userId to the _presenceUsers array', function() {
            expect(inst._presenceUsers).toEqual(['slippm']);
        });

        it('should add the userId to the _presenceUsersMap map', function() {
            expect(inst._presenceUsersMap.slippm).not.toBeUndefined();
        });
    });

    describe('when destroyed', function() {
        beforeEach(function() {
            spyOn(PrefixEvents, 'removePrefixEvent').and.callThrough();
            spyOn(inst, 'unsubscribeAll').and.callThrough();

            inst.destroyPresence();
        });

        it('should unsubscribe from all psEvents', function() {
            expect(inst.unsubscribeAll).toHaveBeenCalledWith(inst._presencePsEvents);
        });

        it('should remove all prefix events', function() {
            expect(PrefixEvents.removePrefixEvent).toHaveBeenCalledWith(inst.el, 'AnimationStart',
                inst._presenceElementAdded);
        });

        it('should erase all internal tracking data structures', function() {
            expect(inst._presenceUsers).toEqual([]);
            expect(inst._presenceUsersMap).toEqual({});
        });
    });
});
