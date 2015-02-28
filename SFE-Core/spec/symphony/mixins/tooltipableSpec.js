var Tooltip = require('tooltip');
var Tooltipable = require('../../../src/symphony/mixins/tooltipable');

describe('The tooltipable mixin', function() {
    var inst, $tooltip;

    beforeEach(function() {
        var Obj = $.noop;
        Obj.prototype.$el = $('<div>' +
            '<a data-tooltip="testing" data-tooltip-position="top center">Testing</a>' +
            '</div>');
        $.extend(true, Obj.prototype, Tooltipable);

        inst = new Obj();
        inst.initTooltips();
        $tooltip = inst.$el.find('[data-tooltip]');
    });

    it('should attach tooltips to all elements with data-tooltip', function() {
        expect($tooltip.data('_tooltip')).not.toBeUndefined();
    });

    it('should only attach tooltips to elements once', function() {
        var old = $tooltip.data('_tooltip');

        inst.initTooltips();
        expect($tooltip.data('_tooltip')).toBe(old);
    });

    it('should overwrite tooltips on init if destroy is true', function() {
        var old = $tooltip.data('_tooltip');

        inst.initTooltips(true);
        expect($tooltip.data('_tooltip')).not.toBe(old);
    });

    describe('on destroy', function() {
        var tooltipInst;

        beforeEach(function() {
            tooltipInst = $tooltip.data('_tooltip');
            spyOn(tooltipInst, 'destroy').and.callThrough();

            inst.destroyTooltips();
        });

        it('should clear all tooltips on destroy', function() {
            expect(tooltipInst.destroy).toHaveBeenCalled();
            expect($tooltip.data('_tooltip')).toBeNull();
        });

        it('should do nothing to already destroyed tooltips', function() {
            expect(function() {
                inst.destroyTooltips();
            }).not.toThrowError();
        });
    });
});
