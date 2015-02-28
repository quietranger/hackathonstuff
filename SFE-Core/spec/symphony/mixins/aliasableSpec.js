var Q = require('q');

var Aliasable = require('../../../src/symphony/mixins/aliasable');
var PrefixEvents = require('../../../src/symphony/utils/prefixEvents');

var Sandbox = require('../../mocks/sandboxMock');

describe('The Aliasable mixin', function() {
    var inst, $aliasable;

    beforeEach(function() {
        spyOn(PrefixEvents, 'addPrefixEvent').and.callThrough();

        $aliasable = $('<div class="aliasable" data-userid="slippm">' +
            'Slipper, Matt JA [Tech]</div>');

        var el = document.createElement('div'),
            $el = $(el);

        var Obj = $.noop;
        Obj.prototype.el = el;
        Obj.prototype.$el = $el;
        Obj.prototype.sandbox = Sandbox;
        $.extend(true, Obj.prototype, Aliasable);

        inst = new Obj();
    });

    describe('when initialized', function() {
        beforeEach(function() {
            inst.initAliases();
        });

        it('should add prefix events on AnimationStart', function() {
            expect(PrefixEvents.addPrefixEvent).toHaveBeenCalledWith(
                inst.el, 'AnimationStart', inst._boundAliasableAdded);
        });
    });

    describe('when an aliasable is added', function() {
        var listener, d;
        beforeEach(function(done) {
            d = Q.defer();
            listener = done;

            Sandbox.getData.and.returnValue(d.promise);
            spyOn(inst, 'aliasableAdded').and.callThrough();
            spyOn(inst, '_updateAliasElement').and.callThrough();

            inst.$el.appendTo('body');

            inst.initAliases();

            inst.$el.append($aliasable);

            //only webkit needed since we test in Chrome Karma
            inst.el.addEventListener('webkitAnimationStart', listener, false);
        });

        afterEach(function() {
            $(inst.el).remove();
            inst.el.removeEventListener('webkitAnimationStart', listener, false);
        });

        it('should trigger the animation event', function() {
            expect(inst.aliasableAdded).toHaveBeenCalled();
        });

        it('should add the user id of the alias to the internal cache', function() {
            expect(inst._aliasedUsers).toEqual(['slippm']);
        });

        it('should replace the text with the alias', function(done) {
            d.resolve({
                alias: 'Testing'
            });

            d.promise.done(function() {
                expect(inst._updateAliasElement).toHaveBeenCalled();
                done();
            });
        });

        it('should replace the text of the sub-alias with the alias', function(done) {
            inst._updateAliasElement.calls.reset();

            var $aliasable2 = $('<div class="aliasable" data-userid="slippm">' +
                '<span class="subalias">Slipper, Matt JA [Tech]</span></div>');

            inst.$el.append($aliasable2);

            inst.el.addEventListener('webkitAnimationStart', function() {
                d.resolve({
                    alias: 'Testing'
                });

                d.promise.done(function() {
                    expect(inst._updateAliasElement).toHaveBeenCalled();
                    done();
                });
            }, false);
        });
    });

    describe('when updating all aliases', function(done) {
        var d = Q.defer();

        beforeEach(function(done) {
            spyOn(inst, '_updateAliasElement').and.callThrough();

            Sandbox.send.and.returnValue(d.promise);

            inst.$el.appendTo('body');
            inst.initAliases();
            inst.$el.append($aliasable);
            inst.el.addEventListener('webkitAnimationStart', function() {
                inst._updateAliasElement.calls.reset();
                inst.updateAliases([{
                    userId: 'slippm',
                    alias: null
                }, {
                    userId: 'slippm',
                    alias: 'Testing'
                }, {
                    userId: 'nonexistent',
                    alias: null
                }]);

                done();
            }, false);
        });

        it('should ignore userIds that are not in the aliasedUsers array', function() {
            //once since one is ignored and the other requires a promise resolution
            expect(inst._updateAliasElement.calls.count()).toBe(1);
        });

        it('resolve the user on the backend if the alias is null', function(done) {
            inst._updateAliasElement.calls.reset();

            d.resolve([{
                prettyName: 'Testing'
            }]);

            d.promise.done(function() {
                expect(inst._updateAliasElement).toHaveBeenCalled();

                done();
            });
        });
    });

    describe('when updating alias elements', function() {
        it('should replace the text with the alias', function() {
            inst._updateAliasElement($aliasable, 'Testing');

            expect($aliasable.text()).toBe('Testing');
        });

        it('should replace the text of the sub-alias with the alias', function() {
            var $aliasable2 = $('<div class="aliasable" data-userid="slippm">' +
                '<span class="subalias">Slipper, Matt JA [Tech]</span></div>');

            inst._updateAliasElement($aliasable2, 'Testing');

            expect($aliasable2.find('.subalias').text()).toBe('Testing');
        });
    });

    describe('when destroying alias elements', function() {
        beforeEach(function() {
            spyOn(PrefixEvents, 'removePrefixEvent').and.callThrough();

            inst.destroyAliases();
        });

        it('should empty the _aliasedUsers cache', function() {
            expect(inst._aliasedUsers).toEqual([]);
        });

        it('should unbind the AnimationStart prefix event', function() {
            expect(PrefixEvents.removePrefixEvent).toHaveBeenCalled();
        });
    });
});
