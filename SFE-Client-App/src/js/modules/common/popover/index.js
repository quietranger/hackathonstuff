var Backbone = require('backbone');
var Drop = require('drop');

module.exports = Backbone.View.extend({
    className: 'popover',

    events: {
        'mouseenter': 'mouseDidEnter',
        'mouseleave': 'mouseDidLeave'
    },

    initialize: function(opts) {
        this.target = opts.target;
        this.contentView = opts.contentView;
        this.position = opts.position || 'bottom left';
        this.hideDelay = opts.hideDelay === undefined ? 500 : opts.hideDelay;
        this.openOnClick = opts.openOnClick === undefined ? false : opts.openOnClick;
        this.constrainToScrollParent = opts.constrainToScrollParent === undefined ? true : opts.constrainToScrollParent;
        this.tetherOptions = opts.tetherOptions || {};
        this.drop = null;

        this._rendered = false;
        this._mouseover = false;
        this._delayedHide = null;
        this._boundRemoveOnClick = this._removeOnClick.bind(this);

        Backbone.View.prototype.initialize.call(this, opts);

        var self = this;

        if (this.contentView.eventBus) {
            this.listenTo(this.contentView.eventBus, 'popover:reposition', this.reposition.bind(this));
            this.listenTo(this.contentView.eventBus, 'popover:hide', function() {
                self._hide(true);
            });
        }

        this.drop = new Drop({
            target: this.target,
            content: this.el,
            position: this.position,
            constrainToScrollParent: this.constrainToScrollParent,
            remove: true,
            openOn: null,
            tetherOptions: this.tetherOptions
        });
    },

    render: function() {
        this.$el.html(this.contentView.render().el);

        this._rendered = true;

        return this;
    },

    reposition: function() {
        if (this.drop) {
            this.drop.position();
        }
    },

    mouseDidEnter: function() {
        this._mouseover = true;
    },

    mouseDidLeave: function() {
        this._mouseover = false;

        if (!this.openOnClick) {
            this._hide();
        }
    },

    show: function() {
        clearTimeout(this._delayedHide);

        if (!this.drop) {
            return;
        }

        if (!this._rendered) {
            this.render();
        }

        if (this.contentView.eventBus) {
            this.contentView.eventBus.trigger('popover:will-show');
        }

        this.drop.open();

        $('body').on('click', this._boundRemoveOnClick);
    },

    hide: function() {
        if (this.hideDelay) {
            this._delayedHide = _.delay(this._hide.bind(this), this.hideDelay);
            return;
        }

        this._hide();
    },

    _hide: function(force) {
        if (this.drop && (force || !this._mouseover)) {
            $('body').off('click', this._boundRemoveOnClick);

            this.drop.close();
        }
    },

    _removeOnClick: function(e) {
        if (this.target !== e.target) {
            this._hide();
        }
    },

    destroy: function(keepContent) {
        if (!keepContent) {
            if (typeof this.contentView.destroy === 'function') {
                this.contentView.destroy();
            } else {
                this.contentView.remove();
            }
        }

        if (this.drop) {
            this.drop.destroy();
            this.drop = null;
        }
    }
});
