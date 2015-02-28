var Backbone = require('backbone');
var Handlebars = require('hbsfy/runtime');
var config = require('../../../config/config');
var emoji = require('emoji-images');
var Q = require('q');
var _ = require('underscore');
var uploadView = require('./views/uploadView.js');
var errors = require('../../../config/errors');
var uploadAgreement = require('../../common/uploadAgreement/uploadAgreement');

var chatMessageTmpl = require('./templates/text-input.handlebars');
var personResultTmpl = require('../templates/person-result.handlebars');
var mentionResultTmpl = require('./templates/mention-result.handlebars');
var emojiResultTmpl = require('./templates/emoji-result.handlebars');
var emojiResultBlockTmpl = require('./templates/emoji-result-block.handlebars');
var richEntityTmpl = require('./templates/rich-entity.handlebars');

var MASTER_ENTITY_REGEX = new RegExp('(?:' + config.URL_REGEX.source + ')|(?:#' + config.HASHTAG_REGEX.source + ')|(?:[\$]' + config.CASHTAG_REGEX.source + ')|(:' +
    config.EMOJI_REGEX.source + ':)', 'ig');

//find the last occurrence of the pattern
var MASTER_ENTITY_REGEX_LAST = new RegExp('(' + MASTER_ENTITY_REGEX.source + ')$', 'ig');

window.honk = MASTER_ENTITY_REGEX_LAST;

Handlebars.registerPartial('personResult', personResultTmpl);

require('../helpers/index');
require('jquery-ui');
require('maxlength');
require('caret');
require('atwho');

require('../helpers/index');

