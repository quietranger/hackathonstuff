var Q = require('q');

var sandboxMock = require('../../mocks/sandboxMock');

var Transport = require('../../../src/symphony/extensions/transport');

describe("The transport core extension", function() {
    var t, ajax;

    beforeEach(function() {
        ajax = jasmine.createSpyObj('ajax', [ 'doGet', 'doPost', 'doPut', 'doDelete', 'abortRequest' ]);
        t = new Transport(sandboxMock, ajax);
    });

    it("should register the send sandbox method", function() {
        expect(sandboxMock.registerMethod).toHaveBeenCalledWith('send',
            jasmine.any(Function));
    });

    describe("the setCommands function", function() {
        it("should set the internal commands object", function() {
            t.setCommands({ test: true });

            expect(t._commands).toEqual({
                test: true
            });
        });

        it("should not overwrite existing commands", function() {
            t.setCommands({ test: true });
            t.setCommands({ test: false });

            expect(t._commands.test).toBe(true);
        });
    });

    describe("the send function", function() {
        var q;

        beforeEach(function() {
            q = Q.defer();

            t._commands.TEST = {
                url: 'test',
                requestType: 'GET'
            };

            ajax.doGet.and.returnValue(q.promise);
            ajax.doPost.and.returnValue(q.promise);
            ajax.doPut.and.returnValue(q.promise);
            ajax.doDelete.and.returnValue(q.promise);

            spyOn(t, 'trigger');
        });

        function testAjaxCall(fn, type) {
            it("should call the " + fn + " function on " + type + " requests", function(done) {
                q.resolve('test');

                t._commands.TEST.requestType = type;

                t.send({
                    id: 'TEST'
                }).then(function() {
                    expect(ajax[fn]).toHaveBeenCalled();
                    done();
                });
            });
        }

        testAjaxCall('doGet', 'GET');
        testAjaxCall('doPost', 'POST');
        testAjaxCall('doPut', 'PUT');
        testAjaxCall('doDelete', 'DELETE');

        it("should trigger transport:willSendData when sending the request", function() {
            t.send({
                id: 'TEST'
            });

            expect(t.trigger).toHaveBeenCalledWith('transport:willSendData', 'TEST', jasmine.any(Object));
        });
        
        it("should wait for all asyncTransforms if they are given", function(done) {
            var at = Q.defer();

            q.resolve('test');
            at.resolve('transformTest');

            t.send({
                id: 'TEST',
                asyncTransforms: [ at.promise ]
            }).then(function() {
                expect(t.trigger).toHaveBeenCalledWith('transport:didReceiveData', 'TEST', 'test');

                done();
            });
        });

        it("should trigger transport:didReceiveData once requests complete successfully", function(done) {
            q.resolve('test');

            t.send({
                id: 'TEST'
            }).then(function() {
                expect(t.trigger).toHaveBeenCalledWith('transport:didReceiveData', 'TEST', 'test');

                done();
            });
        });

        it("should delegate the abort method to ajax", function() {
            t.send({
                id: 'TEST'
            }).abort();

            expect(ajax.abortRequest).toHaveBeenCalled();
        });
    });
});
