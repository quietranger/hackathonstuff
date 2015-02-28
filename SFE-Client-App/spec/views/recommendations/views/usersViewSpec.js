var Q = require('q');
var Backbone = require('backbone');

var UsersView = require('../../../../src/js/views/recommendations/views/usersView');
var UserView = require('../../../../src/js/views/recommendations/views/items/users/userView');

var sandbox = require('../../../mocks/sandboxMock');

describe("The users view", function() {
    var u, qP, qA;

    beforeEach(function(done) {
        qP = Q.defer();
        qA = Q.defer();

        qP.promise.done(function() {
            done();
        });

        sandbox.getData.and.returnValue(qA.promise);

        sandbox.send.and.callFake(function(opts) {
            if (opts.id === 'GET_PROFILE') {
                return qP.promise;
            } else {
                return Q.defer().promise;
            }
        });

        spyOn(UsersView.prototype, 'destroy');
        spyOn(UsersView.prototype, '_queryRecommendations');
        spyOn(UsersView.prototype, 'render').and.callThrough();

        u = new UsersView({
            sandbox: sandbox
        });

        qA.resolve({
            userName: 1
        });

        qA.promise.done(function() {
            qP.resolve({
                person: {
                    deptName: 'Tech'
                }
            });
        });
    });

    it("should set the department", function(done) {
        qP.promise.done(function() {
            expect(u.department).toBe('Tech');
            done();
        });
    });

    it("should query recommendations", function(done) {
        qP.promise.done(function() {
            expect(UsersView.prototype._queryRecommendations).toHaveBeenCalled();
            done();
        });
    });

    describe("the _queryRecommendations function", function() {
        beforeEach(function() {
            UsersView.prototype._queryRecommendations.and.callThrough();

            u._queryRecommendations();
        });


        it("should get user recommendations", function() {
            expect(sandbox.send).toHaveBeenCalledWith({
                id: 'GET_USER_RECOMMENDATIONS',
                payload: {
                    count: u.perPage,
                    offset: 0,
                    department: null
                }
            });
        });
    });

    it("should listen to the add:bulk event on the collection", function(done) {
        u.usersCollection.trigger('add:bulk');

        qA.promise.done(function() {
            expect(UsersView.prototype.render).toHaveBeenCalled();
            done();
        });
    });

    it("should listen to the screen:advancing event", function() {
        u.eventBus.trigger('screen:advancing');

        expect(UsersView.prototype.destroy).toHaveBeenCalled();
    });

    describe("the render function", function() {
        it("should render users if the collection has users", function(done) {
            spyOn(u, '_renderUsers');

            u.usersCollection.add({}, { silent: true });

            u.render();

            qA.promise.done(function() {
                expect(u._renderUsers).toHaveBeenCalled();
                done();
            });
        });

        it("should show a spinner if the collection doesn't have users", function(done) {
            spyOn(u.spinner, 'spin');

            u.render();

            qA.promise.done(function() {
                expect(u.spinner.spin).toHaveBeenCalled();
                done();
            });
        });
    });

    describe("the didGetUserRecommendations function", function() {
        it("should advance the screen if nothing returned", function() {
            spyOn(u.eventBus, 'trigger');

            u.didGetUserRecommendations({
                count: 0,
                data: []
            });

            expect(u.eventBus.trigger).toHaveBeenCalledWith('screen:advance');
        });
    });

    describe("the seeMore function", function() {
        it("should increment the currentPage and call _queryRecommendations", function() {
            var currentPage = u.currentPage;

            u.seeMore();

            expect(u.currentPage).toBe(currentPage + 1);
            expect(UsersView.prototype._queryRecommendations).toHaveBeenCalled();
        });
    });

    describe("the _renderUsers function", function() {
        it("should bulk render users", function() {
            spyOn(UserView.prototype, 'initialize').and.callThrough();

            u.usersCollection.add([new Backbone.Model()], { silent: true });

            u._renderUsers(u.usersCollection.last(1));

            expect(UserView.prototype.initialize.calls.count()).toBe(1);
            expect(u.childViews.length).toBe(1);
        });
    });
});
