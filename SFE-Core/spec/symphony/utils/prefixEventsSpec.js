var PrefixEvents = require('../../../src/symphony/utils/prefixEvents');

describe('The prefixEvents utility', function() {
    var element, cb, type = 'Test';

    beforeEach(function() {
        element = document.createElement('div');
        cb = $.noop;

        spyOn(element, 'addEventListener').and.callThrough();
        spyOn(element, 'removeEventListener').and.callThrough();
    });

    it('should add the required prefixed events', function() {
        PrefixEvents.addPrefixEvent(element, type, cb);

        expect(element.addEventListener.calls.count()).toBe(5);
        expect(element.addEventListener.calls.allArgs()).toEqual([
            ['webkitTest', cb, false],
            ['mozTest', cb, false],
            ['MSTest', cb, false],
            ['oTest', cb, false],
            ['test', cb, false]
        ]);
    });

    it('should remove the required prefix events', function() {
        PrefixEvents.addPrefixEvent(element, type, cb);
        PrefixEvents.removePrefixEvent(element, type, cb);

        expect(element.removeEventListener.calls.count()).toBe(5);
        expect(element.removeEventListener.calls.allArgs()).toEqual([
            ['webkitTest', cb],
            ['mozTest', cb],
            ['MSTest', cb],
            ['oTest', cb],
            ['test', cb]
        ]);
    });
});
