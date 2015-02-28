var Spinner = require('spin');

var Symphony = require('symphony-core');

var UsersCollection = require('../collections/users');

var UserView = require('./items/users/userView');

var ChildViewDestructor = require('../mixins/childViewDestructor');

var template = require('../templates/views/users');

module.exports = Symphony.View.extend({
    currentPage: 0,

    perPage: 20,

    hasRenderedUsers: false,

    department: null,

    events: {
        'click .see-more': 'seeMore'
    },

    initialize: function() {
        var self = this;

        Symphony.View.prototype.initialize.apply(this, arguments);

        this.childViews = [];

        this.usersCollection = new UsersCollection();

        this.listenTo(this.usersCollection, 'add:bulk', this.render);
        this.listenTo(this.eventBus, 'screen:advancing', this.destroy);

        this.spinner = new Spinner({
            color: '#fff'
        });

        this.accountDataPromise.then(function(rsp) {
            return self.sandbox.send({
                id: 'GET_PROFILE',
                payload: {
                    action: 'usercurrent',
                    userid: rsp.userName
                }
            });
        }).then(function(rsp) {
            self.department = rsp.person.deptName;
            self._queryRecommendations();
        });
    },

    render: function(accountData, users) {
        var hasUsers = !this.usersCollection.isEmpty();

        users = users || [];

        if (!this.hasRenderedUsers && hasUsers || !hasUsers) {
            this.$el.html(template({
                hasUsers: hasUsers
            }));
        }

        this.hasRenderedUsers = hasUsers;

        if (hasUsers) {
            this._renderUsers(users);

            this.$el.find('.see-more').toggle(users.length === this.perPage);
        } else {
            this.spinner.spin(this.$el.find('.spinner')[0]);
        }

        return Symphony.View.prototype.render.apply(this, arguments);
    },

    didGetUserRecommendations: function(rsp) {
        if (rsp.count > 0) {
            this.usersCollection.add(rsp.data);

            //have to do this since backbone raises an 'add' event for each individual model
            this.usersCollection.trigger('add:bulk', this.usersCollection.last(rsp.count));
        } else if (this.usersCollection.isEmpty()) {
            this.eventBus.trigger('screen:advance');
        }
    },

    seeMore: function() {
        this.currentPage++;
        this._queryRecommendations();
    },

    _queryRecommendations: function() {
        var self = this;

        this.sandbox.send({
            id: 'GET_USER_RECOMMENDATIONS',
            payload: {
                count: this.perPage,
                offset: this.currentPage * this.perPage,
                department: this.department
            }
        }).then(this.didGetUserRecommendations.bind(this), function() {
            self.eventBus.trigger('screen:advance');
        });
    },

    _renderUsers: function(users) {
        var self = this,
            frag = document.createDocumentFragment(),
            iter = _.chain(users);

        iter.each(function(model) {
            var view = new UserView({
                sandbox: self.sandbox,
                eventBus: self.eventBus,
                model: model
            });

            self.childViews.push(view);

            frag.appendChild(view.render().postRender().el);
        });

        this.$el.find('.see-more').before(frag);
    }
});

_.extend(module.exports.prototype, ChildViewDestructor);
