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
var Alerts = require("../../../../src/js/modules/appsettings/views/tabs/alerts.js");

// manage mocks
var mockSandbox = function(empty) {
  var mockAccountData;
  if (empty) {
    mockAccountData = _.clone(accountData);
    mockAccountData.pinnedChats = [];
    mockAccountData.roomParticipations = [];
  } else {
    mockAccountData = accountData;
  }

  sandbox.getData.and.callFake(function(key) {
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

  sandbox.setData.and.callFake(function(key, value) {
    var q = Q.defer();
    key = key.replace("app.account.", "");
    var keys = key.split(".");
    var lastKey = keys.pop();

    var data = accountData;
    keys.forEach(function(k, i, arr) {
      if (!data[k]) {
        data = null;
        return;
      };
      data = data[k];
    });

    if (data === undefined || data === null) {
      q.resolve({status: "error"});
    } else {
      data[lastKey] = value;
      q.resolve({status: "OK"});
    };

    return value.q.promise;
  });

  sandbox.send.and.returnValue(Q.defer().promise);
};

// spec
xdescribe("APPSETTINGS MODULE: ALERTS TAB", function() {

  var m;
  beforeEach(function() {
    mockSandbox();
    m = new Module({
      sandbox: sandbox
    });
    m.render().postRender();
    m._accountDataPromise.then(function() {
      m._activeTabView._renderPromise.then(function() {
        m.$el.find(".tabs .tabs-tab[tab=alerts]:not(.active)").click();
      });
    });
  });

  if (typeof accountData.config.appWideViewConfigs.DESKTOP == "object") {
    it(":: renders the four categories for desktop client", function() {
      m._accountDataPromise.then(function() {
        m._activeTabView._renderPromise.then(function() {
          _.keys(accountData.config.appWideViewConfigs.DESKTOP).forEach(function(category) {
            var prettyCategory = category == "IM" ? category + "s" : category.toLowerCase() + "s";
            expect(m._activeTabView.$el.html().indexOf(prettyCategory)).not.toBe(-1);
          });
        });
      });
    });

    it(":: shows category exceptions", function() {
      m._accountDataPromise.then(function() {
        m._activeTabView._renderPromise.then(function() {
          m._activeTabView.$el.find(".alerts-category[data-category] .field-exceptions button:not(:disabled)").first().click();
          expect(m._activeTabView._categoriesBreadcrumbsView._breadcrumbs.length > 1).toBe(true);
          expect(m._activeTabView.$el.find(".alerts-exception").length).not.toBe(0);
        });
      });
    });
  };



});
