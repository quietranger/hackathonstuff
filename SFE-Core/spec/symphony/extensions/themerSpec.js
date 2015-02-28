var Q = require('q');

var Themer = require('../../../../src/js/lib/symphony/extensions/themer');

var sandbox = require('../../../mocks/sandboxMock');

describe("The themer extension", function() {
    var themer;

    beforeEach(function() {
        themer = new Themer({ sandbox: sandbox });
    });

    describe("when instantiated", function() {
        it("should throw an error if instantiated without a sandbox instance", function() {
            expect(function() {
                /*jshint nonew: false*/
                new Themer();
            }).toThrow();
        });

        it("should subscribe to the theme:changed event", function() {
            expect(sandbox.subscribe).toHaveBeenCalledWith('theme:changed', jasmine.any(Function));
        });
    });

    describe("when the theme changes", function() {
        var q = Q.defer(),
            config = { activeTheme: 'dark' };

        beforeEach(function() {
            spyOn(themer, '_saveTheme');
            sandbox.getData.and.returnValue(q.promise);
            q.resolve(config);

            themer.themeDidChange(null, 'dark');
        });

        afterEach(function() {
            $('head link').remove();
        });

        it("should add the link tag to the document head", function(done) {
            q.promise.done(function() {
                expect($('head link')[0]).toBe(themer.$linkTag[0]);
                done();
            });
        });

        it("should remove any old link tags in the document head", function(done) {
            var d = Q.defer();

            sandbox.getData.and.returnValue(d.promise);
            d.resolve(config);

            themer.themeDidChange(null, 'light');

            d.promise.done(function() {
                expect($('head link').length).toBe(1);
                expect($('head link')[0]).toBe(themer.$linkTag[0]);
                done();
            });
        });

        it("should save the new active theme", function(done) {
            q.promise.done(function() {
                expect(themer._saveTheme).toHaveBeenCalledWith(config, 'dark');
                done();
            });
        });
    });

    describe("when saving the new active theme", function() {
        it("should do nothing if the active theme is the passed in theme", function() {
            themer._saveTheme({ activeTheme: 'dark' }, 'dark');

            expect(sandbox.setData).not.toHaveBeenCalled();
        });

        it('should set the data via the sandbox', function() {
            var config = { activeTheme: 'dark' },
                theme = 'light';

            themer._saveTheme(config, theme);

            expect(config.activeTheme).toBe(theme);
            expect(sandbox.setData).toHaveBeenCalledWith('app.account.config', config);
        });
    });
});
