var Sandbox = require('../../../src/symphony/sandbox');

describe("The sandbox core extension", function() {
    var s;

    beforeEach(function() {
        spyOn(Sandbox.prototype, "subscribe").and.callThrough();

        s = new Sandbox();
    });

    describe("the registerMethod method", function() {
        it("should throw if the name is invalid", function() {
            expect(function() {
                s.registerMethod(undefined, $.noop);
            }).toThrow();

            expect(function() {
                s.registerMethod({}, $.noop);
            }).toThrow();
        });

        it("should throw if no method is passed", function() {
            expect(function() {
                s.registerMethod('test');
            }).toThrow();
        });

        it("should throw if an existing name is passed", function() {
            expect(function() {
                s.registerMethod('subscribe', $.noop);
            }).toThrow();
        });

        it("should add passed-in functions to the sandbox object", function() {
            s.registerMethod('test', $.noop);

            expect(s.test).toBe($.noop);
        });

        it("should wrap async functions in a promise", function(done) {
            var fn = function() {
                return 'test';
            };

            s.registerMethod('test', fn, true);

            s.test().then(function(ret) {
                expect(ret).toBe('test');
                done();
            });
        });
    });

    it("subscribes to app:kill", function() {
      expect(Sandbox.prototype.subscribe).toHaveBeenCalledWith("app:kill", jasmine.any(Function));
    });

    it("sets the kill flag to true on app kill", function() {
      s.publish("app:kill");
      expect(s.killed).toBe(true);
    });
});
