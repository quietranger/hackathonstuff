var Ajax = require('../../../src/symphony/extensions/ajax');

var sandbox = require('../../mocks/sandboxMock');

describe("The ajax extension", function() {
    var a;

    beforeEach(function() {
        a = new Ajax({
            sandbox: sandbox
        });
    });

    describe("the abortRequest function", function() {
        it("should abort requests if they exist", function() {
            var req = jasmine.createSpyObj('request', [ 'abort' ]);

            a.requests[1] = req;

            a.abortRequest(1);

            expect(req.abort).toHaveBeenCalled();
            expect(a.requests[1]).toBeUndefined();
        });
    });

    describe("when a request is passed a jsonRoot", function() {
        it("should create a request with the jsonRoot as a form parameter and stringified json as the value", function() {
            spyOn($, 'ajax');

            var payload = {
                test: 'hello'
            };

            a.makeRequest({
                jsonRoot: 'honk',
                payload: payload
            });

            expect($.ajax.calls.mostRecent().args[0].data).toEqual({
                honk: JSON.stringify(payload)
            });
        });
    });

    describe("when a request is passed a payloadType of json", function() {
        it("should stringify the payload", function() {
            spyOn($, 'ajax');

            var payload = {
                test: 'hello'
            };

            a.makeRequest({
                payloadType: 'json',
                payload: payload
            });

            expect($.ajax.calls.mostRecent().args[0].data).toEqual(JSON.stringify(payload));
        });
    });

    describe("when a request is passed extra ajaxOpts", function() {
        it("should add them to the ajax options passed to jQuery", function() {
            spyOn($, 'ajax');

            var ajaxOpts = {
                test: 'test'
            };

            a.makeRequest({
                ajaxOpts: ajaxOpts
            });

            expect(_.keys($.ajax.calls.mostRecent().args[0])).toContain('test');
        });
    });

    describe("when a request is passed an onProgress callback", function() {
        it("should set the proper xhr properties", function() {
            spyOn($, 'ajax');

            var onProgress = $.noop;

            a.makeRequest({
                onProgress: onProgress
            });

            expect($.ajax.calls.mostRecent().args[0].xhr().upload.onprogress).toBe(onProgress);
        });
    });
});