// test deps
var sandbox = require("../../../mocks/sandboxMock");
var accountData = require("../../../fixtures/accountData.js");

// 3rd party deps
var Q = require("q");
var Backbone = require("backbone");
var _ = require("underscore");
var Symphony = require("symphony-core");

// module deps
var Module = require("../../../../src/js/modules/appsettings/views/module.js");
var Base = require("../../../../src/js/modules/appsettings/views/tabs/base.js");
var Permissions = require("../../../../src/js/modules/appsettings/views/tabs/permissions.js");

// manage mocks
var mockSandbox = function(empty) {
  sandbox.send.and.returnValue(Q.defer().promise);
};

// spec
describe("APPSETTINGS MODULE: PERMISSIONS TAB", function() {

  var m;
  beforeEach(function() {
    mockSandbox();
    m = new Module({
      sandbox: sandbox
    });
    m.render().postRender();
    m._accountDataPromise.then(function() {
      m._activeTabView._renderPromise.then(function() {
        m.$el.find(".tabs .tabs-tab[tab=permissions]:not(.active)").click();
      });
    });
  });

  it(":: adds an own account delegate", function() {
    m._accountDataPromise.then(function() {
      m._activeTabView._renderPromise.then(function() {
        m._activeTabView._addOwnAccountDelegate(null, {id: 123, prettyName: "Groucho Marx"}, null);
        expect(_.findWhere(m._activeTabView._ownAccountDelegates, {id: 123, prettyName: "Groucho Marx"})).not.toBe(undefined);
      });
    });
  });

});
