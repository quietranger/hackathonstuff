"use strict";

var clientInfo = {
    version: 'NOT_DESKTOP_APP',
    ip: 'NA',
    webVersion: 1
};

var appBridge = function (sandbox, dataStore) {
    var self = this;
    //appBridge must be initialized by core with sandbox as a param
    this.sandbox = sandbox;
    this.dataStore = dataStore;

    this.methods = {
        'configureAlertPositions': this.configureAlertPositions,
        'restartClientApp': this.restartClientApp,
        'showSampleAlert': this.showSampleAlert,
        'callUser': this.callUser,
        'openLink': this.openLink,
        'closeWindow': this.closeWindow,
        'openScreenSnippetTool': this.openScreenSnippetTool,
        'refreshAuthCookie': this.refreshAuthCookie
    };

    this.psEvents = {
        'appBridge:fn': this.onFnCall.bind(this)
    };

    this.sandbox.registerMethod('isRunningInClientApp', this.isRunningInClientApp.bind(this), true);
    this.sandbox.registerMethod('getClientInfo', this.getClientInfo.bind(this));

    // Set the flag
    this.isRunningInClientAppFlag = false;

    try {
        if (appbridge != null) {
            this.isRunningInClientAppFlag = true;
            this.setMinWidth('main', 560);
            if(appbridge.hasOwnProperty('GetClientInfoRequest'))
                appbridge.GetClientInfoRequest("onGetClientInfo");
        }
    } catch (err) {
    }
    // flag is set if in wrapper


    if (this.isRunningInClientAppFlag) {
        this.psEvents['incoming:message'] = this.onReceiveMessage.bind(this);
        this.psEvents['notification:alert'] = this.customNotification.bind(this);
        this.psEvents['view:focus:changed'] = this.onFocusChanged.bind(this);
    }

    Object.keys(this.psEvents).forEach(function (subEvent) {
        self.sandbox.subscribe(subEvent, self.psEvents[subEvent]);
    });

    this.fileUploadCallback();
    this.onNotificationClicked();
};

/* modules can trigger appBridge non-return functions by publish events
 * @param args: {fnName: xxx (must), param: {} (optional parameter to pass to the function)}
 * */
appBridge.prototype.onFnCall = function (context, args) {
    if (this.methods.hasOwnProperty(args.fnName))
        this.methods[args.fnName].call(this, args.param);
};

appBridge.prototype.onFocusChanged = function (context, args) {
    if (args.streamId) {
        // Kill all the notifications that are for that thread
        appbridge.RemoveAlertGrouping(args.streamId);
    }
};

appBridge.prototype.getCryptoLib = function() {
    var ret;

    if (this.isRunningInClientAppFlag) {
        ret = appbridge.CryptoLib;
    } else {
        ret = null;
    }

    return ret;
};

appBridge.prototype.customNotification = function (context, args) {
    if (!this.isRunningInClientAppFlag) {
        this.sandbox.error('appBridge error: ', 'try to customNotification in non-desktop version!');
        return;
    }
    var args = {
        viewId: args.viewId,
        title: args.title,
        message: args.message,
        imageUri: null,
        grouping: args.streamId,
        blink: args.blink,
        persist: args.persist,
        color: args.color,
        isApp: true,
        playSound: args.playSound
    };
    this.notifyNewMessage(args);
};

