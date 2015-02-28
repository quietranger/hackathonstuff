var RecommendationsView = require('../../../src/js/views/recommendations');

var sandbox = require('../../mocks/sandboxMock');
var view = require('../../mocks/viewMock');

describe("The recommendations view", function() {
    var r;

    beforeEach(function() {
        sandbox.setData.and.stub();
        spyOn(RecommendationsView.prototype, 'manageContinueButton');

        r = new RecommendationsView({
            sandbox: sandbox
        });

        r.steps = [ view ];
    });

    it("should listen for item:selected events", function() {
        r.eventBus.trigger('item:selected');

        expect(RecommendationsView.prototype.manageContinueButton).toHaveBeenCalled();
    });

    describe("the render function", function() {
        beforeEach(function() {
            r.steps = [ null, view ];
            r.currentStep = 1;
            r.render();
        });

        it("should render the view at the corresponding step", function() {
            expect(r.currentView.render).toHaveBeenCalled();
            expect(r.currentView.postRender).toHaveBeenCalled();
        });

        it("should activate the correct progress items in the progress bar", function() {
            expect(r.$el.find('ol.state li.active').length).toBe(2);
        });

        it("should mark the continue button as 'done' if rendering the last view", function() {
            expect(r.$el.find('.actions-wrap button').hasClass('continue')).toBe(true);
        });
    });

    describe("the manageContinueButton function", function() {
        beforeEach(function() {
            r.manageContinueButton.and.callThrough();

            r.steps = [ view ];
            r.render();

            r.selectedItemsCount = 0;
        });

        it("should increment the selected items counter if true", function() {
            r.manageContinueButton(true);

            expect(r.selectedItemsCount).toBe(1);
        });

        it("should decrement the selected items counter if false", function() {
            r.selectedItemsCount = 1;
            r.manageContinueButton(false);

            expect(r.selectedItemsCount).toBe(0);
        });

        it("should not let the counter become negative", function() {
            r.manageContinueButton(false);

            expect(r.selectedItemsCount).toBe(0);
        });

        it("should mark the continue button as 'skip' if zero", function() {
            r.manageContinueButton(true);
            r.manageContinueButton(false);

            expect(r.$el.find('.actions-wrap button').hasClass('continue')).toBe(false);
        });

        it("should mark the continue button as continuable if not zero", function() {
            r.manageContinueButton(true);

            expect(r.$el.find('.actions-wrap button').hasClass('continue')).toBe(true);
        });
    });

    describe("the advance function", function() {
        it("should trigger the screen:advancing event", function() {
            spyOn(r.eventBus, 'trigger');

            r.advance();

            expect(r.eventBus.trigger).toHaveBeenCalledWith('screen:advancing');
        });

        it("should hide the modal and store state if on the last step", function() {
            r.advance();

            expect(sandbox.publish).toHaveBeenCalledWith('modal:hide', null, {});
            expect(sandbox.setData).toHaveBeenCalledWith('documents.isOnboarded', true);
        });

        it("should render the next screen if not on the last step", function() {
            r.steps = [ view, view ];

            spyOn(r, 'render').and.callThrough();

            r.render();

            r.advance();

            expect(r.render.calls.count()).toBe(2);
            expect(r.currentStep).toBe(1);
        });

        it("should reset the selectedItemsCount between advances", function() {
            r.steps = [ view, view ];

            r.render();
            r.manageContinueButton(true);
            r.advance();

            expect(r.selectedItemsCount).toBe(0);
        });
    });
});
