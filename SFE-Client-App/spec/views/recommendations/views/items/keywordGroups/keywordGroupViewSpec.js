var Q = require('q');
var Backbone = require('backbone');

var KeywordGroupView = require('../../../../../../src/js/views/recommendations/views/items/keywordGroups/keywordGroupView');

var sandbox = require('../../../../../mocks/sandboxMock');

var FilterBuilder = require('../../../../../../src/js/utils/filterBuilder');

describe("The keyword group view", function() {
    var k;

    beforeEach(function() {
        k = new KeywordGroupView({
            sandbox: sandbox,
            model: new Backbone.Model({
                selected: true,
                keywords: [ 'honk', 'beep' ]
            })
        });

        spyOn(k.eventBus, 'trigger');
    });

    describe("when selected", function() {
        var q;

        beforeEach(function() {
            q = Q.defer();

            spyOn(FilterBuilder.prototype, 'save').and.returnValue(q.promise);

            k.didSelectItem();
        });

        it("should raise the item:selected event", function() {
            expect(k.eventBus.trigger).toHaveBeenCalledWith('item:selected', true);
        });
    });

    describe("when deselected", function() {
        beforeEach(function() {
            k.model.set('selected', false, { silent: true });

            k.didSelectItem();
        });

        it("should raise the item:selected event", function() {
            expect(k.eventBus.trigger).toHaveBeenCalledWith('item:selected', false);
        });
    });
});
