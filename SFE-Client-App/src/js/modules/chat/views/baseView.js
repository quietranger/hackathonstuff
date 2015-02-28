var Backbone = require('backbone');
var Symphony = require('symphony-core');
var moment = require('moment');
var config = require('../../../config/config');
var errors = require('../../../config/errors');
var Q = require('q');

var Handlebars = require("hbsfy/runtime");

var chatContainerTmpl = require('../templates/chat-container.handlebars');
var textInput = require('../../common/textInput/textInput');
var messageListView = require('../../common/chatMessageList/messageListView');
var settingsView = require('./settingsView');
var chatroomMemberListView = require('./chatroom/memberListView');
var imMemberListView = require('./im/memberListView');
var Utils = require('../../../utils');

var showErrorMessage = require('../../common/mixins/showErrorMessage');

var roomDescriptionPopoverView = require('../../common/roomDescriptionPopover/index');
var popover = require('../../common/popover/index');

var MAX_LENGTH = 2000;

module.exports = Symphony.Module.extend({
    className: 'chat-module module',

    events: {
        'click .show-settings': 'showSettings',
        'click .show-manage-membership': 'showMemberList',
        'click .search': 'showSearchModule',
        'mouseenter .room-info': 'showRoomInfo'
    },

    requiresAccountData: true,
    //don't use default container template, need to use customized template with different parameter
    includeContainer: false,
    /* will be set in initialize function*/
    moduleMenu: '',
    //rteActions available in the text input area
    rteActions: ['emoticons', 'attach', 'disable'],

    initialize: function (opts) {
        var self = this;
        this.roomInfoDrop = null;
        this.psEvents['typing:' + opts.streamId] = this.onUsersTyping.bind(this);
        this.psEvents['module:afterResize:' + opts.viewId]= this.storeViewWidth.bind(this);

        if(!opts.symphony.widget) {
            this.events['click a.participants'] = 'showMemberList';
        }

        this.opts = opts || {};
        //TODO:  move this to symphony lib maybe
        this.opts.dropdownId = _.uniqueId(this.opts.module + '_');
        this._dropCache = {};
        this.typingStatuses = {};
        this.init = opts.init === undefined ? false : opts.init;

        Symphony.Module.prototype.initialize.call(this, opts);

        this.listenTo(self.eventBus, 'settings:change', function (settings) {
            self.settingsDidChange(settings);
        });

        this.listenTo(self.eventBus, 'textinput:resize', function () {
            self.textAreaDidResize();
        });

        this.listenTo(self.eventBus, 'input:event', function (text) {
            self._isTyping();
            self._saveDraft(text);
        });

        this.listenTo(self.eventBus, 'message:rendered',  function (message) {
            self.latestMessageTime = message.get('ingestionDate');
            self.updateTypingIndicator(true);
        });

        this.sandbox.isRunningInClientApp().then(function (rsp) {
            self.isRunningInClientApp = rsp;
        });
        this.qViewData = Q.defer();
        this.accountDataPromise.then(function (acctData) {
            _.extend(self.opts, {account: acctData});
            self.currentUserId = self.opts.account.userName;
            //init view data
            var dataSet = self.opts.isIM ? 'pinnedChats' : 'roomParticipations';
            var viewData = _.find(self.opts.account[dataSet], function (item) {
                return item.threadId == self.opts.streamId;
            });
            if (!viewData) {
                var path = self.opts.isIM ? 'ims.' : 'rooms.';
                self.sandbox.getData(path + self.streamId).then(function (newViewData) {
                    self.viewData = newViewData;
                    self.qViewData.resolve();
                });
            } else {
                self.viewData = viewData;
                self.qViewData.resolve();
            }
        });

        this.qRendered = Q.defer();

        this.typingInterval = setInterval(function() {
            self.updateTypingIndicator(true);
        }, 5000);
    },

    _saveDraft: _.debounce(function (text) {
        this.sandbox.setData('drafts.' + this.streamId, text);
    }, 750),

    _isTyping: _.throttle(function () {
        this.sandbox.send({
            'id': 'IS_TYPING',
            'payload': {
                'threadId': this.opts.streamId
            }
        });
    }, config.TYPING_DELAY, { trailing: false }),

    //args will contain account data, look at js/lib/symphony/view.js
    render: function (acctData, args) {
        var self = this;
        this.qViewData.promise.then(function () {
            if (self.viewData) {
                var viewData = self.viewData;
                if (self.opts.isChatRoom) {
                    self.opts.name = viewData.name;
                    self.opts.copyDisabled = viewData.copyDisabled;
                    self.opts.participants = viewData.memberCount;
                    self.opts.userIsOwner = viewData.userIsOwner;
                    if (viewData.publicRoom) {
                        self.opts.isPublic = true;
                    }
                    else {
                        self.opts.isPrivate = true;
                    }
                } else if (self.opts.isIM) {
                    var myPrettyName = self.opts.account.prettyName;

                    self.opts.name = Utils.aliasedShortenedChatName(viewData.userPrettyNames, viewData.userIds, myPrettyName);
                    self.opts.participants = viewData.userIds.length;
                    if (viewData.userIds.length == 2) {
                        self.opts.oneToOneUserId = _.without(viewData.userIds, self.opts.account.userName);
                    }
                }
            }

            self.$el.html(chatContainerTmpl(self.opts));

            //create message list view
            var contextMsgId = null;
            if (self.opts.action === 'showContext' && self.opts.messageId) {
                contextMsgId = self.opts.messageId;
            }
            self.messageListView = new messageListView({
                eventBus: self.eventBus,
                type: self.opts.isIM ? 'im' : 'chatroom',
                el: self.$el.find('.chatroom-messages'),
                streamId: self.opts.streamId,
                sandbox: self.sandbox,
                currentUserId: self.opts.account.userName,
                parentViewId: self.viewId,
                contextMsgId: contextMsgId,
                symphony: self.opts.symphony,
                viewWidth: self.viewWidth
            });

            //create text input view
            var viewConfig = _.find(self.opts.account.userViewConfigs, function (view) {
                return view.viewId === self.opts.streamId;
            });
            var userDisableInput = (viewConfig && !_.isEmpty(viewConfig.config)) ? viewConfig.config.disableInput : false;
            var inputOption = {};
            inputOption.placeholderText = 'Compose a message...';
            inputOption.disableInputOption = false;
            inputOption.streamId = self.opts.streamId;

            if (viewData && viewData.readOnly && !viewData.userIsOwner) {
                inputOption.placeholderText = 'This room is read-only. Only owners of the room can post a message to this room.';
                inputOption.disableInputOption = true;
                self.eventBus.trigger('textinput:change', inputOption);
            } else if (userDisableInput) {
                inputOption.placeholderText = 'Input disabled.';
                inputOption.disableInputOption = true;
                self.eventBus.trigger('textinput:change', inputOption);
            }

            self.chatInput = new textInput({
                eventBus: self.eventBus,
                buttonText: 'SEND',
                placeholderText: inputOption.placeholderText,
                sandbox: self.sandbox,
                threadId: self.opts.streamId,
                userId: self.opts.account.userName,
                el: self.$el.find('.chatroom-compose'),
                disableInput: inputOption.disableInputOption,
                isReadOnly: viewData ? viewData.readOnly : true,
                showButton: false,
                maxLength: MAX_LENGTH,
                resize: 'n',
                viewId: self.opts.viewId,
                rteActions: self.rteActions,
                participantCount: self.opts.participants
            });

            self.messageListView.render();
            self.chatInput.render();
            self.$el.find('.module-content').append(self.moduleMenu(_.extend({}, {
                'isIm'          : self.isIm,
                'isChatRoom'    : self.isChatRoom
            }, self.opts)));
            self.qRendered.resolve();
            Symphony.Module.prototype.render.call(self, arguments);
        });
    },

    postRender: function () {
        var self = this;
        self.qRendered.promise.then(function(){
            self.listenTo(self.eventBus, 'textinput:error', function (message) {
                self.showErrorMessage(message, 5000);
            });

            //$(document).foundation();
            if (self.opts.copyDisabled) {
                self.messageListView.$el.attr('unselectable', 'on').on('selectstart copy', false).css('-webkit-user-select', 'none');
            }
            self.messageListView.postRender();
            self.chatInput.postRender();

            self.listenTo(self.eventBus, 'module:focused', self.didTakeFocus.bind(self));

            Symphony.Module.prototype.postRender.call(self, arguments);
            if (!self.init) {
                self.sandbox.publish('view:focus:requested', null, {viewId: self.viewId});
            }
        });
    },

    didTakeFocus: function () {
        this.eventBus.trigger('textinput:parent:focused');
    },

    textAreaDidResize: function () {
        this.$el.find('.chatroom-messages').css('bottom', this.chatInput.$el.height());
    },
    settingsDidChange: function (settings) {
        this.chatInput.disableInput = settings.disableInput;
        this.chatInput.$el.find('.text-input-text, button').prop('disabled', settings.disableInput);
    },

    destroy: function () {
        if (this.chatInput) {
            this.chatInput.destroy();
            this.chatInput = null;
        }

        if (this.messageListView) {
            this.messageListView.destroy();
            this.messageListView = null;
        }

        clearInterval(this.typingInterval);
    },

    showSettings: function (evt) {
        var contentView = new settingsView({
            eventBus: this.eventBus,
            sandbox: this.sandbox,
            viewId: this.opts.streamId,
            isRunningInClientApp: this.isRunningInClientApp,
            isIM: this.opts.isIM
        });

        var titleStr = this.opts.isIM ? 'IM Settings' : 'Chatroom Settings';
        this.sandbox.publish('modal:show', null, {
            title: titleStr,
            contentView: contentView
        });
    },

    showSearchModule: function () {
        this.sandbox.publish('view:show', null, {
            module: 'search',
            selectedRoomId: this.streamId
        });
    },

    showMemberList: function () {
        var memberListView, title, unpriveleged = true;
        if (this.opts.isIM) {
            memberListView = imMemberListView;
            title = 'Manage IM Members';
            unpriveleged = false;
        } else {
            memberListView = chatroomMemberListView;
            title = 'Manage Chatroom Members';
            if(this.viewData.memberAddUserEnabled || this.viewData.userIsOwner){
                unpriveleged = false;
            }
        }
        var contentView = new memberListView({
            eventBus: this.eventBus,
            sandbox: this.sandbox,
            threadId: this.opts.streamId,
            unpriveleged: unpriveleged,
            isIm: this.opts.module === 'im',
            isChatroom: this.opts.module === 'chatroom'
        });
        this.sandbox.publish('modal:show', null, {
            title: title,
            contentView: contentView
        });
    },

    onUsersTyping: function (ctx, typingObj) {
        // return immediately if this typing status sent before the last rendered message
        if (typingObj.date < this.latestMessageTime) {
            return;
        }
        typingObj.ts = new Date().getTime();
        var mapKey = typingObj.prettyName + ":" + typingObj.count;
        this.typingStatuses[mapKey] = typingObj;
        // and update
        this.updateTypingIndicator(false);
    },

    updateTypingIndicator: function (checkExpiration) {
        var self = this;
        if(checkExpiration) {
            var typingObjectKeys = Object.keys(self.typingStatuses);
            var now = new Date().getTime(), changed = false;
            for (var i = 0, len = typingObjectKeys.length; i < len; i++) {
                var key = typingObjectKeys[i];
                //if the timestamp is old enough e.g. 5s ago or the message that user is typing already came, delete the typing status
                //4900 is just a random number that is less than 5000, don't use exact 5000 so that the status is guaranteed to be deleted
                if (now - self.typingStatuses[key].ts >= 4900 || self.latestMessageTime > self.typingStatuses[key].ts) {
                    delete self.typingStatuses[key];
                    changed = true;
                }
            }

            if (!changed) {
                return;
            }
        }
        var indicator = self.$el.find('.typing-indicator');
        //get the latest keys
        typingObjectKeys = Object.keys(self.typingStatuses);
        // easiest is to clear if no one is typing
        if (typingObjectKeys.length == 0) {
            indicator.find('.typing-indicator-text').text('');
            indicator.addClass('hide');
        } else {
            var count = 0;
            var lastTyping = null;
            var mostRecentTime = 0;
            for (var i = 0, len = typingObjectKeys.length; i < len; i++) {
                var key = typingObjectKeys[i];
                var typingStatus = self.typingStatuses[key];
                count += typingStatus.count;
                if (typingStatus.ts > mostRecentTime) {
                    mostRecentTime = typingStatus.ts;
                    lastTyping = '<span class="aliasable colorable" data-userid="' + typingStatus.userId + '">' +
                        typingStatus.prettyName + '</span>';
                }
            }
            var typingString = null;
            if (count == 1) {
                typingString = lastTyping + ' is typing...';
            } else {
                typingString = lastTyping + ' and others are typing...';
            }
            indicator.find('.typing-indicator-text').html(typingString);
            indicator.removeClass('hide');

        }
    },

    storeViewWidth: function(args, data){
      this.viewWidth = data.width;
    },

    showRoomInfo: function (evt) {
        var dropId = $.data(evt.currentTarget, '_dropId'),
            drop;

        if (this.roomInfoDrop) {
            this.roomInfoDrop.show();
        } else {
            dropId = _.uniqueId('drop_');

            $.data(evt.currentTarget, '_dropId', dropId);
            // if userId is present, this is a user hover profile else its a room profile

            var view = new roomDescriptionPopoverView({
                sandbox: this.sandbox,
                event: this.eventBus,
                currentUserId: this.currentUserId,
                dropId: dropId,
                streamId: this.streamId
            });

            this.roomInfoDrop = new popover({
                target: evt.currentTarget,
                contentView: view,
                showDelay: 750,
                tetherOptions: {
                    offset: '0 60px'
                }
            });
        }

        this.roomInfoDrop.show();
    },

    hideProfile: function () {
        if (this.roomInfoDrop) {
            this.roomInfoDrop.hide();
        }
    },

    hideProfileOnPopoverAction: function (dropId) {
        clearTimeout(this._profileTimer);
        this._dropCache[dropId].hide();
    }
    //end of TODO
});
_.extend(module.exports.prototype, showErrorMessage);
