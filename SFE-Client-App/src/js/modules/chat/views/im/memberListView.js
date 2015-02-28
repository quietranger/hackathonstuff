var Backbone = require('backbone');
var Symphony = require('symphony-core');
var Handlebars = require('hbsfy/runtime');
var config = require('../../../../config/config');
var errors = require('../../../../config/errors');
var utils = Symphony.Utils;

var memberListTemplate = require('../../templates/member-list.handlebars');
var showErrorMessage = require('../../../common/mixins/showErrorMessage');
var userCollection = require('../../collections/users');
var memberTemplate = require('../../templates/member.handlebars');
Handlebars.registerPartial('memberList', memberListTemplate);
Handlebars.registerPartial('member', memberTemplate);

require('../../../common/helpers/index');
require('typeahead.js');

var roomMemberListView = require('../chatroom/memberListView');

var memberView = require('./memberView');

module.exports = roomMemberListView.extend({
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
            id: 'IM_MANAGER_INFO',
            payload: {
                threadid: this.opts.threadId
            }
        });

        query.then(function (rsp) {
            self.userCollection.reset(rsp);
            self.recalculatePagination();
            self.render();
        }, function (msg) {
            self.showErrorMessage(errors.CHATROOM.MANAGE_MEMBERSHIP.FETCH_FAIL);
        });

        this.sandbox.getData('app.account').then(function (rsp) {
            self.accountData = rsp;
            console.log(self.accountData);

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
        this.adjustMembership({remove: true});
    },
    addUser: function (evt, user) {
        this.userCollection.add({
            'userId':       user.id,
            'prettyName':   user.prettyName
        });

        this.adjustMembership({add: true});
    },
    adjustMembership: function(opts) {
        var self = this;

        utils.startChat({
            'skipPaint': true,
            'userId': _.pluck(this.userCollection.toJSON(), 'userId'),
            'sandbox': self.sandbox
        }).then(function(rsp){
            //custom create nav link, in place of the existing one (only if its not already there)
            self.sandbox.publish('view:created', null, _.extend({
                'replace':self.opts.threadId
            }, rsp.result));

            //show it
            self.sandbox.publish('view:show', null, {
                'replace':self.opts.threadId,
                'module': 'im',
                'streamId': rsp.result.threadId
            });

            self.sandbox.publish('view:close', null, 'im'+self.opts.threadId);
            self.sandbox.publish('leftnav:savegrouping', null, 'im');

            self.recalculatePagination();
            self.renderNew({});
            self.$el.find('#add-new-member').typeahead('val', '');
            self.opts.threadId = rsp.result.threadId;
        });
    }
});

var presence = Symphony.Mixins ? Symphony.Mixins.HasPresence : {};
$.extend(true, module.exports.prototype, showErrorMessage, presence);
