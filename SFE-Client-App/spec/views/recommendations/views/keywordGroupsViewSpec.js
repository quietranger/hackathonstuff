var Q = require('q');
var Backbone = require('backbone');

var KeywordGroupsView = require('../../../../src/js/views/recommendations/views/keywordGroupsView');
var KeywordGroupView = require('../../../../src/js/views/recommendations/views/items/keywordGroups/keywordGroupView');

var FilterBuilder = require('../../../../src/js/utils/filterBuilder');

var sandbox = require('../../../mocks/sandboxMock');

describe("The keyword groups view", function() {
    var k, q0, q1;

    beforeEach(function(done) {
        q0 = Q.defer();
        q1 = Q.defer();

        spyOn(KeywordGroupsView.prototype, 'render').and.callThrough();

        sandbox.getData.and.returnValue(q0.promise);
        sandbox.send.and.returnValue(q1.promise);

        k = new KeywordGroupsView({
            sandbox: sandbox
        });

        q0.resolve({
            socialConnectors: [ 'tw' ],
            userName: 1
        });

        q1.resolve();

        Q.all([ q0.promise, q1.promise ]).done(done);
    });

    it("should get recommendations", function() {
        expect(sandbox.send).toHaveBeenCalledWith({
            id: 'GET_KEYWORD_GROUP_RECOMMENDATIONS'
        });
    });

    describe("the render function", function() {
        it("should render users if the collection has keyword groups", function(done) {
            spyOn(k, '_renderKeywordGroups');

            k.keywordGroupsCollection.add({}, { silent: true });

            k.render();

            q0.promise.done(function() {
                expect(k._renderKeywordGroups).toHaveBeenCalled();
                done();
            });
        });
    });

    describe("the didGetKeywordGroupRecommendations function", function() {
        it("should advance the screen if nothing returned", function() {
            spyOn(k.eventBus, 'trigger');

            k.didGetKeywordGroupRecommendations({
                count: 0,
                data: []
            });

            expect(k.eventBus.trigger).toHaveBeenCalledWith('screen:advance');
        });

        it("should raise a reset event if users are returned", function(done) {
            k.didGetKeywordGroupRecommendations({
                count: 2,
                data: [ {}, {} ]
            });

            q0.promise.done(function() {
                expect(KeywordGroupsView.prototype.render).toHaveBeenCalled();
                done();
            });
        });
    });

    describe("the _renderKeywordGroups function", function() {
        it("should render keyword groups", function() {
            spyOn(KeywordGroupView.prototype, 'initialize').and.callThrough();

            k.keywordGroupsCollection.add([{
                topic: 'test',
                name: 'test',
                keywords: [
                    '#honk',
                    '#beep'
                ]
            }]);

            k._renderKeywordGroups();

            expect(KeywordGroupView.prototype.initialize.calls.count()).toBe(1);
            expect(k.childViews.length).toBe(1);
        });
    });

    describe("when a keyword group is selected", function() {
        var model, q2;

        beforeEach(function() {
            q2 = Q.defer();

            spyOn(FilterBuilder.prototype, 'save').and.returnValue(q2.promise);
            spyOn(FilterBuilder.prototype, 'addRule');

            model = new Backbone.Model({
                topic: 'honk',
                keywords: [ '#honk' ]
            });

            k.keywordGroupsCollection.add(model);

            k.socialConnectors = [ 'lc', 'tw' ];

            model.set('selected', true);
        });

        it("should create the filter if it does not exist", function(done) {
            expect(FilterBuilder.prototype.save).toHaveBeenCalled();
            expect(FilterBuilder.prototype.addRule).toHaveBeenCalledWith({
                text: '#honk',
                id: '#honk',
                connectorId: 'tw'
            });
            expect(FilterBuilder.prototype.addRule).toHaveBeenCalledWith({
                text: '#honk',
                id: '#honk',
                connectorId: 'lc'
            });

            done();
        });

        it("should update the filter if it does exist", function(done) {
            FilterBuilder.prototype.addRule.calls.reset();

            q2.resolve({
                _id: 1,
                ruleGroup: {
                    rules: [{
                        id: '#honk'
                    }]
                }
            });

            q2.promise.done(function() {
                var model2 = new Backbone.Model({
                    topic: 'honk',
                    keywords: [ '#beep' ]
                });

                k.keywordGroupsCollection.add(model2);

                model2.set('selected', true);

                expect(FilterBuilder.prototype.save).toHaveBeenCalled();

                _.each([ 'tw', 'lc' ], function(connector) {
                    expect(FilterBuilder.prototype.addRule).toHaveBeenCalledWith({
                        text: '#honk',
                        id: '#honk',
                        connectorId: connector
                    });
                    expect(FilterBuilder.prototype.addRule).toHaveBeenCalledWith({
                        text: '#beep',
                        id: '#beep',
                        connectorId: connector
                    });
                });

                done();
            });
        });

        it("should delete the filter if all keywords are deselected", function(done) {
            q2.resolve({
                _id: 1,
                ruleGroup: {
                    rules: [{
                        id: '#honk'
                    }]
                }
            });

            q2.promise.done(function() {
                model.set('selected', false);

                expect(sandbox.send).toHaveBeenCalledWith({
                    id: 'DELETE_FILTER',
                    urlExtension: '1'
                });

                done();
            });
        });
    });
});