module.exports = Backbone.View.extend({
    events: {
        'keyup .text-input-text': 'inputKeystroke',
        'keydown .text-input-text': 'inputKeypress',
        'click .join-room': 'joinRoom',
        'click .entity': 'selectRichEntity',
        'click .entity .cancel': 'removeRichEntity',
        'click .text-input-text': 'removeSelectedState',
        'paste .text-input-text': 'pasteInTextInput',
        'click .file-upload': 'selectFile',
        'click .screen-clip': 'screenClip',
        'change .file-input': 'changeFiles',
        'click .file-remove': 'removeAttachedItem',
        'click .expand-actions': 'toggleActions',
        'click .attach': 'openPanel',
        'click .emoticons': 'openPanel',
        'click .disable': 'quickDisable',
        'click .chime': 'chime'
    },

    initialize: function (opts) {
        var self = this;
        self.opts = opts || {};
        self.sandbox = opts.sandbox;
        this.eventBus = opts.eventBus || _.extend({}, Backbone.Events);
        self.opts.currentHeight = null;
        self.threadId = opts.threadId;
        self.userId = opts.userId;
        self.disableInput = opts.disableInput === undefined ? false : opts.disableInput;
        self.showButton = opts.showButton === undefined ? true : opts.showButton;
        self.maxLength = opts.maxLength || 140;
        self.buttonText = opts.buttonText || 'SEND';
        self.enableFileUpload = opts.enableFileUpload === undefined ? true : opts.enableFileUpload;
        self.sendOnEnter = opts.sendOnEnter === undefined ? true : opts.sendOnEnter;
        this.showRejoinButton = false;
        self.isSending = false;
        self.blockEnter = false;
        this.range = null;
        this.uploadView = null;
        this.uploadFiles = [];
//        this.richContent = null;
        this.qSupportedMimeTypes = this.sandbox.getData('supportedMimeTypes');
        this.qisRunningInClientApp = this.sandbox.isRunningInClientApp();
        this.supportedMimeTypes = [];
        this.qRendered = Q.defer();
        this.qIsFloating = this.sandbox.isFloatingWindow();
        this.uploadAgreementAccepted = false;
        this.rteActions = (opts.hasOwnProperty('rteActions') && Object.prototype.toString.call(opts.rteActions) === '[object Array]') ? opts.rteActions : ['emoticons', 'attach', 'chime', 'disable'];

        this.rteActions = _.without(this.rteActions, 'emoticons');

        if (this.opts.participantCount > 2) {
            this.rteActions = _.without(this.rteActions, 'chime');
        }

        this.expandDirection = opts.expandDirection || 'n';
        this.btnSize = 29;
        this.emoticons = {
            "smile": "smile",
            "laughing": "laughing",
            "blush": "blush",
            "relaxed": "relaxed",
            "smirk": "smirk",
            "heart_eyes": "heart_eyes",
            "flushed": "flushed",
            "satisfied": "satisfied",
            "grin": "grin",
            "wink": "wink",
            "stuck_out_tongue": "stuck_out_tongue",
            "sleeping": "sleeping",
            "worried": "worried",
            "fearful": "fearful",
            "frowning": "frowning",
            "confused": "confused",
            "disappointed": "disappointed",
            "cry": "cry",
            "sob": "sob",
            "rage": "rage",
            "sunglasses": "sunglasses",
            "innocent": "innocent",
            "yum": "yum",
            "facepalm": "facepalm",
            "heart": "heart",
            "broken_heart": "broken_heart",
            "exclamation": "exclamation",
            "question": "question",
            "zzz": "zzz",
            "+1": "+1",
            "thumbsdown": "thumbsdown",
            "woman": "woman",
            "man": "man",
            "kiss": "kiss",
            "clap": "clap",
            "sunny": "sunny",
            "umbrella": "umbrella",
            "snowman": "snowman",
            "gift": "gift",
            "dollar": "dollar",
            "airplane": "airplane",
            "rocket": "rocket",
            "boat": "boat",
            "steam_locomotive": "steam_locomotive",
            "four_leaf_clover": "four_leaf_clover",
            "bell": "bell",
            "bulb": "bulb",
            "computer": "computer",
            "hammer": "hammer",
            "phone": "phone",
            "microphone": "microphone",
            "fork_and_knife": "fork_and_knife",
            "pizza": "pizza",
            "wine_glass": "wine_glass",
            "beer": "beer",
            "cocktail": "cocktail",
            "checkered_flag": "checkered_flag",
            "sos": "sos",
            "no_entry": "no_entry",
            "white_check_mark": "white_check_mark"
        } || opts.emoticons;

        this.psEvents = {
            'screensnip:open': this.screenSnipOpen.bind(this),
            'screensnip:sent': this.screenSnipSent.bind(this),
            'grid:resized': this.actionsLayout.bind(this)
        };

        this.psEvents['uploadAgreement'] = function (context, val) {
            self.uploadAgreementAccepted = val;
        };

        this.psEvents['click'] = function (context, e) {
            self.clickAny(e);
        };

        Object.keys(this.psEvents).forEach(function (subEvent) {
            self.sandbox.subscribe(subEvent, self.psEvents[subEvent]);
        });


        this.listenTo(this.eventBus, 'textinput:change', function (data) {
            self.disableInputDidChange(data);
        });

        var q = Q.defer();

        this.draftData = q.promise;

        this.accountDataPromise = this.sandbox.getData('app.account');

        this.sandbox.getData('drafts.' + this.threadId).then(function (rsp) {
            q.resolve(rsp);
        });

        this.sandbox.getData('app.acceptUploadAgreement').then(function (rsp) {
            self.uploadAgreementAccepted = rsp;
        });

        this.listenTo(this.eventBus, 'uploads:complete', function (uploadFileMetaData) {
            self.uploadFiles = uploadFileMetaData;

            if (uploadFileMetaData.length >= 10) {
                this.$el.find('.attach').addClass('disabled');
            } else {
                this.$el.find('.attach').removeClass('disabled');
            }
        });

        this.listenTo(this.eventBus, 'uploads:clear', this.clearAttachmentData);

        this.listenTo(this.eventBus, 'input:send', function () {
            self.send();
        });

        this.listenTo(this.eventBus, 'textinput:parent:focused', function () {
            self.qRendered.promise.then(function () {
                if (!self.$textarea) {
                    self.$textarea = self.$el.find('.text-input-text');
                }
                if (!self.$textarea.is(':focus')) {
                    self.placeCaretAtEnd(self.$textarea[0]);
                }
            });
        });

        this.listenTo(this.eventBus, 'textinput:show', function () {
            this.actionsLayout();
        });
    },
    render: function () {
        var self = this;

        Q.all([self.qSupportedMimeTypes, self.qisRunningInClientApp, self.qIsFloating, self.accountDataPromise]).done(function (rsp) {
            if (rsp[2] || !rsp[3].entitlement.sendFilesEnabled) { //remove attach for floating windows
                self.rteActions = _.without(self.rteActions, 'attach');
            }

            self.$el.html(chatMessageTmpl({
                'buttonText': self.buttonText,
                'placeholderText': self.opts.placeholderText,
                'disableInput': self.disableInput,
                'showButton': self.showButton,
                'maxLength': self.maxLength, //used for maxlength plugin
                'showRejoinButton': self.showRejoinButton,
                'enableFileUpload': self.enableFileUpload,
                'supportedMimeTypes': rsp[0].join(','),
                'isRunningInClientApp': rsp[1],
                'rteActions': self.rteActions,
                'emoticons': self.emoticons
            }));
            self.supportedMimeTypes = rsp[0];
            self.qRendered.resolve();
        }, function () {
            self.qRendered.reject();
        });

        return this;
    },
    postRender: function () {
        var self = this;

        this.qRendered.promise.done(function () {
            self.$textarea = self.$el.find('.text-input-text');
            self.$textarea.atwho({
                at: '@',
                alias: 'mentions',
                tpl: mentionResultTmpl,
                insert_tpl: richEntityTmpl,
                callbacks: {
                    remote_filter: _.debounce(_.bind(self._usersQuery, self), 100),
                    tpl_eval: function (tpl, map) {
                        return tpl(map);
                    },
                    matcher: function (flag, subtext) {
                        var regex = new RegExp(flag + '([a-z0-9_\+\-,\']+[\\s]{0,1}[a-z0-9_\+\-,\']*$)', 'gi'),
                            match = regex.exec(subtext);

                        if (match) {
                            return match[1];
                        } else {
                            return null;
                        }
                    },
                    sorter: function (query, items) {
                        //TODO: get the BE to sort these based off of communication frequency
                        return _.sortBy(items, function (item) {
                            return item.person.prettyName;
                        });
                    },
                    before_reposition: function (offset) {
                        var body = $("body")[0], clientRect = body.getBoundingClientRect();
                        var dropdown = this.$el.find("#at-view-mentions")[0], dropdownRect = dropdown.getBoundingClientRect();
                        if (offset.left + dropdownRect.width > clientRect.right) {
                            offset.left = clientRect.right - dropdownRect.width - 50;
                        }
                        return offset;
                    },
                    inserting_wrapper: function ($inputor, content, suffix) {
                        var wrapped_content = "<span contenteditable='false'>" + content + "</span>";
                        return wrapped_content;
                    }
                }
            }).atwho({
                at: ':',
                alias: 'emoji',
                tpl: emojiResultTmpl,
                insert_tpl: emojiResultBlockTmpl,
                data: config.ALLOWABLE_EMOJI,
                callbacks: {
                    tpl_eval: function (tpl, map) {
                        return tpl(map);
                    },
                    filter: function (query, data, searchKey) {
                        var results = [];

                        for (var i = 0; i < data.length; i++) {
                            var item = data[i];

                            if (~item[searchKey].toLowerCase().indexOf(query.toLowerCase())) {
                                results.push(item);
                            }
                        }

                        return results;
                    },
                    matcher: function (flag, subtext) {
                        var regex = new RegExp(flag + '([\\w\\d_\(\)]+)$', 'gi'),
                            match = regex.exec(subtext);

                        if (match) {
                            var ignoredEmoji = _.map(_.keys(config.EMOJI_REPLACEMENTS), function (i) {
                                return i.replace('\\', '');
                            });

                            if (_.contains(ignoredEmoji, flag + match[1])) {
                                return null;
                            } else {
                                return match[1];
                            }
                        } else {
                            return null;
                        }
                    },
                    inserting_wrapper: function ($inputor, content, suffix) {
                        var wrapped_content = "<span contenteditable='false'>" + content + "</span>";
                        return wrapped_content;
                    }
                }
            }).maxlength({
                threshold: self.maxLength / 2,
                warningClass: "label label-info",
                limitReachedClass: "label label-danger",
                message: '%charsRemaining% characters left.',
                placement: self.opts.maxlengthplacement || 'top',
                showCharsTyped: false,
                showMaxLength: false,
                ignoreBreaks: true,
                onSafeCount: _.bind(self.onSafeCount, self),
                onOverCount: _.bind(self.onOverCount, self)
            }).on('inserted-mentions.atwho inserted-emoji.atwho', function (event, flag) {
                //insert space after the entity so it's the same as createTagAndCaret
                self.$textarea.html(self.$textarea.html() + "&nbsp;");
                //blockEnter so that it won't send the message just bcz user select a entity from the list using enter key
                self.blockEnter = true;
                _.delay(function () {
                    self.blockEnter = false;
                }, 250);
            });

            if (self.opts.resize) {
                self.$el.find('.text-input-wrap').resizable({
                    handles: self.opts.resize,
                    helper: "ui-resizable-helper",
                    maxHeight: 250,
                    minHeight: 44,
                    stop: function (event, ui) {
                        //don't change width
                        $(event.target).css('width', '');
                        self.$el.find('.text-input-text').css('width', '');
                        self.eventBus.trigger('textinput:resize');
                        self.actionsLayout();
                    }
                });
            }

            self.actionsLayout();

            self.draftData.then(function (draft) {
                if (draft) {
                    _.delay(function () {
                        //                    self.$textarea.val(draft);
                        self.$textarea.html(draft);
                    }, 100);
                }
            });

            self.eventBus.trigger('textinput:rendered');
        });

        return this;
    },

    actionsLayout: function () {
        var $input = this.$el.find('.text-input-text'),
            $inputWrap = this.$el,
            $actionList = this.$el.find('.action-list'),
            $expand = this.$el.find('.expand-actions'),
            inputWidth = parseInt($inputWrap.css('width')) - 4;

        if (this.rteActions.length === 0) { //0 entries works by default only when the expand emoticon isnt shown

            $input.css({'width': inputWidth - 2});
            return;
        }

        if (this.disableInput === true) {
            $actionList.removeClass('expanded');
            this.$el.find('.text-area-button').addClass('hidden');
            this.$el.find('.disable').addClass('disabled').removeClass('hidden');
            $input.css({'width': inputWidth - (this.btnSize) - 2});
            return;
        } else {
            this.$el.find('.text-area-button').removeClass('hidden disabled');
        }

        if (this.rteActions.length === 1) {
            $input.css({'width': 'calc(100% - ' + ((this.btnSize) + 2) + 'px)'});
            return;
        }

        if (parseInt($input.css('height')) < 64 && parseInt($inputWrap.css('width')) < 430) { // 430px = simple-grid-small
            $expand.removeClass('hidden expanded');
            $actionList.addClass('hidden').removeClass('expanded');

            $input.css({'width': 'calc(100% - ' + ((this.btnSize) + 2) + 'px)'});
        } else {
            var inputHeight = parseInt($input.css('height')) - 4,
                btnCount = this.rteActions.length,
                btnsPerColumn = Math.floor((inputHeight + 4) / this.btnSize),
                columnsNeeded = Math.ceil(btnCount / btnsPerColumn);

            $expand.addClass('hidden');
            $actionList.removeClass('hidden expanded');

            $input.css({'width': 'calc(100% - ' + ((columnsNeeded * this.btnSize) + 2) + 'px)'});
        }
    },

    toggleActions: function () {
        this.$el.find('.expand-actions').toggleClass('expanded');
        this.$el.find('.action-list').toggleClass('expanded hidden')
    },

    openPanel: function (e) {
        if (!e) {
            this.$el.find('.actions-popup').addClass('hidden');
            return;
        }

        var $btn = $(e.currentTarget),
            popup = $btn.attr('data-popup'),
            $popup = this.$el.find('.popup-' + popup),
            $popups = this.$el.find('[class*="popup-"]'),
            btnPosn = $btn.position(),
            actionsPosn = this.$el.find('.action-list').position(),
            top = 0,
            left = 0;

        if ($btn.hasClass('disabled')) {
            return; //eg: only allow 10 uploads at a time
        }

        if (!$popup.hasClass('hidden')) { //toggle open/close
            $popups.addClass('hidden');
            return;
        }

        if (this.expandDirection === 'n') {
            top = actionsPosn.top - btnPosn.top + parseInt($popup.css('height')) + 4;
            left = actionsPosn.left + this.btnSize + btnPosn.left - parseInt($popup.css('width')) + 3;
        }

        if (this.expandDirection === 'l') {
            top = actionsPosn.top - btnPosn.top - 4;
            left = actionsPosn.left + this.btnSize + btnPosn.left - parseInt($popup.css('width')) - 35;
        }

        $popups.addClass('hidden');
        $popup.removeClass('hidden').css({
            top: -top,
            left: left
        });
    },

    clickAny: function (e) {
        var $elem = $(e.target);

        if (!$elem.hasClass('attach') && !$elem.hasClass('emoticons')) {
            this.$el.find('.actions-popup').addClass('hidden');
        }
    },

    getValue: function () {
        var value = this.$textarea.html();

        return this.formatTextInputHTMLToText(value);
    },

    _usersQuery: function (query, callback) {
        var self = this;

        if (query != null && query.length >= config.MIN_SEARCH_LENGTH) {
            this.sandbox.send({
                'id': 'SOLR_SEARCH_URL',
                'payload': {
                    'q': query,
                    'type': 'people'
                }
            }).then(function (rsp) {
                if (rsp.queryResults && rsp.queryResults[0] && rsp.queryResults[0].users) {
                    callback.call(this, self._formatUsersQueryResponse(rsp.queryResults[0].users));
                }
            });
        }
    },

    _formatUsersQueryResponse: function (users) {
        var ret = [];

        _.each(users, function (u) {
            var obj = {};
            obj.person = u.person;
            obj.text = u.person.prettyName;
            obj.value = '@' + u.person.id;

            ret.push(obj);
        });

        return ret;
    },

    destroy: function () {
        if (this.opts.resize) {
            this.$el.find('.text-input-wrap').resizable('destroy');
        }

        this.$textarea.atwho('destroy').off(); //off() to undelegate all the maxlength functions

        var self = this;
        Object.keys(this.psEvents).forEach(function (subEvent) {
            self.sandbox.unsubscribe(subEvent, self.psEvents[subEvent]);
        });

        this.remove();
    },

    inputKeystroke: function () {
        var inputText = this.$textarea.html();
        this.eventBus.trigger('input:event', inputText);
    },

    inputKeypress: function (e) {
        var input = this.$el.find('.text-input-text'),
            inputText,
            KEY_SPACE = 32,
            KEY_ENTER = 13;

        this.range = window.getSelection().getRangeAt(0);

        this.eventBus.trigger('input:keydown', e);

        if (e.which == KEY_SPACE || e.which == KEY_ENTER) {
            // on space, check if last word has a hash or cashtag and create entity if so
            this.createTagAndSetCaret();
        }

        // Do not allow browser behaviour of formatting contenteditable with italics/bold/underline
        if (e.ctrlKey || e.metaKey) {
            switch (String.fromCharCode(e.which).toLowerCase()) {
                case 'i':
                    e.preventDefault();
                    break;
                case 'b':
                    e.preventDefault();
                    break;
                case 'u':
                    e.preventDefault();
                    break;
            }
        }

        if (e.which === KEY_ENTER && !e.ctrlKey && !e.shiftKey) {
            e.preventDefault();

            if (!this.sendOnEnter) {
                return;
            }

            if (this.blockEnter) {
                this.blockEnter = false;
                return;
            }

            inputText = this.getValue();

            if (inputText.trim().length || this.uploadFiles.length || this.$el.find('.rich-content').length > 0) {
                this.clickSend(inputText);
            }
        }
    },
    onSafeCount: function () {
        if (this.showButton && this.overCount)
            this.$el.find('.text-input-send').removeAttr('disabled');
        this.overCount = false;
    },
    onOverCount: function () {
        if (this.showButton && !this.overCount)
            this.$el.find('.text-input-send').attr('disabled', 'disabled');
        this.overCount = true;
        //TODO: add visual affect to textarea if no button is shown
    },
    getRichContentFromText: function (messageText) {
        var ret = null,
            richContents = [],
            offset = 0,
            textareaNodes = _.filter(this.$textarea[0].childNodes, function(node) {
                return node.data != "";
            });
//            textareaNodes = this.$textarea[0].childNodes;
        _.each(textareaNodes, function(node){
            if (node.nodeName == '#text') {
                offset += node.data.length;
            }
            //todo: whinea - we need a default way a standard way of handling emojies, urls, mention, rich content offsets. The code is hacky and needs re-writing
            else if (node.nodeName == 'SPAN'){
                var tokenNode = $(node).children().eq(0);
                if (tokenNode.attr('class') == 'table-token'){
                    var $el = $(tokenNode).children().eq(0);
                    var richContent = {
                        "index": offset,
                        "text": $el.attr('plugin-value'),
                        "type": $el.attr('plugin-name')
                    };
                    richContents.push(richContent);
                }
                else if (tokenNode.attr('class') == 'emoji'){
                    offset+=tokenNode.attr('data-value').length;
                }
                else{
                    if (tokenNode.length == 0){

                    }
                    else {
                        offset += tokenNode[0].innerText.length;
                    }
                }
            }
        });

        if (richContents.length > 0 && !this.isChiming)
        {
            if (richContents[0].text.length > 2000){
                throw  "The table you tried to send is too large!";
            }
            ret = {"mediaType":"CODE","content": JSON.stringify(richContents)}
        }
        return ret;
    },
    getEntitiesFromText: function (messageText) {
        var entities = {
            //the format that backend defined, don't change the format
            hashtags: [],
            userMentions: [],
            urls: []
        };

        if (this.isChiming)
            return entities;

        //all changes here should not alter the text itself, should only modify the entities object!!!
        var curIdx = 0, matches, self = this;
        //use regex to parse URL first
        while (matches = config.URL_REGEX.exec(messageText)) {
            var url = {};
            url.id = url.text = url.expandedUrl = matches[0];
            url.indexEnd = config.URL_REGEX.lastIndex;
            url.indexStart = url.indexEnd - url.text.length;
            url.type = 'URL';
            entities.urls.push(url);
        } // end of while matches

        //use the entity dom to parse keywords/mentions
        this.$textarea.find('.entity').each(function () {
            var $this = $(this), val = $this.attr('data-value'), txtToProcess = messageText.substr(curIdx),
                entity = {
                    "indexStart": null,
                    "indexEnd": null,
                    "id": null,
                    "text": val,
                    "type": null
                };

            if (val.startsWith('@')) {
                entity.type = 'USER_FOLLOW';
                entity.id = $this.attr('data-userid');
                entity.screenName = $this.attr('data-screenName');
                entity.prettyName = $this.attr('data-prettyName');
                //refer to formatTextInputHTMLToText where it changes the entity to messageText, here we do the same thing for entities object
                entity.text = '@' + entity.screenName;
                entity.userType = 'lc';
                entities.userMentions.push(entity);
            } else if (val.startsWith('#') || val.startsWith('$')) {
                entity.type = 'KEYWORD';
                entity.id = entity.text;
                entities.hashtags.push(entity);
            }

            entity.indexStart = txtToProcess.indexOf(entity.text) + curIdx;
            entity.indexEnd = entity.indexStart + entity.text.length;

            curIdx = entity.indexEnd + 1;
        });
        return entities;
    },
    formatMessage: function (messageText) {
        var entities = this.getEntitiesFromText(messageText);
        var richContent = this.getRichContentFromText(messageText);
        var longUserId = Number(this.userId);
        return {
            sendingApp: "lc",
            messageDate: new Date().getTime(),
            externalOrigination: false,
            isPrivate: false,
            from: {
                userType: config.USER_TYPE.GS_USER,
                id: longUserId
            },
            text: messageText,
            entities: entities,
            version: "SOCIALMESSAGE",
            threadId: this.threadId,
            media: richContent
        };
    },

    send: function () {
        this.clickSend(this.getValue());
    },

    clickSend: function (text) {
        var self = this,
            payload = null;

        if (this.overCount) {
            return;
        }

        if (this.isSending) {
            return;
        }

        if(this.disableInput) {
            return;
        }

        var inputText = text.trim();

        if (inputText === '' && this.uploadFiles.length === 0 && this.$el.find('.rich-content').length < 1) {
                //todo they didnt write anything
                return;
        }

        this.isSending = true;

        var sendingLoader = _.delay(function () {
            self.$textarea.addClass('sending');
        }, 500); //show loading gif if it takes > .5s to send message

        var errorSending = function(error){
            error = (typeof error == 'object') ? error.message : error;
            self.isSending = false;
            clearTimeout(sendingLoader);
            self.$textarea.removeClass('sending').addClass('error'); //todo: improve this
            self.eventBus.trigger('textinput:error', error);
            self.$textarea.html('');
        };
        try {
            if (this.uploadFiles.length) {
                payload = _.extend(self.formatMessage(inputText), {
                    'attachments': self.uploadFiles
                });
            } else {
                payload = self.formatMessage(inputText);
            }
        }
        catch(e){
            errorSending(e);
        }

        this.sandbox.send({
            'id': 'SEND_CHAT',
            'payload': payload
        }).then(function () {
            self.isSending = false;
            clearTimeout(sendingLoader);
            self.$textarea.removeClass('sending').removeClass('error').focus();
            self.eventBus.trigger('input:event', null).trigger('textinput:sent', null);
            if (payload.attachments) {
                self.clearAttachmentData();
            }
        }, function (xhr, msg, err) {
            var error = JSON.parse(xhr.responseText);
            errorSending(error.message);
        });
        //clear textInput immediately
        this.$textarea.html('');
    },

    disableInputDidChange: function (data) {
        if (data.streamId === this.threadId) {
            this.$el.find('.join-room').toggleClass('hide', !this.showRejoinButton);
            this.opts.placeholderText = data.placeholderText;
            this.$textarea.attr('placeholder', this.opts.placeholderText);
            this.disableInput = data.disableInputOption;

            if (this.disableInput) {
                this.$textarea.text('');
                this.$textarea.attr('disabled', 'disabled');
                this.$textarea.attr('contenteditable', false);
            } else {
                this.$textarea.removeAttr('disabled');
                this.$textarea.attr('contenteditable', true);
                this.postRender();
            }

            this.actionsLayout();
        }
    },

    joinRoom: function () {
        var self = this;

        this.sandbox.send({
            id: 'GET_ROOM_MANAGER',
            payload: {
                action: 'adduser',
                threadid: self.threadId,
                userid: self.userId
            }
        }).then(function (rsp) {
            // successful rejoin
            self.eventBus.trigger('room:rejoin');
        }, function (rsp) {
            $target.addClass('error').text(errors.COMMON.TEXT_INPUT.JOIN_ROOM);
            return; //todo errors
        });
    },

    selectRichEntity: function (e) {
        var $el = $(e.currentTarget).find('> .entity');

        $el.toggleClass('selected');
    },

    removeRichEntity: function (e) {
        $(e.currentTarget).closest('.entity').parent('span').remove();
    },

    removeSelectedState: function (e) {
        $(e.target).find('.selected').removeClass('selected');
        this.$el.find('.hashtag-entity').attr('contenteditable', false);
        this.$el.find('.cashtag-entity').attr('contenteditable', false);
    },

    pasteInTextInput: function (e) {
        e.preventDefault();

        var self = this,
            html = '',
            text = '',
            clipboard = (e.originalEvent || e).clipboardData;
        this.sandbox.parseUsingRichContentPlugins({clipboard: clipboard, sandbox: this.sandbox}).then(function(response) {
            if (response.useView == false) {
                if(response.useHtml) {
                    var $pasted = $('<div></div>').html(response.text.html());
                    $pasted.find('img').each(function () {
                        var $this = $(this);
                        $this.replaceWith($this.attr('title'));
                    });
                    text = $pasted.text().trim();
                }
                else
                    text = response.text.text().trim();
            }
            var sel, range, match, prevIndex = 0;
            while ((match = MASTER_ENTITY_REGEX.exec(text)) !== null) {
                //find all the rich entities and replace with relative html
                var matchStr = match[0],
                    thisIndex = match.index,
                    args, template, formattedText;

                if (matchStr[0] == ':') {
                    var emojiName = matchStr.substr(1, matchStr.length - 2);
                    if (self.emoticons[emojiName] != undefined) {
                        args = { name: matchStr };
                        template = emojiResultBlockTmpl;
                        formattedText = template(args) + '&nbsp;'
                    } else {
                        continue;
                    }
                } else {
                    if (matchStr[0] == '$' && !isNaN(matchStr.substr(1))) {
                        //if the cashtag string is all digits e.g. 123 (original cashtag will be $123 which is invalid)
                        continue;
                    }
                    args = { value: matchStr, text: matchStr };
                    template = richEntityTmpl;
                    formattedText = "<span contenteditable='false'>" + template(args) + "</span>&nbsp;";
                }

                //html encode the normal text so that special characters e.g. < > & could be rendered
                var textSegment = text.substr(prevIndex, thisIndex - prevIndex);
                html += $('<div/>').text(textSegment).html();
                //add the rich entity
                html += formattedText;
                prevIndex = thisIndex + matchStr.length;
            }

            if (prevIndex !== text.length - 1) {
                html += $('<div/>').text(text.substr(prevIndex)).html();
            }

            if (window.getSelection) {
                sel = window.getSelection();
                if (sel.getRangeAt && sel.rangeCount) {
                    range = sel.getRangeAt(0);
                    range.deleteContents();

                    var frag = document.createDocumentFragment(), $pastedNodes = $('<div/>').html(html), childNode, lastNode;
                    while ((childNode = $pastedNodes[0].firstChild)) {
                        lastNode = frag.appendChild(childNode);
                    }
                    if (response.useView == true) {
                        var spacer = $('<span></span>').html('&nbsp;');
                        var spacer2 = $('<span></span>').html('&nbsp;');
                        frag.appendChild(spacer2[0]);
                        frag.appendChild(response.view.el);
                        lastNode = frag.appendChild(spacer[0]);
                    }
                    range.insertNode(frag);

                    if (lastNode) {
                        range = range.cloneRange();
                        range.setStartAfter(lastNode);
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                }
            } else if (document.selection && document.selection.type !== 'Control') {
                document.selection.createRange().pasteHTML(html);
            }
        });
    },

    createTagAndSetCaret: function () {
        var frag = document.createElement('span');
        frag.setAttribute('contenteditable', false);

        var text = this.$textarea.text(),
            caretPos = this.$textarea.caret('pos'),
            subtext = MASTER_ENTITY_REGEX_LAST.exec(text.slice(0, caretPos)),
            tmpl;

        if (!subtext) {
            return;
        }

        //Reset regexp
        MASTER_ENTITY_REGEX_LAST.lastIndex = 0;

        subtext = subtext[0];
        if (subtext[0] == '$' && !isNaN(subtext.substr(1))) {
            //if the cashtag string is all digits e.g. 123 (original cashtag will be $123 which is invalid)
            return;
        }

        var charBefore = this.range.endContainer.textContent.charAt(this.range.endOffset - subtext.length - 1);
        //if the hashtag doesn't has a space beforeward, # is not the beginning of the string, return
        if (this.range.endOffset > subtext.length && !/\s/.test(charBefore)) {
            return;
        }

        tmpl = richEntityTmpl({text: subtext, value: subtext});
        //refer to jquery.atwho.js -> inserting_wrapper function, adding space to the rich entity
        frag.innerHTML = tmpl;

        this.range.setStart(this.range.endContainer, this.range.endOffset - subtext.length);
        this.range.setEnd(this.range.endContainer, this.range.endOffset);
        this.range.deleteContents();
        this.range.insertNode(frag);
        this.range.collapse(false);

        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(this.range);
    },

    formatTextInputHTMLToText: function (inputHTML) {
        var $el = $('<div></div>'),
            self = this,
            inputText;

        //change the inputHTML instead of the original editableDiv, you don't want to change the content every time the function is called
        $el.html(inputHTML).find('.entity, .emoji, .rich-content, .non-message').each(function () {
            var $this = $(this), val = $this.attr('data-value');
            if ($this.hasClass('rich-content') || $this.hasClass('non-message')){
                val = " ";
            }else if ($this.hasClass('entity')) {
                var $originalEntity = self.$textarea.find('.entity[data-value="' + val + '"]'),
                    screenName = $originalEntity.attr('data-screenName');
                //if it's a mention, the val should be @screenName instead of @id
                if(screenName) {
                    val = '@' + screenName;
                }
            }
            $this.replaceWith(val);
        });

        //trim the generated \n between nodes
        var len = $el[0].childNodes.length;
        for (var i = 0; i < len; i++) {
            var node = $el[0].childNodes[i];
            if (node.nodeType == 3) { //text node
                var text = node.textContent;
                if (!text.trim()) {
                    //trim the node
                    node.textContent = '';
                    continue;
                }
            }
        }

        $el.find('br').replaceWith('\n');

        inputText = $el[0].textContent.replace(/\xA0/g, ' ').trim();

        return inputText;
    },

    uploadAgreement: function (opts) {
        if (this.uploadAgreementAccepted) {
            if (opts.type === 'file') {
                $(opts.container).find('.file-upload-input').trigger('click');
            }

            if (opts.type === 'screenClip') {
                this.sandbox.publish('appBridge:fn', null, {
                    'fnName': 'openScreenSnippetTool'
                });
                this.sandbox.publish('screensnip:open', null, true);
            }
        } else {
            var uploadAgreementView = new uploadAgreement({
                'sandbox': this.sandbox,
                'type': opts.type,
                'container': opts.container
            });

            this.sandbox.publish('modal:show', null, {
                'contentView': uploadAgreementView,
                'title': 'Please Be Advised',
                'isFlat': true
            });
        }

        if (opts.type === 'screenClip') {
            this.takingScreenSnip = true;
        }
    },

    getParentInputId: function() {
        var $parents = this.$el.parents('.simple_grid_container'),
            inputParentId = "";

        if($parents.length) {
            inputParentId = '#'+$parents.attr('id');
        } else {
            if(this.className && this.className.match(/post-compose/)) {
                inputParentId = '#easy-post'
            }

            if(this.className && this.className.match(/post-on-behalfof-input/)) {
                inputParentId = '.post-on-behalfof-input'
            }
        }

        return inputParentId
    },

    selectFile: function (e) {
        this.uploadAgreement({
            'type': 'file',
            'container': this.getParentInputId()
        });
    },

    screenClip: function () {
        this.uploadAgreement({
            'type': 'screenClip',
            'container': this.getParentInputId()
        });
    },

    screenSnipOpen: function () {
        this.takingScreenSnip = false; //all textinputs, then the active input is updated to true later on
    },

    createUploadView: function () {
        if (!this.uploadView) {
            this.uploadView = new uploadView({
                sandbox: this.sandbox,
                eventBus: this.eventBus,
                supportedMimeTypes: this.supportedMimeTypes
            }).render();

            this.$el.find('.upload-stage').append(this.uploadView.el);
        }
    },

    screenSnipSent: function (context, data) {
        if (this.takingScreenSnip) {
            this.createUploadView();

            this.eventBus.trigger('upload:start', _.extend({
                'encodedImage': true,
                'name': data.filename
            }, data));
        }
    },

    changeFiles: function () {
        var files = this.$el.find('.file-input')[0].files;

        this.createUploadView();

        for (var i = 0, len = files.length; i < len; i++) {
            this.eventBus.trigger('upload:start', files[i]);
        }

        this.actionsLayout();

    },

    clearAttachmentData: function () {
        var fileInput = this.$el.find('.file-input');
        this.$el.find('.attach').removeClass('disabled');
        this.uploadFiles = [];
        fileInput.val('').replaceWith(fileInput.clone());
        this.uploadView.destroy();
        this.uploadView = null;
        this.eventBus.trigger('textinput:resize');
    },

    preventTextFormatting: function (e) {
        e.preventDefault();
        console.log('prevent');
    },
    quickDisable: function (e) {
        var self = this,
            disableInputAndPlaceholderText = {};

        if (this.opts.isReadOnly) {
            return; //read only rooms always stay that way
        }

        disableInputAndPlaceholderText.streamId = this.threadId;

        var roomSettings = {
            viewId: this.opts.threadId,
            viewType: 'CHATROOM',
            clientType: 'DESKTOP',
            pinnedChat: true,
            config: {}
        };

        this.sandbox.getData('app.account').then(function (rsp) {
            var options = _.find(rsp.userViewConfigs, function (view) {
                return view.viewId === self.opts.threadId;
            });

            if (options && !_.isEmpty(options.config)) {
                roomSettings.config = _.extend({}, options.config);
            } else {
                roomSettings.config = _.extend({}, rsp.config.appWideViewConfigs[config.CLIENT_VERSION].CHATROOM);
            }

            if (roomSettings.config.disableInput) {
                disableInputAndPlaceholderText.placeholderText = 'Compose a message...';
                disableInputAndPlaceholderText.disableInputOption = false;
            } else {
                disableInputAndPlaceholderText.placeholderText = 'Input disabled.';
                disableInputAndPlaceholderText.disableInputOption = true;
            }

            roomSettings.config.disableInput = !roomSettings.config.disableInput;

            self.sandbox.setData('app.account.userViewConfigs', roomSettings).done(function (config) {
                self.eventBus.trigger('textinput:change', disableInputAndPlaceholderText);
            });
        });
    },
    chime: function () {
        if (this.isChiming) {
            return;
        }

        var self = this,
            $chime = this.$el.find('.chime');

        this.isChiming = true;
        $chime.addClass('disabled');

        setTimeout(function () {
            $chime.removeClass('disabled');
            self.isChiming = false;
        }, 1500);

        this.sandbox.send({
            id: 'SEND_CHAT',
            payload: _.extend(this.formatMessage(''), {
                isChime: true
            })
        });
        self.$textarea.removeClass('error');
    },
    placeCaretAtEnd: function (el) {
        el.focus();
        var range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
});
