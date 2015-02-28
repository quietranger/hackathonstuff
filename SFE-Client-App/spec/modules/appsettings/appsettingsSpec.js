// test deps
var sandbox = require("../../mocks/sandboxMock");
var accountData = require("../../fixtures/accountData.js");

// 3rd party deps
var Q = require("q");
var _ = require("underscore");

// module deps
var Module = require("../../../src/js/modules/appsettings/views/module.js");


// manage mocks
var mockSandbox = function (empty) {
    var mockAccountData;
    if (empty) {
        mockAccountData = _.clone(accountData);
        mockAccountData.pinnedChats = [];
        mockAccountData.roomParticipations = [];
    } else {
        mockAccountData = accountData;
    }

    sandbox.getData.and.callFake(function (key) {
        var obj = {
            "app.account": {
                q: Q.defer(),
                data: mockAccountData
            }
        };

        var value = obj[key];

        if (!value) {
            value = {
                q: Q.defer(),
                data: null
            };
        }

        value.q.resolve(value.data);
        return value.q.promise;
    });

    sandbox.send.and.returnValue(Q.defer().promise);
};

// spec
describe("APPSETTINGS MODULE", function () {
    var m;

    beforeEach(function () {
        mockSandbox();

        m = new Module({
            sandbox: sandbox
        });

        m.render().postRender();
    });


    describe("the _changeActiveTab function", function() {
        it("should destroy the current activeTabView", function() {
            var spy = jasmine.createSpyObj('view', [ 'destroy' ]);

            m._activeTabView = spy;
            m._changeActiveTab('general');

            expect(spy.destroy).toHaveBeenCalled();
        });

        it("should render the active tab view", function() {
            spyOn(m, '_renderActiveTabView');

            m._changeActiveTab('general');

            expect(m._activeTabView).not.toBeNull();
            expect(m._renderActiveTabView).toHaveBeenCalled();
        });
    });
});