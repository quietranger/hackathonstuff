var ModalView = require('../views/modal');

/**
 * Modal core extension. Extracted from the layout manager to
 * better support dependency injection in the future.
 * @param {object} core A core instance.
 * @param {object} sandbox A sandbox instance.
 */
var Modal = function(core, sandbox) {
  this.sandbox = sandbox;
  this.core = core;
  this.$modal = $('#modal');
  this.modalView = null; //the current modal
  this.modalHistory = []; //reference to an array of hidden modals (enables support for modal on top of a modal)

  if (!this.core) {
    throw new Error('A core instance is required.');
  }

  if (!this.sandbox) {
    throw new Error('A sandbox instance is required.');
  }

  var self = this;

  this.sandbox.subscribe('modal:show', function (context, args) {
    if (args) {
      self.sandbox.publish("usage-event", null, {
        action: "SHOW_MODAL",
        details: {
          module: args.module
        }
      });
    }

    self.show(args);
  });

  this.sandbox.subscribe('modal:hide', function (context, args) {
    if (args) {
      self.sandbox.publish("usage-event", null, {
        action: "HIDE_MODAL",
        details: {
          module: args.module
        }
      });
    }

    self.close(args);
  });
};

/**
 * Callback function to show a modal.
 * @param  {object} opts Modal options
 * @param {object} opts.contentView Symphony.View object or module identifier string
 */
Modal.prototype.show = function(opts) {
    if(this.modalView && this.modalView.opts && this.modalView.opts.modalName === 'quick-action' && opts.modalName === 'quick-action') {
        /*
        this is a temporary hack. the alt+shift and option+shift mousetrap combo is not supported and fires the callback twice when either is pressed.
        the double modifier shortcuts are not supported https://github.com/ccampbell/mousetrap/issues/170 and https://github.com/ccampbell/mousetrap/issues/101
        we need to pick a new supported keycombo and remove this... (the binding happens in app.js)
        */
        return;
    }
  if (this.modalView) {
    this.hideTemp(); //temporarily hide the existing modal to show the incoming one
  }

  opts.sandbox = this.sandbox;
  opts.isFlat = true;

  if (typeof opts.contentView === 'string') {
    opts.contentView = this.core.start(opts.contentView, opts);
  }

  this.modalView = new ModalView.createView(opts);
  this.$modal.append(this.modalView.render().el);
  this.modalView.postRender();
};

/**
 * Call back function to hide a modal.
 */
Modal.prototype.close = function() {
  if (!this.modalView) {
    return;
  }

  this.modalView.removeContent(); //remove the view inside the modal

  this.modalView.destroy();
  this.modalView = null;

  this.showTemp(); //restore any hidden modals if they exist
};

Modal.prototype.hideTemp = function() {
    this.modalHistory.push(this.modalView);
    this.modalView.$el.addClass('hidden');
};

Modal.prototype.showTemp = function() {
    if(this.modalHistory.length) {
        this.modalView = this.modalHistory.pop();
        this.modalView.$el.removeClass('hidden');
    } else {
        this.$modal.empty(); //lets just make sure
    }
};

module.exports = Modal;