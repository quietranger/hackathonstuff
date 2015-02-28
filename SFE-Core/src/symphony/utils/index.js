var config = require('../../../config');
var Q = require('q');

var moment = require('moment');
var NormalTimeFormat = {
    future: 'in %s',
    past: '%s ago',
    s: 'a few seconds',
    m: 'a minute',
    mm: '%d minutes',
    h: 'an hour',
    hh: '%d hours',
    d: 'a day',
    dd: '%d days',
    M: 'a month',
    MM: '%d months',
    y: 'a year',
    yy: '%d years'
}, CompactTimeFormat = {
    future: 'in %s',
    past: '%s',
    s: '%ds',
    m: '1m',
    mm: '%dm',
    h: '1h',
    hh: '%dh',
    d: '1d',
    dd: '%dd',
    M: '1mo',
    MM: '%dmo',
    y: '1y',
    yy: '%dy'
};

module.exports = {
    isValidString: function (str) {
        return !(!str || (/[<>]/).test(str));
    },
    escapeHtml: function (str) {
        return jQuery('<div />').text(str).html();
    },
    flattenMessageResponse: function (msgArray, currentUser, historical) {
        return _.map(msgArray, function (message) {
            var ret = message;
            _.extend(ret, message.message);
            delete ret.message;
            ret.isShareable = false;
            ret.isDeletable = false;
            ret.historical = historical === true;
            if ((ret.chatType === "POST" || !ret.chatType) && !ret.externalOrigination) {
                if (!ret.isShared && (ret.from && ret.from.id !== currentUser) && !(ret.share && ret.share.message.from.id === currentUser)) {
                    ret.isShareable = true;
                }
                if ((ret.from && ret.from.id === currentUser) || (ret.oboDelegate && ret.oboDelegate.id === currentUser)) {
                    ret.isDeletable = true;
                }
            }
            return ret;
        });
    },
    getShortenedChatName: function (prettyNames, myName) {
        var namesWithoutMe = $.extend(true, [], prettyNames);
        // remove self
        var index = namesWithoutMe.indexOf(myName);
        namesWithoutMe.splice(index, 1); // removes it

        if (namesWithoutMe.length > 2) {
            return namesWithoutMe[0] + ', ' + namesWithoutMe[1] + ' + ' + (namesWithoutMe.length - 2) + ' more';
        } else {
            return namesWithoutMe.join(' and ');
        }
    },
    updateAllBodyStyles: function (configs) {
        var self = this;

        for (var config in configs) {
            if (configs.hasOwnProperty(config)) {
                if (self.updateBodyStyle[config]) {
                    self.updateBodyStyle[config](configs[config]);
                }
            }
        }
    },
    updateBodyStyle: {
        showJoinedLeftMessage: function (data) {
            console.log('showJoinedLeftMessage', data);
            var $body = $('body');
            data ? $body.addClass('membership-update-enabled') : $body.removeClass('membership-update-enabled');
        },
        show24HrTime: function (data) {
            console.log('show24HrTime', data);
            var $body = $('body');
            if (data) {
                $body.removeClass('standard-time');
                $body.addClass('twentyfour-hour-time');
            } else {
                $body.addClass('standard-time');
                $body.removeClass('twentyfour-hour-time');
            }
        },
        showCompactMode: function(data){
            console.log('showCompactMode', data);
            var $body = $('body');
            $body.toggleClass('compact', data);
            //change the time format for current locale
            moment.locale(moment.locale(), {
                relativeTime: data ? CompactTimeFormat : NormalTimeFormat
            });
            //update existing social messages
            _.each($('body div.module .social-messages .social-message time'), function(timeDiv){
                var $time = $(timeDiv);
                $time.text( moment(parseInt($time.attr('data-timestamp'))).fromNow());
            });
        },
        showAvatarInChat: function (data) {
            console.log('showAvatarInChat', data);
            var $body = $('body');
            data ? $body.addClass('avatars') : $body.removeClass('avatars');
        },
        fontSize: function (data) {
            var sizeTable = {
                "SMALL": "80%",
                "NORMAL": "100%",
                "LARGE": "125%",
                "LARGEST": "150%"
            };

            console.log('fontSize', data);
            var $body = $('body');
            $body.css('font-size', sizeTable[data]);
        }
    },
    startChat: function(opts){
        var imViewConfig = null,
            result = Q.defer();

        if(!opts.sandbox || !opts.userId || Object.prototype.toString.call(opts.userId) !== '[object Array]') {
            throw new Error('Must supply a sandbox and the userId array');
        }

        var goChat = opts.sandbox.send({
            id: 'IM_MANAGER_USERS',
            urlExtension: '/'+opts.userId.join(",")
        });

        goChat.then(function (rsp) {
            if(!opts.skipPaint) {
                opts.sandbox.publish('view:created', null, rsp.result);
                opts.sandbox.publish('view:show', null, {
                    'streamId': rsp.result.threadId,
                    'module': 'im'
                });
            }

            //autopin (check to see if they have previously stored configs first)
            opts.sandbox.getData('app.account').done(function(acct){
                imViewConfig = _.findWhere(acct.userViewConfigs, {viewId: rsp.result.threadId});

                if(imViewConfig && imViewConfig.pinnedChat === true) {
                    //already pinned
                    return;
                }

                if(!imViewConfig) {
                    imViewConfig = {};
                    imViewConfig.viewId = rsp.result.threadId;
                    imViewConfig.viewType = 'IM';
                    imViewConfig.clientType = config.CLIENT_VERSION;
                    imViewConfig.config = {};
                }

                imViewConfig.pinnedChat = true; //no matter what

                //also update the pinnedChat array if its not already there
                if(!_.findWhere(acct.pinnedChats, {'threadId':rsp.result.threadId})) {
                    acct.pinnedChats.push(rsp.result);
                    opts.sandbox.setData('app.account.pinnedChats', acct.pinnedChats);
                }

                opts.sandbox.setData('app.account.userViewConfigs', imViewConfig);
            });

            result.resolve(rsp);

        }, function(rsp) {
            result.reject(rsp);
        });

        return result.promise;
    }
};
