var sandboxMock = require('../mocks/sandboxMock');
var Core = require('../../src/symphony/core');

describe("The core", function() {
    var c;

    beforeEach(function() {
        c = new Core({});
    });

    describe("the registerExtension function", function() {
        it("should fail if an invalid name is passed", function() {
            expect(function() {
                c.registerExtension();
            }).toThrow();

            expect(function() {
                c.registerExtension({});
            }).toThrow();
        });

        it("should throw if an extension by the passed name already exists", function() {
            c._extensions.test = {};
            expect(function() {
                c.registerExtension('test', {});
            }).toThrow();
        });

        it("should throw if the dependency does not exist", function() {
            expect(function() {
                c.registerExtension('test', function(derp) {});
            }).toThrow();
        });

        it("should instantiate the passed in function with dependencies as arguments", function() {
            var dep1 = {},
                innerSpy = jasmine.createSpy('innerSpy'),
                injectee1 = jasmine.createSpy('injectee').and.callThrough(),
                injectee2 = function(dep1) { innerSpy.apply(this, arguments); };

            c._extensions.dep1 = dep1;
            c.registerExtension('injectee1', injectee1);
            c.registerExtension('injectee2', injectee2);

            expect(injectee1).toHaveBeenCalled();
            expect(innerSpy).toHaveBeenCalledWith(dep1);
        });
    });

    describe("the getExtension function", function() {
        var ext = {};

        beforeEach(function() {
            c._extensions.test = ext;
        });

        it("should return the passed in extension", function() {
            expect(c.getExtension('test')).toBe(ext);
        });
    });
});
