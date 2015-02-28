var Modal = require('../../../src/symphony/extensions/modal');
var ModalView = require('../../../src/symphony/views/modal');

var sandbox = require('../../mocks/sandboxMock');

var core = {
  sandbox: sandbox,
  start: $.noop
};

describe("The modal core extension", function() {
  beforeEach(function() {
    m = new Modal(core, sandbox);
  });

  it("should throw an error if instantiated without a core instance", function() {
    expect(function() {
      new Modal();
    }).toThrow();
  });

  describe("when instantiated", function() {
    var m;

    it("should subscribe to modal:show", function() {
      expect(sandbox.subscribe).toHaveBeenCalledWith('modal:show',
        jasmine.any(Function));
    });

    it("should subscribe to modal:hide", function() {
      expect(sandbox.subscribe).toHaveBeenCalledWith('modal:hide',
        jasmine.any(Function));
    });
  });

  describe("the show function", function() {
    beforeEach(function() {
      spyOn(core, 'start');
      spyOn(ModalView.createView.prototype, 'render').and.returnValue({
        el: {}
      });
      spyOn(ModalView.createView.prototype, 'postRender');
    });

    it("should render the passed-in modal view", function() {
      m.show({
        contentView: {}
      });

      expect(ModalView.createView.prototype.render).toHaveBeenCalled();
      expect(ModalView.createView.prototype.postRender).toHaveBeenCalled();
    });

    it("should start the passed-in module string", function() {
      m.show({
        contentView: 'test'
      });

      expect(core.start).toHaveBeenCalledWith('test', jasmine.any(Object));
    });
  });

  describe("the close function", function() {
    var spy;

    beforeEach(function() {
      spy = jasmine.createSpyObj('modalView', ['removeContent', 'destroy']);

      m.modalView = spy;
      m.close();
    });

    it("should remove the modal view's content", function() {
      expect(spy.removeContent).toHaveBeenCalled();
    });

    it("should destroy the modal view", function() {
      expect(spy.destroy).toHaveBeenCalled();
    });

    it("should null modalView", function() {
      expect(m.modalView).toBeNull();
    });
  });
});
