var LongPoll = require("../../../src/symphony/extensions/longPoll"),
    Sandbox = require("../../../src/symphony/sandbox");

describe("The longPoll extension", function() {
  var lp,
      sandbox;

  beforeEach(function() {
    spyOn(Sandbox.prototype, "subscribe").and.callThrough();

    sandbox = new Sandbox();
    lp = new LongPoll({}, sandbox, {});
  });

  it("subscribe to app kill", function() {
    expect(Sandbox.prototype.subscribe).toHaveBeenCalledWith("app:kill", jasmine.any(Function));
  });

});
