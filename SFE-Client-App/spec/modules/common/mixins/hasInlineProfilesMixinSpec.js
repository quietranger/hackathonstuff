var Symphony = require('symphony-core');
var Backbone = require('backbone');
var HasInlineProfiles = require('../../../../src/js/modules/common/mixins/hasInlineProfiles');
var InlineProfileView = require('../../../../src/js/modules/common/inlineProfile');
var Popover = require('../../../../src/js/modules/common/popover');

var sandboxMock = require('../../../mocks/sandboxMock');

var MockView = Symphony.View.extend({
    requiresAccountData: false,

    initialize: function() {
        this.initInlineProfiles();

        Symphony.View.prototype.initialize.apply(this, arguments);
    },

    render: function() {
        var str = '';

        for (var i = 0; i < 11; i++) {
            str += '<a class="has-hover-profile" data-usertype="tw" data-userid="' + i + '">Testing!</a>';
        }

        this.$el.html(str);

        return Symphony.View.prototype.render.apply(this, arguments);
    },

    destroy: function() {
        this.destroyInlineProfiles();

        return Symphony.View.prototype.destroy.apply(this, arguments);
    }
});

describe("The has inline profiles mixin", function() {
    var inst, $allTargets, $target1, $target2;

    beforeEach(function() {
        jasmine.clock().install();

        spyOn(Popover.prototype, 'destroy');
        spyOn(InlineProfileView.prototype, 'initialize');
        spyOn(InlineProfileView.prototype, 'destroy');
        spyOn(InlineProfileView.prototype, 'render').and.returnValue({
            el: {}
        });

        _.extend(MockView.prototype, HasInlineProfiles);

        inst = new MockView({
            sandbox: sandboxMock,
            eventBus: _.extend({}, Backbone.Events)
        });
        inst.render();
        inst.$el.appendTo('body');

        $allTargets = inst.$el.find('.has-hover-profile');

        $target1 = $allTargets.eq(0);
        $target2 = $allTargets.eq(1);
    });

    describe("initialization", function() {
        it("should listen for the correct events", function() {
            $target1.trigger('mouseenter');

            jasmine.clock().tick(251);

            expect(InlineProfileView.prototype.render).toHaveBeenCalled();

            $target1.trigger('mouseout');

            expect(Popover.prototype.destroy).toHaveBeenCalledWith(true);
        });
    });
    
    describe("showing an inline profile", function() {
        beforeEach(function() {
            InlineProfileView.prototype.initialize.calls.reset();
            InlineProfileView.prototype.destroy.calls.reset();
        });

        it("should only instantiate one inline profile per user ID", function() {
            _.times(2, function() {
                $target1.trigger('mouseenter');
                jasmine.clock().tick(251);
                $target1.trigger('mouseout');

                $target2.trigger('mouseenter');
                jasmine.clock().tick(251);
                $target2.trigger('mouseout');
            });

            expect(InlineProfileView.prototype.initialize.calls.count()).toBe(1);
        });

        it("should destroy the last view in the cache if more than ten are instantiated", function() {
            $allTargets.each(function() {
                var $target = $(this);

                $target.trigger('mouseenter');
                jasmine.clock().tick(251);
                $target.trigger('mouseout');
            });

            expect(InlineProfileView.prototype.destroy.calls.count()).toBe(1);
        });
    });

    describe("hiding an inline profile", function() {
        beforeEach(function() {
            spyOn(window, 'clearTimeout');
        });

        it("should clear the timeout", function() {
            spyOn(window, 'setTimeout').and.returnValue(1);

            $target1.trigger('mouseenter');
            $target1.trigger('mouseout');

            expect(window.clearTimeout).toHaveBeenCalledWith(1);
        });

        it("should hide the current inline profile", function() {
            $target1.trigger('mouseenter');
            jasmine.clock().tick(251);
            $target1.trigger('mouseout');

            expect(Popover.prototype.destroy).toHaveBeenCalledWith(true);
        });
    });

    afterEach(function() {
        jasmine.clock().uninstall();
        inst.remove();
    });
});