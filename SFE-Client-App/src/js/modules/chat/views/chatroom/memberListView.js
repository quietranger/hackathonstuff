var Backbone = require('backbone');
var Symphony = require('symphony-core');
var Handlebars = require('hbsfy/runtime');
var config = require('../../../../config/config');
var errors = require('../../../../config/errors');

var chatroomMemberView = require('./memberView');
var imMemberView = require('../im/memberView');

var manageMembershipTemplate = require('../../templates/manage-membership.handlebars');
var memberListTemplate = require('../../templates/member-list.handlebars');
var searchPeopleTemplate = require('../../../common/templates/autocompletions/person.handlebars');

var showErrorMessage = require('../../../common/mixins/showErrorMessage');

var userCollection = require('../../collections/users');

require('../../../common/helpers/index');
require('typeahead.js');


module.exports = Backbone.View.extend({
    id: 'manage-membership',
    className: 'module condensed-people-search',

    events: {
        'click .pagination .prev': 'renderPreviousPage',
        'click .pagination .next': 'renderNextPage',
        'click .pagination .page': 'renderPage',
        'change #members-per-page': 'membersPerPageDidChange',
        'typeahead:selected #add-new-member': 'addUser',
        'click .submit': 'close',
        'click .clickable-user-name': 'openProfile'
    },

    keyboardEvents: {
        'esc': 'closeModule'
    },

    initialize: function (opts) {
        this.opts = opts || {};
        this.eventBus = opts.eventBus;
        this.sandbox = opts.sandbox;
        this.userCollection = new userCollection();
        this.activeCollection = this.userCollection;
        this.accountData = null;

        this.opts.currentPage = 1;
        this.opts.perPage = 10;
        this.opts.memberQuery = '';

        if (!this.opts.threadId) {
            this.sandbox.error(errors.CHATROOM.MANAGE_MEMBERSHIP.NO_THREAD_ID);
        }

        this.peopleSearch = new Bloodhound({
            datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            limit: 3,
            remote: {
                url: Symphony.Config.API_ENDPOINT + '/search/Search?q=%QUERY&type=people',
                filter: function (parsedResponse) {
                    var users = [];
                    for (var i = 0, len = parsedResponse.queryResults[0].users.length; i < len; i++) {
                        var user = parsedResponse.queryResults[0].users[i].person;

                        if (user.id != self.userId) {
                            users.push(user);
                        }
                    }

                    return users;
                }
            }
        });

        this.peopleSearch.initialize();

        this.userCollection.on('remove', this.removeUser, this);

        var self = this;

        var query = this.sandbox.send({
            id: 'GET_ROOM_MANAGER',
            payload: {
                action: 'findrooms',
                threadid: this.opts.threadId
            }
        });

        query.then(function (rsp) {
            var result = rsp.result;

            self.userCollection.reset(result.membership);
            self.recalculatePagination();
            self.render();
            self.eventBus.trigger('roominfo:updated', result);
        }, function (msg) {
            self.showErrorMessage(errors.CHATROOM.MANAGE_MEMBERSHIP.FETCH_FAIL);
        });

        this.sandbox.getData('app.account').then(function (rsp) {
            self.accountData = rsp;

            _.each(self.accountData.roomParticipations, function (item) {
                if (item.threadId === self.opts.threadId) {
                    self.opts.memberAddUserEnabled = item.memberAddUserEnabled;
                    self.opts.userIsOwner = item.userIsOwner;
                }
            });
        });

        this.eventBus.on('subview:error', function (msg) {
            self.showErrorMessage(msg);
        });
    },

    removeUser: function (data) {
        if (_.isEmpty(this.opts.membersQuery)) {
            this.recalculatePagination();
            this.renderMembers();
        } else {
            this.membersQueryDidChange();
        }
        if (data.currentUserId === data.id) {
            this.sandbox.publish('modal:close');
            this.sandbox.publish('view:close', null, 'chatroom' + this.opts.threadId);
        }
    },

    recalculatePagination: function () {
        this.opts.currentPage = 1;
        this.opts.memberCount = this.activeCollection.length;
        this.opts.pageCount = Math.ceil(this.opts.memberCount / this.opts.perPage);
        this.opts.showPager = this.opts.pageCount > 1;
    },

    moveActiveUserToTop: function() {
        for(var i = 0, len = this.activeCollection.models.length; i < len; i++) {
            if(this.accountData.userName === this.activeCollection.models[i].id) {
                this.activeCollection.models.unshift(this.activeCollection.models[i]);
                this.activeCollection.models.splice(i+1, 1);
                break;
            }
        }
    },

    render: function () {
        this.$el.html(manageMembershipTemplate({ context: this.opts }));

        if (this.activeCollection.length > 0) {
            this.moveActiveUserToTop();
            this.renderMembers();
        }

        this.$el.find('#add-new-member').typeahead({
            minLength: config.MIN_SEARCH_LENGTH,
            highlight: true
        }, {
            name: 'chatroom-add-member',
            displayKey: 'prettyName',
            source: this.peopleSearch.ttAdapter(),
            templates: {
                suggestion: searchPeopleTemplate
            }
        }).focus();

        this.$el.find('#members-query').on('keyup', _.debounce(_.bind(this.membersQueryDidChange, this), 100));

        return this;
    },

    renderNew: function (model) {
        if (_.isEmpty(this.opts.membersQuery)) {
            this.renderMembers();
        } else {
            this.membersQueryDidChange();
        }
    },

    renderMembers: function () {
        var slice = {
            beg: (this.opts.currentPage - 1) * this.opts.perPage,
            end: this.opts.currentPage * this.opts.perPage
        };

        var list = $(memberListTemplate({ context: this.opts })),
            markup = this.renderMemberRows(this.activeCollection.slice(slice.beg, slice.end));

        list.find('#member-table tbody').html(markup);
        this.$el.find('#member-list').html(list);
    },

    renderMemberRows: function (members) {
        var fragment = document.createDocumentFragment(),
            self = this;

        if (members.models) {
            members = members.models;
        }
        _.each(members, function (member) {
            var modelObject = {
                    model: member,
                    threadId: self.opts.threadId,
                    eventBus: self.eventBus,
                    sandbox: self.sandbox,
                    userIsOwner: self.opts.userIsOwner,
                    currentUserId: self.accountData.userName,
                    isIm: self.opts.isIm,
                    isChatroom: self.opts.isChatroom,
                    canRemove: self.userCollection.length >= 3
                },
                view = self.opts.isIm ? new imMemberView(modelObject) : new chatroomMemberView(modelObject);

            view.render();

            fragment.appendChild(view.el);
        });

        return fragment;
    },

    renderPreviousPage: function () {
        if (this.opts.currentPage === 1) {
            return;
        }

        this.opts.currentPage--;
        this.render();
    },

    renderNextPage: function () {
        if (this.opts.currentPage === this.userCollection.length) {
            return;
        }

        this.opts.currentPage++;
        this.render();
    },

    renderPage: function (evt) {
        var $target = $(evt.currentTarget),
            page = parseInt($target.attr('data-page'));

        if (page === 0 || page > this.userCollection.length) {
            return;
        }

        this.opts.currentPage = page;
        this.render();
    },

    membersPerPageDidChange: function (evt) {
        var $target = $(evt.currentTarget),
            perPage = parseInt($target.val()),
            topIndex = (this.opts.currentPage - 1) * this.opts.perPage,
            newPage = Math.floor(topIndex / perPage) + 1;

        this.opts.perPage = perPage;
        this.opts.currentPage = newPage;
        this.opts.pageCount = Math.ceil(this.opts.memberCount / this.opts.perPage);
        this.opts.showPager = this.opts.pageCount > 1;
        this.render();
    },

    membersQueryDidChange: function (evt) {
        var query;
        if (!evt) {
            query = this.opts.membersQuery;
        } else {
            var $target = $(evt.currentTarget);

            query = $target.val();
        }

        if (query.length > 2) {
            var lower = query.toLowerCase();
            this.activeCollection = this.userCollection.filter(function (member) {
                return member.get('prettyName').toLowerCase().indexOf(lower) > -1;
            });
        } else if (_.isEmpty(query)) {
            this.activeCollection = this.userCollection;
        } else {
            return;
        }

        this.opts.membersQuery = query;
        this.recalculatePagination();
        this.renderMembers();
    },

    addUser: function (evt, user) {
        var self = this;

        if (user.id == this.accountData.userName) {
            this.showErrorMessage(errors.CHATROOM.MANAGE_MEMBERSHIP.ADD_SELF);
            return;
        }

        var query = this.sandbox.send({
            id: 'GET_ROOM_MANAGER',
            payload: {
                action: 'adduser',
                threadid: this.opts.threadId,
                userid: user.id
            }
        });

        query.then(function () {
            // this is a hideous hack that must be exorcised as soon as we standardize our APIs - mslipper
            user.userId = user.id;

            var model = self.userCollection.add(user);

            self.recalculatePagination();
            self.renderNew(model);
            self.$el.find('#add-new-member').typeahead('val', '');
        }, function (rsp) {
            var message = rsp.responseJSON.message;
            if(rsp.status !== 411) {
                if (message) {
                    self.showErrorMessage(message, 5000);
                } else {
                    self.showErrorMessage(errors.CHATROOM.MANAGE_MEMBERSHIP.ADD_MEMBER, 5000);
                }
            }
        });
    },

    closeModule: function() {
       this.destroy();
       this.close();
    },

    destroy: function () {
        if (this.userCollection !== null) {
            this.userCollection.reset();
        }

        this.userCollection = null;
        this.activeCollection = null;

        this.$el.find('#members-query').off();

        this.remove();
    },

    close: function () {
        this.sandbox.publish('modal:hide');
    },

    openProfile: function (e) {
        this.sandbox.publish('view:show', null, {
            module: 'profile',
            userId: $(e.currentTarget).attr('data-userid')
        });
        this.close();
    }
});

var presence = Symphony.Mixins ? Symphony.Mixins.HasPresence : {};
$.extend(true, module.exports.prototype, showErrorMessage, presence);