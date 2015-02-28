// test deps
var sandbox = require("../../mocks/sandboxMock");
var accountData = require("../../fixtures/accountData.js");

// 3rd party deps
var Q = require("q");
var Backbone = require("backbone");
var _ = require("underscore");
var Symphony = require("symphony-core");

// module deps
var config = require("../../../src/js/config/config");
var Module = require("../../../src/js/modules/header/views/view");
var EasyPost = require("../../../src/js/modules/header/views/easyPost");
var TextInput = require("../../../src/js/modules/common/textInput/textInput");

// manage mocks
var mockSandbox = function(empty) {
  var mockAccountData;
  if (empty) {
    mockAccountData = _.clone(accountData);
  } else {
    mockAccountData = accountData;
  };
  sandbox.getData.and.callFake(function(key) {
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
    };
    value.q.resolve(value.data);
    return value.q.promise;
  });

  sandbox.send.and.returnValue(Q.defer().promise);
};

describe("HEADER MODULE --> EASY_POST VIEW", function() {
  
  // unit tests here

})