appBridge.prototype.onReceiveMessage = function (context, args) {
    var find, regex;
    var self = this;
    if (args.version !== 'SOCIALMESSAGE' || args.historical) //only notify socialmessages
        return;
    if (args.from.id === this.dataStore.app.account.userName) {
        return; // don't alert
    }

    var activeStreamId = this.sandbox.getActiveViewStreamId();
    if(appbridge.GetActiveWindow)
        appbridge.GetActiveWindow('onGetActiveWindow');
    if (args.streamId == activeStreamId && window.name === window.activeWindow) {
        return;
    }

    //TODO: store streams info in datastore maybe
    //Hack: find the stream module from leftnav
    var $streamNav = $('#nav').find('li[data-streamid="' + args.streamId + '"]');
    if (!$streamNav.length)
        return;

    var title,
        navViewName = $streamNav.find('div.nav-view-name');


    title = navViewName.text();

    var viewArgs = {
        streamId: args.streamId,
        module: $streamNav.attr('data-module')
    },
    text = '';

    try {
        text = args.share ? args.share.message.text : args.text;
    } catch (e) {
        text = args.text;
    }

    var parsedText = text ? text : '';

    if (args.entities.userMentions) {
        var currentIdx = 0, segments = [];
        _.each(args.entities.userMentions, function(entity, k) {
            //split the text to an ordered array of segments according to the entities array
            if (currentIdx < entity.indexStart) {
                segments.push(text.substring(currentIdx, entity.indexStart));
            }
            segments.push(entity);
            currentIdx = entity.indexEnd;
        });

        //remember to add the text after the last entity
        if (currentIdx < text.length) {
            segments.push(text.substring(currentIdx, text.length));
            currentIdx = text.length;
        }

        parsedText = '';
        //re-construct the text from segments, can't use replace globally, for user whose id is the same as prettyName, that will cause problem - infinite replacement
        _(segments).each(function (seg) {
            switch (seg.type) {
                case 'USER_FOLLOW':
                    parsedText += seg.text.replace(seg.screenName, seg.prettyName);
                    break;
                default:
                    parsedText += seg;
                    break;
            }
        });
    }

    if(args.attachments) {
        if (args.attachments.length == 1) {
            parsedText = '[' + args.attachments[0].name + '] ' + parsedText;
        } else if (args.attachments.length > 1) {
            parsedText = '[' + args.attachments.length + ' attachments] ' + parsedText;
        }
    }

    if(args.isChime) {
        parsedText = "sent you a chime";
    }

    var opts = {
        title: title,
        message: parsedText,
        callbackJSON: {
            viewArgs: viewArgs
        },
        groupId: args.streamId,
        imageURI: args.from.imageUrl,
        callBackFunc: 'notificationClicked'
    };

    self.notifyNewMessage(opts);
};

appBridge.prototype.configureAlertPositions = function () {
    if (this.isRunningInClientAppFlag && appbridge.hasOwnProperty('ShowAlertSettings')) {
        appbridge.ShowAlertSettings();
    } else {
        this.sandbox.error('appBridge error in configureAlertPositions: ', 'non-Desktop version');
    }
};

appBridge.prototype.openScreenSnippetTool = function () {
    if (this.isRunningInClientAppFlag && appbridge.hasOwnProperty('OpenScreenSnippetTool')) {
        appbridge.OpenScreenSnippetTool();
    } else {
        this.sandbox.error('appBridge error in OpenScreenSnippetTool: ', 'non-Desktop version');
    }
};

appBridge.prototype.setMinWidth = function (windowName, width) {
    if(this.isRunningInClientAppFlag && appbridge.hasOwnProperty('SetMinWidth'))
        appbridge.SetMinWidth(windowName, width);
};

appBridge.prototype.activateWindow = function (windowName, activate) {
    if(this.isRunningInClientAppFlag && appbridge.hasOwnProperty('Activate'))
        appbridge.Activate(windowName, activate === true);
};

appBridge.prototype.closeWindow = function (args) {
    if(this.isRunningInClientAppFlag && appbridge.hasOwnProperty('Close'))
        appbridge.Close(args.window.name);
    else
        args.window.close();
};
/* {ip: String
 version: String
 webVersion: int
 }*/
appBridge.prototype.getClientInfo = function () {
    return clientInfo;
};

window.onGetClientInfo = function(info) {
    var jsonInfo = JSON.parse(info);
    clientInfo.version = jsonInfo.version;
    clientInfo.ip = jsonInfo.ip;
    clientInfo.webVersion = jsonInfo.webVersion;
    clientInfo.windowDpi = jsonInfo.windowDpi;
};

window.onGetActiveWindow = function(windowName) {
    window.activeWindow = JSON.parse(windowName)['windowName'];
};

window.onCookieRefresh = function (rsp) {
    var cookieRefreshed = false;
    if (rsp && rsp.success === true) {
        cookieRefreshed = true;
    }
    if (cookieRefreshed) {
        // restart the app
        window.location = 'index.html';
    }
}

appBridge.prototype.isRunningInClientApp = function () {
    return this.isRunningInClientAppFlag;
};

