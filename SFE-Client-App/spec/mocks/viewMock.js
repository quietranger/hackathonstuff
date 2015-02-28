module.exports = function() {
    var spy = jasmine.createSpyObj('view', [ 'render', 'postRender', 'destroy' ]),
        self = this;

    this.render = spy.render.and.callFake(function() {
        return self;
    });

    this.postRender = spy.postRender.and.callFake(function() {
        return self;
    });

    this.destroy = spy.destroy;

    this.$el = $();
};
