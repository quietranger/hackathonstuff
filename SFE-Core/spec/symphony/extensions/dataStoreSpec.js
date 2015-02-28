var Q = require('q');

var sandboxMock = require('../../mocks/sandboxMock');

var DataStore = require('../../../src/symphony/extensions/dataStore');

describe("The dataStore core extension", function () {
    var d;

    beforeEach(function () {
        d = new DataStore({}, sandboxMock, jasmine.createSpyObj('transport', [
            'setCommands',
            'send'
        ]));
    });

    it("should register the correct sandbox methods", function () {
        expect(sandboxMock.registerMethod).toHaveBeenCalledWith('getData',
            jasmine.any(Function));
        expect(sandboxMock.registerMethod).toHaveBeenCalledWith('setData',
            jasmine.any(Function), true);
        expect(sandboxMock.registerMethod).toHaveBeenCalledWith('deleteMessageById',
            jasmine.any(Function), true);
        expect(sandboxMock.registerMethod).toHaveBeenCalledWith('deleteMessagesByStream',
            jasmine.any(Function), true);
    });

    describe('the upsertMessages function', function () {
        it('should do nothing if the streamId is undefined', function () {
            d.upsertMessages(undefined, [{text: 'test message'}], true);

            expect(d.messages).toEqual({});
        });
    });

    describe("the getHydratedSupportedMimeTypes function", function () {
        var q;

        beforeEach(function () {
            q = Q.defer();

            d.transport.send.and.returnValue(q.promise);
        });

        it("should return the cached values if they exist", function (done) {
            var exp = d.supportedMimeTypes = ['honk'];

            d.getHydratedSupportedMimeTypes().then(function (rsp) {
                expect(d.transport.send).not.toHaveBeenCalled();
                expect(rsp).toBe(exp);

                done();
            });
        });

        it("should set the internal cache to whatever the backend sends", function (done) {
            var exp = ['honk'];

            q.resolve({
                supportedMimeTypes: exp
            });

            d.getHydratedSupportedMimeTypes().then(function (rsp) {
                expect(rsp).toBe(exp);
                done();
            });
        });

        it("should set the value to an empty array on error", function (done) {
            q.reject();

            d.getHydratedSupportedMimeTypes().then(function (rsp) {
                expect(rsp).toEqual([]);
                done();
            });
        });
    });
});

