var $ = require('jquery');
var Backbone = require('backbone');

global.$ = $;
Backbone.$ = $;

$.ajaxSetup({
    xhrFields: {
       withCredentials: true
    },
    crossDomain: true
});

require('backbone-mousetrap');
require('tooltip');

var Symphony = require('symphony-core');
var utils = require('./utils');
var config = require('./config/config');
var transportCommands = require('./config/transportCommands');

var appsettings = require('./modules/appsettings/index');
var userAgreementView = require('./modules/useragreement/index');
var chatroom = require('./modules/chat/chatroomView');
var im = require('./modules/chat/imView');
var header = require('./modules/header/index');
var leftnav = require('./modules/leftnav/index');
var profile = require('./modules/profile/index');
var search = require('./modules/search/index');
var filter = require('./modules/filter/index');
var myDepartment = require('./modules/myDepartment/index');
var organizationalLeaders = require('./modules/organizationalLeaders/index');
var mentions = require('./modules/mentions/index');
var keywords = require('./modules/keywords/index');
var following = require('./modules/following/index');
var go = require('./modules/go/index');
var quickAction = require('./modules/quickAction/index');
var onbehalf = require('./modules/onbehalf/index');
var twitterProfile = require('./modules/twitterProfile/index');
var hashtagContext = require('./modules/hashtagContext/index');
var ftue = require('./modules/ftue/index');
var changeLog = require('./modules/changeLog/index');
var welcomeTour = require('./modules/welcomeTour/index');
var trendingTool = require('./modules/trending/index');
var iFrameLoader = require('./modules/iFrameLoader/index');
var appStore = require('./modules/appStore/index');
var recommendationsView = require('./views/recommendations');
var loadFailureView = require('./views/loadFailure');
var helloWorld = require('./modules/helloWorld');

var match,
    pl     = /\+/g,  // Regex for replacing addition symbol with a space
    searchRegex = /([^&=]+)=?([^&]*)/g,
    decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
    query  = window.location.search.substring(1),
    urlParams = {};

while (match = searchRegex.exec(query)) {
    urlParams[decode(match[1])] = decode(match[2]);
}

var lc = new Symphony.Core(urlParams);

var extensions = {
    ajax: 'Ajax',
    transport: 'Transport',
    dataStore: 'DataStore',
    presence: 'Presence',
    appBridge: 'AppBridge',
    usage: 'Usage',
    versionCheck: 'VersionCheck',
    readReceiptQueue: 'ReadReceiptQueue',
    layout: 'Layout',
    modal: 'Modal',
    longPoll: 'LongPoll',
    aliasColorCodeUpdater: 'AliasColorCodeUpdater',
    themer: 'Themer',
    richContentPlugin:'RichContentPlugin',
    cronJobs: 'CronJobs'
};

_.each(extensions, function(value, key) {
    lc.registerExtension(key, Symphony.Extensions[value]);
});

lc.getExtension('transport').setCommands(transportCommands);

/**/

lc.register('appsettings', appsettings);
lc.register('chatroom', chatroom);
lc.register('header', header);
lc.register('leftnav', leftnav);
lc.register('search', search);
lc.register('profile', profile);
lc.register('filter', filter);
lc.register('my-department', myDepartment);
lc.register('organizational-leaders', organizationalLeaders);
lc.register('mentions', mentions);
lc.register('keywords', keywords);
lc.register('following', following);
lc.register('go', go);
lc.register('quickAction', quickAction);
lc.register('im', im);
lc.register('onbehalf', onbehalf);
lc.register('twitter-profile', twitterProfile);
lc.register('hashtag-context', hashtagContext);
lc.register('ftue', ftue);
lc.register('changelog', changeLog);
lc.register('welcome-tour', welcomeTour);
lc.register('trendingTool', trendingTool);
lc.register('iFrameLoader', iFrameLoader);
lc.register('appStore', appStore);
lc.register('hello-world', helloWorld);

lc.getClientType().then(function(rsp){
    if(lc.opts.type === 'main') {
        initMain();
    }
    if(lc.opts.type === 'floater') {
        initFloater();
    }
    if(lc.opts.type === 'widget') {
        initMain({
            theme: lc.opts.theme
        });
    }
}).done();

