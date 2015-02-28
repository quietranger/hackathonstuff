var Q = require('q');
var Symphony = require('symphony-core');
var ItemView = require('../itemView');

var template = require('../../../templates/views/users/user');

module.exports = ItemView.extend({
    template: template,

    initialize: function() {
        ItemView.prototype.initialize.apply(this, arguments);

        var self = this;

        this.userId = null;
        this.imThreadId = null;
        this.saving = false;

        this.accountDataPromise.then(function(rsp) {
            self.userId = rsp.userName;
        });
    },

    didSelectItem: function() {
        if (!this.userId || this.saving) {
            return;
        }

        this.saving = true;

        var selected = this.model.get('selected');

        this.eventBus.trigger('item:selected', selected);

        if (selected) {
            this._userSelected();
        } else {
            this._userDeselected();
        }
    },

    _userSelected: function() {
        var startChat = Symphony.Utils.startChat({
            sandbox: this.sandbox,
            userId: [ this.model.get('id'), this.userId ],
            skipPaint: true
        });

        var toggleFollow = this._toggleFollow(true),
            self = this;

        Q.all([ startChat, toggleFollow ]).spread(function(chatRsp, followRsp) {
            self.sandbox.publish('following:change', null, followRsp);

            chatRsp = chatRsp.result;

            self.imThreadId = chatRsp.threadId;
            self.sandbox.publish('view:created', null, chatRsp);
        }, function() {
            self.$el.addClass('error');
        }).finally(function() {
            self.saving = false;
        });
    },

    _userDeselected: function() {
        var toggleFollow = this._toggleFollow(false),
            self = this;

        Q.all([ this.sandbox.getData('app.account'), toggleFollow ]).spread(function(accountRsp) {
            self.sandbox.publish('view:removed', null, self.imThreadId);
            self.sandbox.publish('view:close', null, 'im' + self.imThreadId);

            var imViewConfig = _.findWhere(accountRsp.userViewConfigs, { viewId: self.imThreadId });
            imViewConfig.pinnedChat = false;

            self.sandbox.setData('app.account.userViewConfigs', imViewConfig);

            var pinnedChats = accountRsp.pinnedChats;

            for (var i = 0; i < pinnedChats.length; i++) {
                var obj = pinnedChats[i];

                if (obj.threadId === self.imThreadId) {
                    pinnedChats.splice(i, 1);
                }
            }

            self.sandbox.setData('app.account.pinnedChats', pinnedChats);
        }).finally(function() {
            self.saving = false;
        });
    },

    _toggleFollow: function(selected) {
        var followeeId = this.model.get('id'),
            opts;

        if (selected) {
            opts = {
                id: 'ADD_FOLLOWING',
                payload: [{
                    type: 'DEFINITION',
                    definitionType: 'USER_FOLLOW',
                    id: followeeId,
                    text: this.model.get('prettyName'),
                    connectorId: 'lc'
                }]
            };
        } else {
            opts = {
                id: 'DELETE_FOLLOWING',
                urlExtension: encodeURIComponent('lc') + '/' + encodeURIComponent(followeeId)
            };
        }

        return this.sandbox.send(opts);
    }
});
