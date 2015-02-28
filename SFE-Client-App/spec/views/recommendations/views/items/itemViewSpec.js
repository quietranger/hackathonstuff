var Q = require('q');

var Backbone = require('backbone');

var ItemView = require('../../../../../src/js/views/recommendations/views/items/itemView');

var sandbox = require('../../../../mocks/sandboxMock');

describe("The base item view", function() {
    var v, q;

    beforeEach(function() {
        q = Q.defer();

        q.resolve();

        spyOn(ItemView.prototype, 'render').and.callThrough();
        spyOn(ItemView.prototype, 'didSelectItem');

        sandbox.getData.and.returnValue(q.promise);

        v = new ItemView({
            sandbox: sandbox,
            model: new Backbone.Model({
                selected: false
            })
        });
    });

    it("should re-render on model selection change", function(done) {
        v.model.trigger('change:selected');

        q.promise.done(function() {
            expect(ItemView.prototype.render).toHaveBeenCalled();
            done();
        });
    });

    it("should call didSelectItem on model selection change", function() {
        v.model.trigger('change:selected');

        expect(ItemView.prototype.didSelectItem).toHaveBeenCalled();
    });

    describe("toggleSelected", function() {
        it("should flip the model property", function() {
            spyOn(_, 'throttle').and.callFake(function(cb) {
                cb();
            });

            v.toggleSelected();

            expect(v.model.get('selected')).toBe(true);
        });
    });
});
