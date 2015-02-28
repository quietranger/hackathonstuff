var Symphony = require('symphony-core');
var Backbone = require('backbone');
var Q = require('q');

var SpinnerView = require('../../../../src/js/modules/common/spinner');

var sandbox = require('../../../mocks/sandboxMock');

describe("The spinner view", function() {
    var s, q, oldThemeConfig;

    beforeEach(function(done) {
        q = Q.defer();
        oldThemeConfig = Symphony.Config.THEMES;

        sandbox.getData.and.returnValue(q.promise);

        Symphony.Config.THEMES = [{
            key: 'testTheme',
            config: {
                spinnerColor: '#f00'
            }
        }];

        s = new SpinnerView({
            sandbox: sandbox,
            eventBus: _.extend({}, Backbone.Events)
        });

        s.render();

        q.promise.finally(done);

        q.resolve({
            config: {
                activeTheme: 'testTheme'
            }
        });
    });

    it("should set the spinner to the themed color", function() {
        expect(s.opts.spinnerOpts.color).toBe('#f00');
    });

    it("should show a spinner", function() {
        expect(s.$el.is(':empty')).toBe(false);
    });

    it("should hide the spinner once stop() is called", function() {
        s.stop();

        expect(s.$el.is(':empty')).toBe(true);
    });

    describe("when destroyed", function() {
        beforeEach(function() {
            s.destroy();
        });

        it("should hide the spinner", function() {
            expect(s.$el.is(':empty')).toBe(true);
        });

        it("should null the _spinner variable for GC", function() {
            expect(s._spinner).toBeNull();
        });
    });

    afterEach(function() {
        Symphony.Config.THEMES = oldThemeConfig;
    });
});