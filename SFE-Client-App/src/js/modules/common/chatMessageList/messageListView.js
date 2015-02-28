/**
 * Created by slippm on 4/18/14.
 */
var Backbone = require('backbone');
var Handlebars = require("hbsfy/runtime");
var baseMessages = require('../../common/baseMessages/index');
var utils = require('../../../utils');
var moment = require('moment');
var chatMessagesContainerTmpl = require('./templates/chat-messages-container.handlebars');
var maestroGroupTmpl = require('./templates/maestro-group.handlebars');
var dateGroupTmpl = require('./templates/date-group.handlebars');
var msgGapTmpl = require('./templates/msgGap.handlebars');
var msgEntityPerson = require('./templates/msgEntityPerson.handlebars');
var messageView = require('./views/messageView');
var errors = require('../../../config/errors');
var Q = require('q');

var showErrorMessage = require('../mixins/showErrorMessage');
var hasTooltips = require('../mixins/hasTooltips');

Handlebars.registerHelper('parseMaestro', function (message) {
    var text = msgEntityPerson(message.requestingUser);
    var requesterOnly = true;
    for (var idx in message.affectedUsers) {
        if (message.affectedUsers[idx].id !== message.requestingUser.id) {
            requesterOnly = false;
            break;
        }
    }
    switch (message.event) {
        case 'CREATE_ROOM':
            text += ' created ' + utils.escapeHtml(message.maestroObject.name);
            break;
        case 'JOIN_ROOM':
            if (requesterOnly)
                text += ' joined the room.';
            else
                text += ' added ' + msgEntityPerson(message.affectedUsers[0]) + ' to the room.';
            break;
        case 'LEAVE_ROOM':
            if (requesterOnly)
                text += ' left the room.';
            else
                text += ' removed ' + msgEntityPerson(message.affectedUsers[0]) + ' from the room.';
            break;
        case 'MEMBER_MODIFIED':
            if (message.maestroObject.userIsOwner) {
                if (requesterOnly) {
                    text += ' has become owner.';
                } else {
                    text += ' made ' + msgEntityPerson(message.affectedUsers[0]) + ' an owner.';
                }
            } else {
                if (requesterOnly) {
                    text += ' is no longer an owner.';
                } else {
                    text += ' demoted ' + msgEntityPerson(message.affectedUsers[0]) + ' as an owner.';
                }
            }
            break;
        case 'DEACTIVATE_IM':
            text += ' is no longer a user of Symphony.';
            break;
        case 'UPDATE_ROOM':
            text += ' has modified the room info.';
            break;
        default:
            text = '';
            break;
    }
    return new Handlebars.SafeString(text);
});
module.exports = baseMessages.extend({
    className: 'message-list',
    events: {
        'click .new-message-indicator': 'scrollToBottom',
        'click .quick-move-button': 'scrollToBottom',
        'click .date-group-header': 'toggleDateGroup',
        'click .msg-group-header.maestro': 'toggleMaestroGroup',
        'click .load-more-available': 'loadMoreMessages',
        'click .gap-load-more-available': 'loadMessagesInGap'
    },
    /*
     * @description: initialize chat message list view which can be used by modules to render a list of messages,
     *               Chat message list view will be used by chatroom/IM
     *               For filters/profile/channel use social message list
     * @param opts: the options to init the view, e.g. {streamId: xxx, sandbox}
     * */
    initialize: function (opts) {
        baseMessages.prototype.initialize.call(this, opts);

        var self = this;
        this.symphony = opts.symphony;
        this.scrollHeight = opts.scrollHeight || null;
        this.imUsers = null;
        this.isIm = false;
        this.oneToOneUserId = opts.oneToOneUserId;
        this.currentUserId = null;
        this.viewWidth = opts.viewWidth;
        this.eventBus = opts.eventBus;
        this.viewId = opts.type + opts.streamId;
        this.sandbox.isRunningInClientApp().then(function (rsp) {
            self.isRunningInClientApp = rsp;
            self.sandbox.getData('app.account').then(function (rsp) {
                self.currentUserId = rsp.userName;
                self.canCall = self.isRunningInClientApp && rsp.entitlement.callEnabled;
                var im = _.findWhere(rsp.pinnedChats, {threadId: self.streamId});

                if (im) {
                    self.isIm = true;
                    var users = _.object(im.userIds, im.userPrettyNames);
                    self.imUsers = users;
                }
            });
        });

        this.psEvents['view:existing'] = this.onExist.bind(this);
        this.psEvents['hideMessagesIM:trigger'] = this.deleteAllMessages.bind(this);
        this.psEvents['module:afterResize:' + this.viewId] = this.storeViewWidth.bind(this);

        this.sandbox.subscribe('view:existing', this.psEvents['view:existing']);
        this.sandbox.subscribe('hideMessagesIM:trigger', this.psEvents['hideMessagesIM:trigger']);
        this.sandbox.subscribe('module:afterResize:' + this.viewId, this.psEvents['module:afterResize:' + this.viewId]);

        if (opts.contextMsgId) {
            this.qLoadInitialMessages.promise.then(function () {
                self.loadMsgContext(opts.contextMsgId);
            });
        }

        this.eventBus.on('message:readreceipt:rendered', function(data) {
            //use the last two since sometimes messages are rendered out of order
            var lastTwo = _.map(self.messageCollection.slice(self.messageCollection.length - 2), function(item) {
                return item.get('messageId');
            });

            if (_.contains(lastTwo, data.get('messageId'))) {
                self.scrollToBottom();
            }
        });

        Q.all([
            this.sandbox.getData('app.account.config'),
            this.sandbox.getData('documents.cronKeeper')
        ]).spread(function(appConfig, cronKeeper) {
            if(appConfig.hideMessagesIM === true) {
                var lastOpenedTime = cronKeeper,
                    mostRecentMidnight = new Date();

                mostRecentMidnight.setHours(0, 1, 0, 0);

                if(Number(lastOpenedTime) < mostRecentMidnight.getTime()) {
                    self.deleteAllMessages();
                }

                self.toggleHideMessagesIM(null, true);
            }
        });
    },

    beforeModuleResize: function (ctx, args) {
        this.isAtBottomBeforeResize = this.isAtBottom();
    },

    afterModuleResize: function (ctx, args) {
        if (this.isAtBottomBeforeResize) {
            _.delay(this.scrollTo, 250, {target: 'bottom'});
        }
    },
    onExist: function (context, args) {
        if (args.streamId === this.streamId && args.action === 'showContext') {
            //show context view
//            if (this.opts.contextMsgId == args.messageId) {
//                return;
//            }

            if (this.messageCollection.get(this.opts.contextMsgId)) {
                //remove hightlight
                this.messageViews[this.opts.contextMsgId].$el.removeClass('highlighted');
                //remove message gap indicator
                this.$el.find('div.msg-gap').remove();
            }

            if (this.opts.contextMsgId) {
                //remove previous context, only keep the latest 50
                while (this.messageCollection.length > 50) {
                    var msgToRemove = this.messageCollection.shift();
                    this.onDeleteMessage(null, msgToRemove.get('messageId'));
                }
            }
            this.loadMsgContext(args.messageId);
        }
    },
    render: function () {
        this.$el.html(chatMessagesContainerTmpl({ isContextual: this.type == 'contextual-messages' }));
        this.$scrollArea = this.$el.find('.messages-scroll');
        return this;
    },

    loadMoreMessages: function () {
        if (this.isLoadingMoreMessages || !this.moreMessagesAvailable) {
            return;
        }

        var self = this,
            toTime = null,
            noHistory = false;

        if (this.messageCollection.at(0)) {
            toTime = this.messageCollection.at(0).get('ingestionDate') - 1;
        } else {
            noHistory = true;
            toTime = new Date().getTime();
        }

        this.isLoadingMoreMessages = true;
        this.setAutoloadIndicator('loading');

        var moreMessages = this.sandbox.send({
            'id': 'QUERY_THREAD_HISTORY',
            'payload': {
                'from': '0',
                'to': toTime,
                'limit': 51,
                'id': this.opts.streamId,
                'includestatus': this.isIm
            }
        });

        moreMessages.done(function (rsp) {
            var messages = rsp.envelopes.slice(0, 50).reverse();
            self.reaperAllowance = rsp.envelopes.length >= 51 ? self.reaperAllowance + 50 : self.reaperAllowance + rsp.envelopes.length;
            //de-duplicate messages
            messages = _.uniq(messages, true, function (msgWrapper, idx, list) {
                if (msgWrapper.message) {
                    return msgWrapper.message.messageId;
                }
            });
            messages = utils.flattenMessageResponse(messages, self.opts.currentUserId, true);
            //since we already de-duped, models are exactly what we added to the collection, now we can use models to renderPreviousMessages
            var models = self.messageCollection.add(messages);
            models.forEach(function (model) {
                if (!model.get('isRead') && model.get('version') == 'SOCIALMESSAGE') {
                    self.unreadMsgs[model.get('messageId')] = model;
                }
            });
            if(noHistory) {
                self.renderMessages();
            } else {
                self.renderPreviousMessages(models);
            }

            if (rsp.envelopes.length > 50) {
                self.setAutoloadIndicator('available');
                self.moreMessagesAvailable = true;
            } else {
                self.setAutoloadIndicator('unavailable');
                self.moreMessagesAvailable = false;
            }

            self.isLoadingMoreMessages = false;
        }, function (error) {
            self.showErrorMessage(errors.COMMON.CHAT_MESSAGE_LIST.LOAD_ERROR, 5000);
        });
    },

    loadMessagesInGap: function (e) {
        var $loadMore = $(e.currentTarget), self = this;
        if ($loadMore.hasClass('loading')) {
            return;
        } else {
            $loadMore.addClass('loading');
        }

        //in the same date-group
        var $upperBoundMsg = $(e.currentTarget).parent().parent().prev();
        if(!$upperBoundMsg.length){
            //if no message before the gap in the same date group, go to prev date group
            $upperBoundMsg = $(e.currentTarget).closest('.date-group').prev();
        }
        if (!$upperBoundMsg.hasClass('chat-message')) {
            $upperBoundMsg = $upperBoundMsg.find(".chat-message:last");
        }
        var upperBoundMsg = this.messageCollection.get($upperBoundMsg.attr('data-message-id')),
            from = upperBoundMsg.get('ingestionDate'),
            $lowerBoundMsg = $(e.currentTarget).parent().parent().next();
        if (!$lowerBoundMsg.hasClass('chat-message')) {
            //if it's maestro message group
            $lowerBoundMsg = $lowerBoundMsg.find(".chat-message:first");
        }
        var lowerBoundMsg = this.messageCollection.get($lowerBoundMsg.attr('data-message-id')),
            to = lowerBoundMsg.get('ingestionDate'),
            isChronological = false;

        if ($loadMore.hasClass('down')) {
            isChronological = true;
        }

        var moreMessages = this.sandbox.send({
            'id': 'QUERY_MESSAGE_IN_GAP',
            'payload': {
                'from': from,
                'to': to,
                'limit': 51,
                'id': this.opts.streamId,
                'includestatus': this.isIm,
                'ischronological': isChronological
            }
        });

        moreMessages.done(function (rsp) {
            var messages = rsp.envelopes.slice(0, 50).reverse();
            self.reaperAllowance = rsp.envelopes.length >= 51 ? self.reaperAllowance + 50 : self.reaperAllowance + rsp.envelopes.length;
            var messagesToAdd = [], hasDuplicate = false;
            //de-duplicate messages
            for (var idx in messages) {
                var msg = messages[idx];
                if (!self.messageCollection.get(msg.messageId)) {
                    messagesToAdd.push(msg);
                } else {
                    //if find duplicate, it means there are no more message in the gap
                    hasDuplicate = true;
                }
            }
            messagesToAdd = utils.flattenMessageResponse(messagesToAdd, self.opts.currentUserId, true);
            //since we already de-duped, models are exactly what we added to the collection, now we can use models to renderPreviousMessages
            var models = self.messageCollection.add(messagesToAdd);
            models.forEach(function (model) {
                if (!model.get('isRead') && model.get('version') == 'SOCIALMESSAGE') {
                    self.unreadMsgs[model.get('messageId')] = model;
                }
            });
            //add messages to DOM
            var $closestElem, isBefore;
            if (isChronological) {
                //append to the element above the load button
                $closestElem = $loadMore.closest('.msg-gap').prev();
                if (!$closestElem.length) {
                    $closestElem = $loadMore.closest('.date-group').prev().find('.date-group-content').children(':last');
                }
                isBefore = false;
            } else {
                //prepend to the element below the button
                //since we inserted the msg-gap before the first element in the first date-group, it's gauranteed that next() will return a valid element
                $closestElem = $loadMore.closest('.msg-gap').next();
                isBefore = true;
            }
            self._insertMessagesToDom($closestElem, models, isBefore);

            if (rsp.envelopes.length > 50 && !hasDuplicate) {
                $loadMore.removeClass('loading');
            } else {
                //remove the gap
                self.$el.find('div.msg-gap').remove();
            }
        }, function (error) {
            self.showErrorMessage(errors.COMMON.CHAT_MESSAGE_LIST.LOAD_ERROR, 5000);
        });
    },
    loadMsgContext: function (msgId) {
        //console.log('loading context...');
        this.opts.contextMsgId = msgId;
        if (this.messageCollection.get(msgId)) {
            //if the message is already on the page, highlight light the message and scroll to it
            this.didLoadMsgContext([]);
            return;
        }
        var query = this.sandbox.send({
            id: 'GET_MESSAGE_CONTEXT',
            payload: {
                threadid: this.streamId,
                msgid: msgId,
                beforemaxrow: 25,
                aftermaxrow: 25,
                includestatus: this.isIm
            }
        });

        var self = this;
        query.then(function (rsp) {
            if (rsp.queryResults && rsp.queryResults[0] && rsp.queryResults[0].socialMessages) {
                var results = utils.flattenMessageResponse(rsp.queryResults[0].socialMessages, self.opts.currentUserId, true);
                self.didLoadMsgContext(results);
            } else {
                self.showErrorMessage(errors.COMMON.CONTEXTUAL_CHAT_MESSAGE_LIST.LOAD_MESSAGE_CONTEXT, 5000);
            }
        }, function () {
            self.showErrorMessage(errors.COMMON.CONTEXTUAL_CHAT_MESSAGE_LIST.LOAD_MESSAGE_CONTEXT, 5000);
        });
    },
    toggleDateGroup: function (evt) {
        var $target = $(evt.currentTarget),
            self = this;

        $target.find('i.fa').toggleClass('fa-angle-double-down').toggleClass('fa-angle-double-up');
        $target.siblings('.date-group-content').slideToggle('fast', function () {
            if ($target[0] == self.$el.find('.date-group-header:last')[0]) {
                self.scrollTo({
                    target: 'bottom'
                });
            }
        });
    },
    toggleMaestroGroup: function (evt) {
        var $groupHeader = $(evt.currentTarget),
            $group = $groupHeader.parent();
        if ($group.hasClass('expand')) {
            //collapse it
            $group.toggleClass('expand');
            $group.find('.msg-group-content').addClass('hide');
            $group.find('.msg-group-header-hint span').html('Click to Expand');
        } else {
            //expand it
            $group.toggleClass('expand');
            $group.find('.msg-group-content').removeClass('hide');
            $group.find('.msg-group-header-hint span').html('Click to Collapse');
        }
    },

    didLoadMsgContext: function (messages) {
        //earliest message first messages[0].ingestionDate < messages[1].ingestionDate
        console.log('got message context');
        if (messages.length) {
            //check whether the context over-lap with existing messages
            var lastMsg = messages[messages.length - 1], msgsToAdd = [];
            if (lastMsg.ingestionDate > this.messageCollection.at(0).get('ingestionDate')) {
                //if there is overlap, render them as previous message
                for (var i = 0; i < messages.length; i++) {
                    //de-duplicate
                    var msg = messages[i];
                    if (!this.messageCollection.get(msg.messageId))
                        msgsToAdd.push(msg);
                    else
                        break;
                }

            } else {
                msgsToAdd = messages;
                //need to insert a gap indicator
                this.$scrollArea.find('.date-group:first .date-group-content').children(':first').before(msgGapTmpl());
            }
            var models = this.messageCollection.add(msgsToAdd), self = this;
            models.forEach(function (model) {
                if (!model.get('isRead') && model.get('version') == 'SOCIALMESSAGE') {
                    self.unreadMsgs[model.get('messageId')] = model;
                }
            });
            this.renderPreviousMessages(models);
        }

        //if the message is already on the page, highlight light the message and scroll to it
        var msgView = this.messageViews[this.opts.contextMsgId];
        msgView.$el.addClass('highlighted');
        this.scrollTo({target: msgView.$el});
    },

    renderPreviousMessages: function (messages) {
        var $closestElm = this.$scrollArea.find('.date-group:first .date-group-content').children(':first');
        this._insertMessagesToDom($closestElm, messages, true);
    },

    /**
     * @description insert messages to DOM
     * @param $closestElm: the nearby message that new messages need to be inserted around, the element must be a date-group-content direct child
     *                     e.g. chat-message or maestro-group
     * @param msgModels: backbone message models to be inserted
     * @param prepend: boolean value which specify messages are going to be inserted before or after $closestElm
     */
    _insertMessagesToDom: function ($closestElm, msgModels, isBefore) {
        if (!$closestElm || !$closestElm.length || !msgModels.length)
            return;

        var $closestDayGroup = $closestElm.closest('.date-group');
        if (!$closestDayGroup) {
            this.renderMessages();
            return;
        }

        var grouped = this._groupMessagesArray(msgModels);
        if (!grouped.length)
            return;
        var lastNewDayGroup = grouped[grouped.length - 1],
            self = this,
            markup;

        if (lastNewDayGroup.date == $closestDayGroup.attr('data-date')) { //extract and render last date group
            var lastMsgGroup = lastNewDayGroup.msgGroups[lastNewDayGroup.msgGroups.length - 1];
            if (lastMsgGroup.isMaestroGroup) {
                if ($closestElm.hasClass('maestro-group')) {
                    //merge the last msgGroup to the maestro msg group
                    var $msgGroup = $('<div></div>'), $groupContent = $closestElm.find('.msg-group-content');
                    lastMsgGroup.messages.forEach(function (model) {
                        $msgGroup.append(self._renderMessageView(model));
                    });
                    if (isBefore)
                        $groupContent.prepend($msgGroup.children());
                    else
                        $groupContent.append($msgGroup.children());
                    //update the count
                    var $oldMaestroCount = $closestElm.find('.msg-group-header-text span'),
                        count = parseInt($oldMaestroCount.text());
                    $oldMaestroCount.text(count + lastMsgGroup.messages.length);
                    if (count === 1) {
                        $closestElm.addClass('more-than-one');
                        $closestElm.find('.msg-group-header').removeClass('hide');
                        $groupContent.addClass('hide');
                    }
                }
                //remove the last msgGroup since we already processed it
                lastNewDayGroup.msgGroups.pop();
            }

            if (isBefore)
                $closestElm.before(this._renderMsgGroups(lastNewDayGroup.msgGroups));
            else
                $closestElm.after(this._renderMsgGroups(lastNewDayGroup.msgGroups));

            var countElement = $closestDayGroup.find('.date-group-header-text span'),
                oldCount = parseInt(countElement.text());
            countElement.text(oldCount + lastNewDayGroup.msgCount);

            grouped.pop();
        }

        if (!_.isEmpty(grouped)) {
            markup = this._renderDateGroups(grouped);
            if (isBefore)
                $closestDayGroup.before(markup);
            else
                $closestDayGroup.after(markup);
        }

        //after message are added, recalculate the scroll position
        if (!isBefore)
            this.scrollTo({target: $closestElm});
        else {
            var distToBottom, scrollAreaHeight = this.$scrollArea.height(), targetTop = $closestElm.position().top;
            var $lastMsg = this.$scrollArea.find('.chat-message:last');
            //distToBottom should be the distance to the last message
            distToBottom = $lastMsg.position().top - targetTop + $lastMsg.height();
            var newScrollTop = this.$scrollArea.prop('scrollHeight') - distToBottom - scrollAreaHeight;
            this.scrollTo({target: newScrollTop});
        }
        this.initTooltips();
    },

    _renderMessageView: function (model) {
        var self = this;

        var view = new messageView({
            model: model,
            streamId: self.streamId,
            sandbox: self.sandbox,
            imUsers: self.imUsers,
            eventBus: self.eventBus,
            currentUserId: self.currentUserId,
            canCall: self.canCall,
            oneToOneUserId: self.oneToOneUserId,
            symphony: self.opts.symphony,
            viewWidth: self.viewWidth,
            viewId: self.viewId
        });

        this.messageViews[model.get('messageId')] = view;

        return view.render().el;
    },

    _renderDateGroups: function (dateGroups) {
        var fragment = document.createDocumentFragment(),
            self = this;

        dateGroups.forEach(function (dateGroup) {
            if (!dateGroup.msgCount)
                return;
            dateGroup.moreThanOneMessage = dateGroup.msgCount > 1;
            dateGroup.dateText = moment(dateGroup.date, 'YYYYMMDD').format('dddd ll');

            var $dateGroup = $(dateGroupTmpl(dateGroup)),
                $content = $dateGroup.find('.date-group-content');
            $content.append(self._renderMsgGroups(dateGroup.msgGroups));
            fragment.appendChild($dateGroup[0]);
        });

        return fragment;
    },

    _renderMsgGroups: function (msgGroups) {
        var fragment = document.createDocumentFragment(),
            self = this;

        msgGroups.forEach(function (msgGroup) {
            if (msgGroup.isMaestroGroup) {
                msgGroup.msgCount = msgGroup.messages.length;
                msgGroup.moreThanOne = (msgGroup.msgCount > 1);
                var $maestroGroup = $(maestroGroupTmpl(msgGroup));
                var $content = $maestroGroup.find('.msg-group-content');
                msgGroup.messages.forEach(function (model) {
                    $content.append(self._renderMessageView(model));
                });
                fragment.appendChild($maestroGroup[0]);
            } else {
                var msgFragment = document.createDocumentFragment();
                msgGroup.messages.forEach(function (model) {
                    var markup = self._renderMessageView(model);
                    if (markup) {
                        msgFragment.appendChild(markup);
                    }
                });
                fragment.appendChild(msgFragment);
            }
        });
        return fragment;
    },

    renderNewMessage: function (message) {
        // if message is never going to be rendered, return
        if (this.opts.type === 'im' && message.get('version') === 'MAESTRO') {
            return; // don't show any maestro messages in IM
        }

        var firstNewDayStamp = message.get('dateStamp'),
            $lastDayGroup = this.$el.find('.date-group:last'),
            lastOldDayStamp = $lastDayGroup.attr('data-date'),
            isAtBottomBefore = this.isAtBottom(),
            realPreviousId = $lastDayGroup.find('.chat-message:last').attr('data-message-id');

        //pass in real, rendered previous message to prevent the out-of-order message
        //rendering bug that hides people's names improperly
        if (realPreviousId) {
            var realPrevious = this.messageCollection.get(realPreviousId);
            message.set('previousMessage', realPrevious);
        }

        if (firstNewDayStamp == lastOldDayStamp) {
            var $dateGroupContent = $lastDayGroup.find('.date-group-content');
            if (this._isGroupableMaestro(message)) {
                var $lastElm = $dateGroupContent.children(':last');
                if ($lastElm.hasClass('maestro-group')) {
                    //append to maestro group
                    var markup = this._renderMessageView(message);
                    var $msgGroupContent = $lastElm.find('.msg-group-content');
                    var $oldMaestroCount = $lastElm.find('.msg-group-header-text span'),
                        count = parseInt($oldMaestroCount.text());
                    $msgGroupContent.append(markup);
                    $oldMaestroCount.text(count + 1);
                    if (count === 1) {
                        $lastElm.addClass('more-than-one');
                        $lastElm.find('.msg-group-header').removeClass('hide');
                        $msgGroupContent.addClass('hide');
                    }
                } else {
                    //add a new maestro group
                    var newMaestroGroup = {
                        isMaestroGroup: true,
                        messages: [message]
                    }
                    var markup = this._renderMsgGroups([newMaestroGroup]);
                    $dateGroupContent.append(markup);
                }
            } else {
                //append to the date group directly
                var markup = this._renderMessageView(message);
                $dateGroupContent.append(markup);
            }

            var countElement = $lastDayGroup.find('.date-group-header-text span'),
                oldCount = parseInt(countElement.text());

            countElement.text(oldCount + 1);
        } else {
            //add new date group to the content
            var grouped = this._groupMessagesArray([message]), markup = this._renderDateGroups(grouped);
            this.$el.find('.content').append(markup);
        }

        if (!isAtBottomBefore) {
            //update new message count
            var $newMsgIndicator = this.$el.find('div.new-message-indicator'),
                $countSpan = $newMsgIndicator.find('.count');
            var count = parseInt($countSpan.text(), 10);
            count += 1;
            $countSpan.html(count);
            $newMsgIndicator.removeClass('hidden');
            this.$el.find('div.quick-move-button').addClass('hidden');
        } else {
            this.scrollTo({
                target: 'bottom'
            });
        }

        this.initTooltips();

        // trigger the isTyping to stop
        this.eventBus.trigger('message:rendered', message);
    },

    renderMessages: function () {
        var self = this;
        var expectedRCPluginAsyncCount = _(this.messageCollection.models).reduce(function (total, message){
            //todo: whinea - when we support multiple tables, we need to iterate over media instead of adding one
            return !message.attributes.media ? total : total + 1;
        }, 0);

        this.scrollToBottomAfterRCPPostRender = _.after(expectedRCPluginAsyncCount, function(){
            //if the user has not scrolled up at all
            if (self.$el.find('div.quick-move-button').attr('class').indexOf('hidden') != -1){
                self.scrollTo({target: 'bottom'});
            }
        });
        this.listenTo(this.eventBus, 'richContent:PostRender:' + this.viewId, this.scrollToBottomAfterRCPPostRender.bind(this));
        var grouped = this._groupMessagesArray(this.messageCollection.models),
            markup = this._renderDateGroups(grouped);

        this.$el.find('.content').html(markup);
        this.scrollTo({target: 'bottom'});

        this.initTooltips();
    },
    _isGroupableMaestro: function (msgModel) {
        return msgModel.get('version') === 'MAESTRO' && (msgModel.get('event') === 'JOIN_ROOM' || msgModel.get('event') === 'LEAVE_ROOM');
    },
    _groupMessagesArray: function (messages) {
        if (this.opts.type === 'im') {
            messages = _.reject(messages, function (model) {
                return model.get('version') === 'MAESTRO';
            });
        }
        if (!messages.length)
            return [];
        //convert the ordered message array to groups by date.
        //Each date group consists of sub-groups which may be a group of normal chat message or a group of maestro messages
        var groups = [], dateGroup = {
            date: messages[0].get('dateStamp'),
            msgCount: 0,
            msgGroups: []
        }, currentMsgGroup = { isMaestroGroup: this._isGroupableMaestro(messages[0]), messages: [] };

        for (var idx in messages) {
            var msg = messages[idx], dateStamp = msg.get('dateStamp'), isGroupableMaestro = this._isGroupableMaestro(msg);

            if (dateStamp != dateGroup.date) {
                dateGroup.msgGroups.push(currentMsgGroup);
                dateGroup.msgCount += currentMsgGroup.messages.length;
                groups.push(dateGroup);
                dateGroup = {
                    date: msg.get('dateStamp'),
                    msgCount: 0,
                    msgGroups: []
                };
                currentMsgGroup = { isMaestroGroup: isGroupableMaestro, messages: []};
            }

            if (currentMsgGroup.isMaestroGroup != isGroupableMaestro) {
                dateGroup.msgGroups.push(currentMsgGroup);
                dateGroup.msgCount += currentMsgGroup.messages.length;
                currentMsgGroup = { isMaestroGroup: isGroupableMaestro, messages: []};
            }

            currentMsgGroup.messages.push(msg);
        }

        dateGroup.msgGroups.push(currentMsgGroup);
        dateGroup.msgCount += currentMsgGroup.messages.length;
        groups.push(dateGroup);

        return groups;
    },

    storeViewWidth: function(args, data){
        this.viewWidth = data.width;
    },

    destroy: function () {
        _.each(_.values(this._dropCache), function (drop) {
            drop.destroy();
        });

        this.destroyTooltips();
        this.eventBus.off();

        baseMessages.prototype.destroy.call(this);
    },

    onDeleteMessage: function (context, msgId) {
        if (this.messageViews[msgId]) {
            this.messageViews[msgId].destroy();
            delete this.messageViews[msgId];

            this.setAutoloadIndicator('available'); //now guaranteed to have at least one message not viewable
            this.moreMessagesAvailable = true;

            var $dateGroup = this.$el.find('.date-group').eq(0);
            //we might also need to remove a date group if its empty so check for that condition
            if (!$dateGroup.find('.chat-message').length) {
                $dateGroup.remove();
            }
        }

        var msg = this.messageCollection.get(msgId);

        if (msg) {
            this.messageCollection.remove(msg);
        }
    },

    deleteAllMessages: function() {
        if(this.isIm) { //used for cronJob to remove IM history
            this.messageHistoryCleared = true;

            var toDelete = [];

            this.messageCollection.each(function(msg){
                toDelete.push(msg.get('messageId'));
            });

            for(var i = 0, len = toDelete.length; i < len; i++) {
                this.onDeleteMessage(null, toDelete[i]);
            }
        }
    },

    toggleHideMessagesIM: function(context, active) {
        var self = this;

        if(active) {
            this.sandbox.registerCronJob({
                cronName: 'hideMessagesIM', //be aware the onTick only fires once since this cronJob can only exist once (uniqueness based on name)
                cronOpts: {
                    cronTime: '1 0 * * *', //1 minute after midnight, every day... http://crontab.org/
                    onTick: function() {
                            self.sandbox.publish('hideMessagesIM:trigger', null, {});
                    },
                    start: true
                }
            });
        } else {
            this.sandbox.removeCronJob({'cronName':'hideMessagesIM'})
        }
    }
});
_.extend(module.exports.prototype, showErrorMessage, hasTooltips);
