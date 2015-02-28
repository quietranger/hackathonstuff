var SandboxFloat = require('../../../src/js/lib/symphony/sandboxFloat');

var Q = require('q');

describe("The sandbox float core extension", function() {
    var s, core;

    beforeEach(function() {
        core = {
            opts: {
                floaterId: 0
            }
        };

        s = new SandboxFloat(core);

        s.promises[0] = Q.defer();
    });

    describe("the _didReceiveMessage callback", function() {
        var e;

        beforeEach(function() {
            spyOn(s.publishLocally, 'apply');

            e = {
                data: {
                    data: null,
                    method: 'send',
                    messageId: 0,
                    windowIdent: 0
                }
            };
        });

        it("should publish pubsub event locally", function() {
            e.data.method = 'pubsub';

            s._didReceiveMessage(e);

            expect(s.publishLocally.apply).toHaveBeenCalledWith(s, e.data.data);
        });

        it("should ignore non-pubsub requests to other windows", function() {
            e.data.windowIdent = 1;

            spyOn(s.promises[0], 'reject');
            spyOn(s.promises[0], 'resolve');

            s._didReceiveMessage(e);

            expect(s.promises[0].reject).not.toHaveBeenCalled();
            expect(s.promises[0].resolve).not.toHaveBeenCalled();
        });

        describe("when an exception is posted", function() {
            beforeEach(function() {
                e.data.method = 'exception';

                spyOn(s.promises[0], 'reject');
            });

            it("should parse JSON data", function() {
                var obj = {};
                e.data.data = '{}';

                s._didReceiveMessage(e);

                expect(s.promises[0].reject).toHaveBeenCalledWith(obj);
            });

            it("should send string data", function() {
                var msg = 'error';

                e.data.data = msg;

                s._didReceiveMessage(e);

                expect(s.promises[0].reject).toHaveBeenCalledWith(msg);
            });
        });

        it("should resolve non-exceptions", function() {
            e.data.data = 'data';

            spyOn(s.promises[0], 'resolve');

            s._didReceiveMessage(e);

            expect(s.promises[0].resolve).toHaveBeenCalledWith('data');
        });
    });
});
