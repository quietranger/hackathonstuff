var Backbone = require('backbone');

var welcomeTmpl = require('../templates/welcome.handlebars');
var mixinDefaults = require('../../common/mixins/moduleDefaults');
var config = require('../../../config/config.js');
require('shepherd');

module.exports = Backbone.View.extend({
    id: 'welcome-module',

    events: {
        'click .close': 'close',
        'click .take-tour': 'startTour'
    },

    initialize: function(opts) {
        this.opts = opts;
        this.sandbox = opts.sandbox;

        var self = this;

        this.tour = new Shepherd.Tour({
            defaults: {
                classes: 'shepherd-theme-arrows shepherd-element-attached-middle'
            }
        });

        this.tour.addStep('create-button', {
            title: 'Start a New Conversation',
            text: 'Launch a new IM, build a chatroom, or blast a message to multiple contacts using the "Create New" button.',
            attachTo: '.create-button',
            classes: 'shepherd-theme-arrows example-step-extra-class shepherd-attached-middle tour-create-button',
            buttons: [
                {
                    text: 'Cancel',
                    action: self.tour.cancel,
                    classes: 'shepherd-button-cancel button cancel'
                },
                {
                    text: 'Got it!',
                    action: self.tour.next,
                    classes: 'button positive'
                }
            ]
        });
        this.tour.addStep('nav-bar', {
            title: 'Navigation',
            text: 'View all your active and inactive modules in the left sidebar. Create groups by dragging and dropping items belonging to the same category together.',
            attachTo: '#nav',
            classes: 'shepherd-theme-arrows example-step-extra-class shepherd-attached-middle tour-nav-bar',
            buttons: [
                {
                    text: 'Cancel',
                    action: self.tour.cancel,
                    classes: 'shepherd-button-cancel button cancel'
                },
                {
                    text: 'Got it!',
                    action: self.tour.next,
                    classes: 'button positive'
                }
            ]
        });
        this.tour.addStep('search-bar', {
            title: 'Global Search',
            text: 'Use Global Search to find people, chatrooms, and messages and narrow your results with the advanced search feature.',
            attachTo: '#search-wrapper bottom',
            classes: 'shepherd-theme-arrows example-step-extra-class tour-search-bar',
            buttons: [
                {
                    text: 'Cancel',
                    action: self.tour.cancel,
                    classes: 'shepherd-button-cancel button cancel'
                },
                {
                    text: 'Got it!',
                    action: self.tour.next,
                    classes: 'button positive'
                }
            ]
        });
        this.tour.addStep('my-profile', {
            title: 'Social Posts',
            text: 'Click Your Profile and you\'ll be able to post messages and access more of Symphony\'s social features such as how many people are following you.',
            attachTo: '.show-my-profile',
            classes: 'shepherd-theme-arrows example-step-extra-class shepherd-attached-middle tour-my-profile',
            buttons: [
                {
                    text: 'Cancel',
                    action: self.tour.cancel,
                    classes: 'shepherd-button-cancel button cancel'
                },
                {
                    text: 'Got it!',
                    action: self.tour.next,
                    classes: 'button positive'
                }
            ]
        });
        this.tour.addStep('filters', {
            title: 'Filters',
            text: 'If you want to group messages or set up alerts based on your personalized criteria, use filters to specify keywords and/or people of interest.',
            attachTo: '.add-filter-shortcut',
            classes: 'shepherd-theme-arrows example-step-extra-class shepherd-attached-middle tour-filters',
            buttons: [
                {
                    text: 'Cancel',
                    action: self.tour.cancel,
                    classes: 'shepherd-button-cancel button cancel'
                },
                {
                    text: 'Got it!',
                    action: self.tour.next,
                    classes: 'button positive'
                }
            ]
        });
        if ($('.module-actions').length > 0) {
            this.tour.addStep('pin-modules', {
                title: 'Organizing Modules',
                text: 'You can arrange modules by clicking on the pin icon and dragging and dropping the headers anywhere on your desktop.',
                attachTo: '.module-actions',
                classes: 'shepherd-theme-arrows example-step-extra-class shepherd-attached-middle tour-pin-modules',
                buttons: [
                    {
                        text: 'Cancel',
                        action: self.tour.cancel,
                        classes: 'shepherd-button-cancel button cancel'
                    },
                    {
                        text: 'Got it!',
                        action: self.tour.next,
                        classes: 'button positive'
                    }
                ]
            });
        }

        this.tour.on('start', function() {
            $('body').prepend('<div class="blur"></div>').prepend('<div class="unclickable"></div>');
        });
        this.tour.on('complete', function() {
            self.setTourFlag(true);
        });
        this.tour.on('cancel', function() {
            self.setTourFlag(true);
        });
    },

    setTourFlag: function(bool) {
        $('div.blur').remove();
        $('div.unclickable').remove();
        var ftue = {
            tourCompleted: bool
        };
        this.sandbox.setData('documents.' + config.FTUE_DOCUMENT_ID, ftue);
    },

    render: function() {
        this.$el.append(welcomeTmpl());
        return this;
    },

    startTour: function(){
        this.sandbox.publish('modal:hide');
        this.tour.start();
    },

    close: function() {
        this.sandbox.publish('modal:hide');
        this.setTourFlag(true);
    }
});
