var Backbone = require('backbone');
var Symphony = require('symphony-core');

var personTmpl = require('../templates/person-result.handlebars');
var goImView = require('../../common/goIm/goIm');

module.exports = Symphony.View.extend({
    className: 'user-result',

    events: {
        'click .profile-link': 'showProfile',
        'click .chat': 'chat',
        'click .follow': 'follow',
        'click .unfollow': 'unfollow',
        'click .call': 'call'
    },

    initialize: function(opts) {
        this.psEvents['following:change'] = this.onFollowingChange.bind(this);
        Symphony.View.prototype.initialize.call(this, opts);

        this.model = opts.model;

        this.listenTo(this.model, 'change', this.render);
    },

    showProfile: function() {
        this.sandbox.publish('view:show', null, {
            module: 'profile',
            userId: this.model.get('id')
        });
    },

    chat: function() {
        var contentView = new goImView({
            sandbox: this.sandbox,
            peopleArr: [
                {
                    id: this.model.get('id')
                }
            ],
            headless: true
        });

        this.sandbox.publish('view:headless', null, {
            title: 'Add peeps',
            contentView: contentView
        });
    },

    call: function () {
        var opts = {
            userId: this.model.get('id')
        };
        this.sandbox.publish('appBridge:fn', null, opts);
    },

    follow: function (e) {
        var self = this;

        var query = this.sandbox.send({
            id: 'ADD_FOLLOWING',
            payload: [{
                type: "DEFINITION",
                definitionType: "USER_FOLLOW",
                id: self.model.get('id'),
                text: self.model.get('screenName'),
                connectorId: self.model.get('userType') === 'system' ? 'lc' : self.model.get('userType')
            }]
        });

        query.done(function (rsp) {
                //broadcast the following change, datastore will update itself upon receiving the event
                self.sandbox.publish('following:change', null, rsp);
            },
            function (rsp) {
                //  TODO handle failure
            });
    },

    unfollow: function () {
        var self = this;
        var query = this.sandbox.send({
            id: 'DELETE_FOLLOWING',
            urlExtension: encodeURIComponent(self.model.get('userType') === 'system' ? 'lc' : self.model.get('userType'))+'/'+encodeURIComponent(self.model.get('id'))
        });

        query.done(function (rsp) {
                //broadcast the following change, datastore will update itself upon receiving the event
                self.sandbox.publish('following:change', null, rsp);
            },
            function (rsp) {
                //  TODO handle failure
            });
    },

    onFollowingChange: function(ctx, args){
        var userId = this.model.get('id');
        var followRule = _.find(args.ruleGroup.rules, function(rule){
            return rule.id == userId;
        });
        this.model.set('requestorFollowingUser', followRule != null);
        this.render();
    },

    render: function() {
        this.$el.html(personTmpl(this.model.toJSON()));

        return Symphony.View.prototype.render.call(this);
    },

    destroy: function() {
        this.model = null;

        Symphony.View.prototype.destroy.call(this);
    }
})