appBridge.prototype.openLink = function (param) {
    if (this.isRunningInClientAppFlag && appbridge.hasOwnProperty('OpenUrl')) {
        appbridge.OpenUrl(param.url);
    } else {
        window.open(param.url, "_blank");
    }
};

appBridge.prototype.restartClientApp = function () {
    if (this.isRunningInClientAppFlag && appbridge.hasOwnProperty('Shutdown')) {
        appbridge.Shutdown();
    } else {
        window.location = 'index.html';
    }
};

appBridge.prototype.onNotificationClicked = function() {
    var self = this;

    window.notificationClicked = function (data) {
        try {
            if (!data) {
                return;
            }
            var dataJson = JSON.parse(data);
            if (dataJson.viewArgs) {
                self.sandbox.publish('view:show', null, dataJson.viewArgs);
            }
        } catch (e) {
            self.sandbox.error('Exception in notificationClicked():' + e.message);
        }
    };
};

appBridge.prototype.callUser = function (opts) {
    if (this.isRunningInClientAppFlag) {
        appbridge.CallByKerberos(opts.userId);
    } else {
        this.sandbox.error('appBridge error: ', 'try to call user in non-desktop version!');
    }
};

appBridge.prototype.showSampleAlert = function (opts) {
    if (!this.isRunningInClientAppFlag) {
        this.sandbox.error('appBridge error: ', 'try to showSampleAlert in non-desktop version!');
        return;
    }
    var args = {
        viewId: opts.viewId,
        title: 'Sample alert',
        message: 'This is where the message goes',
        imageUri: null,
        grouping: null,
        blink: opts.blink,
        persist: opts.persist,
        color: opts.color,
        isSample: true,
        playSound: opts.playSound
    };
    this.notifyNewMessage(args);
};

appBridge.prototype.refreshAuthCookie = function () {
    if (!this.isRunningInClientAppFlag) {
        this.sandbox.error('tried to refreshAuthCookie in non-desktop version.');
    } else {
        if (appbridge.RefreshAuthCookie != undefined) {
            appbridge.RefreshAuthCookie('onCookieRefresh')
        } else {
            this.sandbox.error('tried to refreshAuthCookie, but this version of the appbridge doesn\'t support it.');
        }
    }
};

