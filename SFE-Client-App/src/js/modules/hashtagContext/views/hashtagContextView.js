var Symphony = require('symphony-core');

var baseFilterView = require('../../common/baseFilter/index');
var hashtagContextMessageListView = require('./hashtagContextMessageList');
var goFilterView = require('../../common/goFilter/goFilter');

var filterContainerTmpl = require('../../common/baseFilter/templates/filter-container'),
    hashtagContextHeaderTmpl = require('../templates/hashtag-context-header.hbs'),
    menuTmpl = require('../../common/templates/menu');

module.exports = baseFilterView.extend({
    className: 'module filter-module hashtag-context-module',

    events: {
        'click .create-filter': 'createFilter'
    },

    moduleMenu: menuTmpl(),

    initialize: function(opts) {
        this.hashtag = opts.hashtag;
        this.moduleHeader = hashtagContextHeaderTmpl({
            hashtag: this.hashtag
        });

        this.isHashtag = false;

        this.events = _.defaults(this.events, baseFilterView.prototype.events);

        baseFilterView.prototype.initialize.apply(this, arguments);

        if (this.hashtag[0] === '#') {
            this.isHashtag = true;
        }
    },

    render: function() {
        this.$content.html(filterContainerTmpl(this.opts));

        this.messagesView = new hashtagContextMessageListView({
            sandbox: this.sandbox,
            eventBus: this.eventBus,
            currentUserId: this.opts.account.userName,
            canCall: this.canCall,
            currentUserProfileId: this.opts.account.myCurrentThreadId,
            socialConnectors: this.opts.socialConnectors,
            streamMap: this.streamMap,
            hashtag: this.hashtag
        });

        this.messagesView.render();

        this.$content.find('.container').html(this.messagesView.$el);

        return Symphony.Module.prototype.render.apply(this, arguments);
    },

    createFilter: function() {
        var ruleGroup = {
            rules: []
        };

        var self = this, definitionType = 'CASHTAG';

        if (this.isHashtag) {
            definitionType = 'HASHTAG';
        }

        _.each(this.activeConnectorIds, function(cid) {
            ruleGroup.rules.push({
                connectorId: cid,
                definitionType: definitionType,
                id: self.hashtag,
                text: self.hashtag,
                type: "DEFINITION"
            });
        });

        var contentView = new goFilterView({
            sandbox: this.sandbox,
            createNew: true,
            ruleGroup: ruleGroup
        });

        this.sandbox.publish('modal:show', null, {
            contentView: contentView,
            title: '+ Create New Filter',
            isFlat: true
        });
    }
});