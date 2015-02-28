// test deps
var sandbox = jasmine.createSpyObj('sandbox', [ 'subscribe', 'unsubscribe', 'publish', 'getData', 'setData',
    'isRunningInClientApp', 'send', 'getPresenceForId', 'isFloatingWindow' ]);// inline this to prevent this test from polluting others
var accountData = require("../../../fixtures/accountData.js");

// 3rd party deps
var Q = require("q");

// module deps
var General = require("../../../../src/js/modules/appsettings/views/tabs/general.js");

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
            "app.account.config": {
                q: Q.defer(),
                data: mockAccountData.config
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

    sandbox.setData.and.callFake(function (key, value) {
        var q = Q.defer();
        key = key.replace("app.account.", "");
        var keys = key.split(".");
        var lastKey = keys.pop();

        var data = accountData;
        keys.forEach(function (k, i, arr) {
            if (!data[k]) {
                data = null;
                return;
            }

            data = data[k];
        });

        if (data === undefined || data === null) {
            q.resolve({status: "error"});
        } else {
            data[lastKey] = value;
            q.resolve({status: "OK"});
        }

        return value.q.promise;
    });

    sandbox.send.and.returnValue(Q.defer().promise);
};

// spec
describe("APPSETTINGS MODULE: GENERAL TAB", function () {

    var m;
    beforeEach(function () {
        mockSandbox();
        m = new General({
            sandbox: sandbox
        });

    });

    describe("the toggleShow24HrTime function", function() {
        var q;

        beforeEach(function() {
            q = Q.defer();

            spyOn(m, '_persistUpdate').and.returnValue(q.promise);

            m._toggleShow24HrTime({
                currentTarget: {
                    checked: true
                }
            });
        });

        it("should persist the show 24 hour time setting", function() {
            expect(m._persistUpdate).toHaveBeenCalledWith('app.account.config.show24HrTime', true);
        });

        it("should update the body style", function(done) {
            q.resolve(true);
            q.promise.then(function() {
                expect(sandbox.publish).toHaveBeenCalledWith('bodyStyle', null, {
                    method: 'show24HrTime',
                    choice: true
                });

                done();
            });
        });
    });

    describe("the _toggleEmailSettings function", function() {
        beforeEach(function() {
            spyOn(m, '_persistUpdate');
        });

        it("should persist the mentions checkbox", function() {
            m._toggleEmailSettings({
                currentTarget: {
                    id: 'settings-notify-mentions',
                    checked: true
                }
            });

            expect(m._persistUpdate).toHaveBeenCalledWith('app.account.config.offlineNotifications.mentions', true);
        });

        it("should persist the IMs checkbox", function() {
            m._toggleEmailSettings({
                currentTarget: {
                    id: 'settings-notify-ims',
                    checked: true
                }
            });

            expect(m._persistUpdate).toHaveBeenCalledWith('app.account.config.offlineNotifications.IM', true);
        });
    });
});
