var Backbone = require('backbone');

var BaseStaticFilterSettingsView = require('../../../../src/js/modules/common/baseStaticFilterSettings');

var errors = require('../../../../src/js/config/errors');

var sandbox = require('../../../mocks/sandboxMock');

describe("The base static filter settings view", function() {
    var b;

    beforeEach(function() {
        b = new BaseStaticFilterSettingsView({
            eventBus: _.extend({}, Backbone.Events),
            sandbox: sandbox,
            streamId: _.uniqueId(),
            ruleType: 'keywords'
        });

        b.render().postRender();
    });

    describe("the addEntity function", function() {
        beforeEach(function() {
            spyOn(b, 'showErrorMessage');
        });

        describe("and ruleType is keywords", function() {
            it("should show an error if the entity contains special characters", function() {
                b.$el.find('#entity-input').val('$$billyall');

                b.addEntity();

                expect(b.showErrorMessage.calls.mostRecent().args[0]).toBe(errors.COMMON.BASE_STATIC_FILTER.ADD_ENTITY.INVALID);
            });
        });
    });
});