appBridge.prototype.notifyNewMessage = function (opts) {
    var self = this;

    if (!this.isRunningInClientAppFlag) {
        this.sandbox.error('appBridge error: ', 'try to notifyNewMessage in non-desktop version!');
        return;
    }
    // Check for do not disturb
    if (!this.dataStore.app.account.config.notificationsOn && !opts.isSample) {
        return;
    }
    try {
        // check for this particular view
        if (opts.isSample) {
            notification = {
                title: opts.title,
                color: opts.color,
                blink: opts.blink,
                blinkColor: 'e23030', // hardcoded in from the notification red in variables css
                message: opts.message,
                persistent: opts.persist,
                imageUri: opts.imageURI,
                grouping: opts.groupId,
                playSound: opts.playSound !== null ? opts.playSound : true // default to off
            }
            appbridge.PostAlert(JSON.stringify(notification));
        } else if(opts.isApp) {
            //todo radaja just hardcoded for now. but honestly all of this notification stuff needs to be refactored. huge mess right now
            notification = {
                title: opts.title,
                color: opts.color,
                blink: opts.blink,
                blinkColor: 'e23030', // hardcoded in from the notification red in variables css
                message: opts.message,
                persistent: opts.persist,
                imageUri: opts.imageURI,
                grouping: opts.groupId,
                playSound: opts.playSound !== null ? opts.playSound : true // default to off
            }
            appbridge.PostAlert(JSON.stringify(notification));
        }
        else {
            var userViewConfigs = this.dataStore.app.account.userViewConfigs, notification;

            var viewConfigFound = false;
            for (var i = 0, len = userViewConfigs.length; i < len; i++) {
                var viewConfig = userViewConfigs[i];
                if (viewConfig.viewId === opts.callbackJSON.viewArgs.streamId && !_.isEmpty(viewConfig.config)) {
                    viewConfigFound = true;
                    if (viewConfig.config.showNotification) {
                        notification = {
                            title: opts.title,

                            color: viewConfig.config.notificationColor !== null ? viewConfig.config.notificationColor.substring(1) : opts.callbackJSON.viewArgs.appWideOpts.notificationColor.substring(1),
                            blink: viewConfig.config.blink !== null ? viewConfig.config.blink : true, // default true
                            blinkColor: 'e23030', // hardcoded in from the notification red in variables css
                            message: opts.message,
                            callback: opts.callBackFunc,
                            callbackArg: JSON.stringify(opts.callbackJSON),
                            persistent: viewConfig.config.persist !== null ? viewConfig.config.persist : false, // default to false
                            imageUri: opts.imageURI,
                            grouping: opts.groupId,
                            playSound: viewConfig.config.playSound !== null ? viewConfig.config.playSound : true // default to true
                        }
                        appbridge.PostAlert(JSON.stringify(notification));
                    }
                    break; // leave the for loop no matter what
                }
            }
            if (!viewConfigFound) {
                // There's no view config found , so let's alert by default!
                var defaultConfig;
                switch (opts.callbackJSON.viewArgs.module) {
                    case 'im':
                        defaultConfig = self.dataStore.app.account.config.appWideViewConfigs.DESKTOP.IM;
                        break;
                    case 'chatroom':
                        defaultConfig = self.dataStore.app.account.config.appWideViewConfigs.DESKTOP.CHATROOM;
                        break;
                    case 'filter':
                        defaultConfig = self.dataStore.app.account.config.appWideViewConfigs.DESKTOP.FILTER;
                        break;
                    case 'following':
                        defaultConfig = self.dataStore.app.account.config.appWideViewConfigs.DESKTOP.CHANNEL;
                        break;
                    case 'keywords':
                        defaultConfig = self.dataStore.app.account.config.appWideViewConfigs.DESKTOP.CHANNEL;
                        break;
                    case 'mentions':
                        defaultConfig = self.dataStore.app.account.config.appWideViewConfigs.DESKTOP.CHANNEL;
                        break;
                    case 'my-department':
                        defaultConfig = self.dataStore.app.account.config.appWideViewConfigs.DESKTOP.CHANNEL;
                        break;
                    case 'organizational-leaders':
                        defaultConfig = self.dataStore.app.account.config.appWideViewConfigs.DESKTOP.CHANNEL;
                        break;
                }

                if (!defaultConfig.showNotification) {
                    return;
                }

                notification = {
                    title: opts.title,
                    color: defaultConfig.notificationColor.substring(1),
                    blink: defaultConfig.blink, // since this is defaults, default to no
                    blinkColor: 'e23030', // hardcoded in from the notification red in variables css
                    message: opts.message,
                    callback: opts.callBackFunc,
                    callbackArg: JSON.stringify(opts.callbackJSON),
                    imageUri: opts.imageURI,
                    grouping: opts.groupId,
                    playSound: defaultConfig.playSound,
                    persistent: defaultConfig.persist // default to false
                };

                appbridge.PostAlert(JSON.stringify(notification));
            }
        }
    } catch (e) {
        this.sandbox.error('appBridge error in notifyNewMessage: ', JSON.stringify(opts), '\n', e.toString);
    }
};

appBridge.prototype.playChime = function(){
    //not currently in use! (audio is base64 encoded in the index.html)
    if (this.isRunningInClientAppFlag) {
        appbridge.PlayChime();
    } else {
        this.sandbox.error('appBridge error: ', 'try to chime user in non-desktop version!');
    }
};

// THIS IS INVOKED BY THE CONTAINER APP
window.clientAppActivated = function () {
    setTimeout(function () {
        // TODO this should publish a message that allows the layout manager to grant focus back to the last module that had focus
        /*   if(!$('input[type=text]').is(':focus'))
         $('.share-new-message-inputfield').focus();*/
    }, 500);
}

window.clientAppDeactivated = function () {
    //the cursor doesn’t remain in the webpage when the user clicks away.
    // TODO this should publish a message that allows the layout manager to grant focus back to the last module that had focus
    /*$('.share-new-message-inputfield').blur();*/
}

appBridge.prototype.fileUploadCallback = function() {
    var self = this;
    if (this.isRunningInClientAppFlag) {
        window.appbridge.RegisterFileUploadCallback("onFileUpload");
    }

    window.onFileUpload = function(rsp) {
        self.sandbox.publish('screensnip:sent', null, JSON.parse(rsp));
    };
};

module.exports = exports = appBridge;
