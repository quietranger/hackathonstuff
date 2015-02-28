var Backbone = require('backbone');
var Handlebars = require('hbsfy/runtime');

var modalTmpl = require('./templates/modal');

Handlebars.registerPartial('button', require('./templates/button'));

var createView = Backbone.View.extend({
        events: {
            'click .close-view': 'close'
        },

        keyboardEvents: {
            'esc': 'close'
        },

        initialize: function (opts) {
            this.opts = opts || {};
            this.isFlat = opts.isFlat === undefined ? false : opts.isFlat;

            // By default, modals should be closable
            if (!opts.hasOwnProperty('closable')) {
                this.opts.closable = true;
            } else if (opts.hasOwnProperty('closable') && opts.closable === true) {
                this.opts.closable = true;
            } else {
                this.opts.closable = false;
            }

            this.contentView = opts.contentView;
            this.sandbox = this.opts.sandbox;
        },

        render: function () {
            this.$el.html(modalTmpl(this.opts));
            this.$el.find('.modal-content').html(this.contentView.render().el);
            if (!this.opts.closable) {
                this.undelegateEvents();
            }
            return this;
        },

        postRender: function(){
            var self = this;
            if (this.opts.closable){
                //click outside contentView will close the modal
                this.$el.on('click', function(e){
                   if($(e.target).hasClass('modal-sheet')){
                        self.close();
                   }
                });
            }
            if (this.contentView.postRender && typeof this.contentView.postRender === 'function') {
                this.contentView.postRender();
            }
        },
        removeContent: function () {
            if (this.contentView.destroy) {
                this.contentView.destroy();
            } else {
                this.contentView.remove();
            }
        },

        destroy: function () {
            this.remove();
        },

        close: function () {
            this.sandbox.publish('modal:hide');
        }
    })
    ;

module.exports = {
    createView: createView
};