var initMain = function(opts) {
    var opts = opts || {};

    lc.getExtension('layout').init();  //start listening for pubsub events (including a 401- the below request could fail right away)

    lc.getExtension('transport').send({
        id: 'GET_ACCOUNT',
        payload: {
            'clienttype':config.CLIENT_VERSION
        }
    }).then(function(rsp) {
        //ugly code here to make app backward compatible
        if(rsp.config.notificationsOn === null || rsp.config.notificationsOn === undefined){
            rsp.config.notificationsOn = true;
        }

        if(rsp.config.showJoinedLeftMessage === null || rsp.config.showJoinedLeftMessage === undefined){
            rsp.config.showJoinedLeftMessage = false;
        }

        if(rsp.config.show24HrTime === null || rsp.config.show24HrTime === undefined){
            rsp.config.show24HrTime = false;
        }

        if(rsp.config.showAvatarInChat === null || rsp.config.showAvatarInChat === undefined){
            rsp.config.showAvatarInChat = false;
        }

        if(rsp.config.fontSize === null || rsp.config.fontSize === undefined){
            rsp.config.fontSize = 'NORMAL';
        }

        if (rsp.config.viewSettings === null || rsp.config.viewSettings === undefined){
            rsp.config.viewSettings = {};
        }

        lc.getExtension('dataStore').upsert('app.account', rsp);

        lc.getExtension('sandbox').publish('theme:changed', null, {
            'theme'         : lc.opts.type === 'widget' ? opts.theme : rsp.config.activeTheme,
            'skipPersist'   : true
        });

        if (process.env.DISABLE_CRYPTO !== 'true') {
            lc.registerExtension('crypto', Symphony.Extensions.Crypto);
            // inject crypto into longpoll
            var lp = lc.getExtension('longPoll');
            lp && lp.setCrypto(lc.getExtension('crypto'));
        }

        var dataFeedCommands = {
            LONG_POLL: {
                url: rsp.dataFeedBaseUri + '/datafeed/push/symphony',
                requestType: 'GET',
                ajaxOpts: {
                    dataType: 'json'
                }
            },
            REGISTER_IS_TYPING: {
                url: rsp.dataFeedBaseUri + '/datafeed/registrar',
                requestType: 'POST'
            }
        };

        lc.getExtension('transport').setCommands(dataFeedCommands);

        if (!rsp.config.appWideViewConfigs) {
            rsp.config.appWideViewConfigs = {};
        }

        var appWideConfig = $.extend(true, {}, config.DEFAULT_SETTINGS[config.CLIENT_VERSION], rsp.config.appWideViewConfigs[config.CLIENT_VERSION]);
        lc.getExtension('dataStore').upsert('app.account.config.appWideViewConfigs.'+config.CLIENT_VERSION, appWideConfig);

        utils.updateAllBodyStyles(rsp.config);

        if(lc.opts.type === "widget") {
            lc.getExtension('layout').widgetLayout(lc.opts);
        } else {
            lc.getExtension('layout').defaultLayout();
        }

        if ((rsp.agreementPromptRequired && rsp.startupLegalNotice) || (rsp.oneTimeUAPromptRequired && rsp.oneTimeUANotice) ) {
            //var idx = document.baseURI.lastIndexOf("/"), img = document.baseURI.substr(0, idx) + "/favicon.ico";
            //notifyClientApp(null, null, "User Agreement", "Agree with the agreement to continue", img, "", 1);
            lc.getExtension('sandbox').publish('modal:show', null, {
                title: 'User Agreement',
                closable: false,
                contentView: new userAgreementView({
                    sandbox: lc.getExtension('sandbox'),
                    acct: rsp,
                    callback: startApp
                })
            });
        } else {
            startApp();
        }
    }, function(rsp) {
        // This is terrible - this is fatal!
        lc.getExtension('logger').error('Failed to init app status code:' + rsp.status, rsp.responseText);

        if (rsp.status === 401 || rsp.status ===  403) {
            return;
        }

        var view = new loadFailureView({
            sandbox: lc.getExtension('sandbox')
        });

        // tell the user we're going to refresh
        lc.getExtension('sandbox').publish('modal:show', null, {
            title: 'Connection Issue',
            contentView: view,
            closable: false
        });
    }).then(function () {
        lc.getExtension('transport').send({
            id: 'BOOTSTRAP_UNREAD'
        }).then(function (rsp) {
            var leftNavItems = [];
            _.each(rsp.unreadMessages, function(item) {
                leftNavItems.push({
                    streamId: item.threadId,
                    count: item.count,
                    lastReadTime: item.lastReadTime
                });
            });

            lc.getExtension('sandbox').publish('messagecounts:set', null, leftNavItems);
        });
    });
};


var initFloater = function() {
    lc.getExtension('layout').init();

    lc.getExtension('sandbox').getData('app.account.config').done(function(config){
        utils.updateAllBodyStyles(config);
        lc.getExtension('sandbox').publish('theme:changed');
    });

    lc.floaterReady(); //tell the main window we're ready
};

var startApp = function() {
    lc.getExtension('dataStore').get('documents.isOnboarded').then(function(isOnboarded) {
        if (!isOnboarded) {
            lc.getExtension('sandbox').publish('modal:show', null, {
                modalName: 'recommendations',
                contentView: new recommendationsView({
                    sandbox: lc.getExtension('sandbox')
                })
            });
        }
    });

    lc.getExtension('sandbox').publish("usage-event", null, {
        action: "SPA_START",
        details: {
            inDesktopApp: lc.getExtension('appBridge').isRunningInClientApp()
        }
    });
    lc.getExtension('longPoll').startPolling();
    lc.getExtension('versionCheck').startChecking();
    Mousetrap.bind(['alt+shift', 'option+shift'], function(){
        lc.getExtension('sandbox').publish('modal:show', null, {
            contentView: 'quickAction',
            isFlat: true,
            modalName: 'quick-action'
        });
    });
};

$(document).on('click',function (e) {
    if(e.which) { //user generated probably
        lc.getExtension('sandbox').publish('click', null, e);
    }
});
