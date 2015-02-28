var Symphony = require('symphony-core');

var template = require('./templates/recommendations');

var UsersView = require('./views/usersView');
var KeywordGroupsView = require('./views/keywordGroupsView');
var DoneView = require('./views/doneView');

module.exports = Symphony.View.extend({
    id: 'recommendations',

    currentStep: 0,
    currentView: null,

    selectedItemsCount: 0,

    steps: [ UsersView, KeywordGroupsView, DoneView ],

    requiresAccountData: false,

    events: {
        'click .actions-wrap button': 'advance'
    },

    initialize: function() {
        Symphony.View.prototype.initialize.apply(this, arguments);

        this.listenTo(this.eventBus, 'item:selected', this.manageContinueButton);
        this.listenTo(this.eventBus, 'screen:advance', this.advance);
    },

    render: function() {
        var self = this;

        this.$el.html(template());

        var View = this.steps[this.currentStep];

        this.currentView = new View({
            sandbox: this.sandbox,
            eventBus: this.eventBus
        });

        this.currentView.render().postRender().$el.insertAfter(this.$el.find('h2'));

        if (this.currentStep === this.steps.length - 1) {
            var $button = this.$el.find('.actions-wrap button');

            $button.addClass('continue');
            $button.text('Done!');
        }

        this.$el.find('ol.state li').each(function(i) {
            if (i <= self.currentStep) {
                $(this).addClass('active');
            }
        });

        return Symphony.View.prototype.render.apply(this, arguments);
    },

    manageContinueButton: function(status) {
        if (status) {
            this.selectedItemsCount++;
        } else if (this.selectedItemsCount !== 0) {
            this.selectedItemsCount--;
        }

        var $button = this.$el.find('.actions-wrap button');

        if (this.selectedItemsCount > 0) {
            $button.addClass('continue');
            $button.text('Continue (' + this.selectedItemsCount + ')');
        } else {
            $button.removeClass('continue');
            $button.text('Skip');
        }
    },

    advance: function() {
        this.eventBus.trigger('screen:advancing');

        if (this.currentStep === this.steps.length - 1) {
            this.sandbox.setData('documents.isOnboarded', true);
            this.sandbox.publish('modal:hide', null, {});
        } else {
            this.selectedItemsCount = 0;
            this.manageContinueButton();

            this.currentView.destroy();

            this.currentStep++;
            this.render();
        }
    }
});
