var Q = require('q');

var FilterBuilder = require('../../src/js/utils/filterBuilder');

var sandbox = require('../mocks/sandboxMock');

describe("The filter builder utility", function() {
    var f, expReq;

    beforeEach(function () {
        f = new FilterBuilder({
            sandbox: sandbox,
            userId: 1,
            operator: 'ANY',
            name: 'Test Filter'
        });

        expReq = {
            payload: {
                ruleGroup: {
                    rules: [{
                        text: '#test1',
                        id: '#test1',
                        connectorId: 'lc',
                        definitionType: 'KEYWORD',
                        type: 'DEFINITION'
                    }, {
                        text: '#test2',
                        id: '#test2',
                        connectorId: 'lc',
                        definitionType: 'KEYWORD',
                        type: 'DEFINITION'
                    }], operator: 'ANY', type: 'GROUP'
                },
                userId: 1,
                name: 'Test Filter',
                filterType: 'FILTER'
            }
        };
    });

    describe("adding rules", function () {
        it("should return false if the rules are invalid", function () {
            var invalids = [
                {
                    text: '',
                    id: ' whatever',
                    connectorId: 'lc'
                },
                {
                    text: '%no',
                    id: '&no',
                    connectorId: 'lc'
                },
                {
                    text: '#cool',
                    id: '#cool',
                    connectorId: ''
                }
            ];

            for (var i = 0; i < invalids.length; i++) {
                var invalid = invalids[i];

                expect(f.addRule(invalid)).toBe(false);
            }
        });

        it("should return true if the rules are valid", function () {
            var valid = {
                text: '#cool',
                id: '#cool',
                connectorId: 'lc'
            };

            expect(f.addRule(valid)).toBe(true);
        });
    });

    var sendQ;

    function setUpFilter(id, done) {
        var q1;

        q1 = Q.defer();
        sendQ = Q.defer();

        sandbox.getData.and.returnValue(q1.promise);
        sandbox.send.and.returnValue(sendQ.promise);

        q1.resolve([
            {
                filterType: 'KEYWORD',
                ruleGroup: {
                    rules: [{
                        id: '#test1',
                        text: '#test1',
                        connectorId: 'lc'
                    }]
                }
            },
            {

                filterType: 'FOLLOWING',
                ruleGroup: {
                    rules: [{
                        id: 2,
                        text: '@test1',
                        connectorId: 'lc'
                    }]
                }
            }
        ]);

        sendQ.resolve({});

        f.addRule({
            id: '#test1',
            text: '#test1',
            connectorId: 'lc'
        });

        f.addRule({
            id: '#test2',
            text: '#test2',
            connectorId: 'lc'
        });

        if (id) {
            f.id = id;
        }

        f.save().done(done);
    }

    describe("saving the filter", function () {
        beforeEach(function (done) {
            setUpFilter(null, done);
        });

        it("should create the filter", function () {
            expect(sandbox.send).toHaveBeenCalledWith(_.extend(expReq, {
                id: 'CREATE_FILTER'
            }));
        });
    });

    describe("updating a filter", function () {
        beforeEach(function (done) {
            setUpFilter(1, done);
        });

        it("should update the filter", function () {
            expect(sandbox.send).toHaveBeenCalledWith(_.extend(expReq, {
                id: 'UPDATE_FILTER',
                urlExtension: '1'
            }));
        });
    });

    describe("deleting a filter", function() {
        beforeEach(function(done) {
            setUpFilter(1, done);

            f.delete();
        });

        it("should delete the filter", function() {
            expect(sandbox.send).toHaveBeenCalledWith({
                id: 'DELETE_FILTER',
                urlExtension: '1'
            });
        });

        it("should set the id to null", function(done) {
            sendQ.promise.then(function() {
                expect(f.id).toBeNull();

                done();
            });
        });

        it("should throw if called without an id", function() {
            expect(function() {
                f.id = null;
                f.delete();
            }).toThrow();
        });
    });
});