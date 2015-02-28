var Handlebars = require('hbsfy/runtime');
var moment = require('moment');
var config = require('../../../config/config');

var hashtagTmpl = require('../templates/msgEntity/hashtag.handlebars');
var mentionTmpl = require('../templates/msgEntity/mention.handlebars');
var urlTmpl = require('../templates/msgEntity/url.handlebars');
var paginationTmpl = require('../templates/pagination.handlebars');

var simpleUrlPattern = new RegExp('([Hh][Tt][Tt][Pp][Ss]?://)([a-zA-Z0-9._~-]*[a-zA-Z0-9](:\\d+)?\\S*[\\)\\w_#/])');
var linkCharLimit = 38; // retarded to have a meaningful link that is that long anyway
var emoji = require('emoji-images');

var pluralize = require('pluralize');

if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function (str) {
        return this.slice(0, str.length) == str;
    };
}

String.prototype.hashCode = function() {
    var hash = 0, i, chr, len;
    if (this.length == 0) return hash;
    for (i = 0, len = this.length; i < len; i++) {
        chr   = this.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

Handlebars.registerHelper('followees', function (followees) {
    if (followees == '') {
        return '0';
    }

    var output = '',
        services = followees.split(',');

    _.each(services, function (val) {
        var kvPair = val.split(':'), connectorId = kvPair[0], count = kvPair[1];

        if (connectorId === 'lc') {
            output += '<div class="tag symphony" title="Symphony Followers">SY</div>';
            output += "<span>" + count + "</span>";
        } else if (connectorId === 'tw') {
            output += '<div class="tag twitter" title="Twitter Followers"></div>';
            output += "<span>" + count + "</span>";
        }
    });

    return new Handlebars.SafeString(output);
});

function avatarUrl(person, size) {
    if (!_.isNumber(size)) {
        size = '150';
    } else {
        size = size.toString();
    }

    if (person.images && person.images[size]) {
        return person.images[size];
    } else if (person.imageUrl) {
        return person.imageUrl;
    } else {
        return config.DEFAULT_IMAGE_URL;
    }
}

Handlebars.registerHelper('avatarUrl', avatarUrl);

Handlebars.registerHelper('wrappedAvatar', function(person, size) {
    var url = avatarUrl(person, size);

    return new Handlebars.SafeString('<div class="avatar-wrap"><img src="' + url + '"></div>');
});

function parseEntities(text, entities, media) {
    if(!text && !media)
        return '';
    var sortedEntities = [];

    if (!text){
        text='';
    }

    //grab the entites
    if (!_(entities).isEmpty()) {
        _.forEach(entities, function (array) {
            $.merge(sortedEntities, array);
        });
    }

    //get the rich content
    var richContent = [];
    if (media != null && media.mediaType == 'CODE'){
        try {
            richContent = JSON.parse(media.content);
        } catch (e)  {
            richContent = [];
        }
    }

    //add rich content to the entities array
    if (!_(richContent).isEmpty()) {
        _.forEach(richContent, function (rc) {
            sortedEntities.push(_(rc).extend({indexStart: rc.index, indexEnd: rc.index, type:'RICH', plugin:rc.type}));
        });
    }

    //sort the entities according to their start index
    sortedEntities.sort(function (a, b) {
        var c = a.indexStart - b.indexStart;
        if (c == 0){
            c = a.indexEnd - b.indexEnd;
        }
        return  c;
    });

    //split the text to an ordered array of segments according to the entities array
    var currentIdx = 0, segments = [];
    _(sortedEntities).each(function (entity) {
        if (currentIdx < entity.indexStart) {
            segments.push(text.substring(currentIdx, entity.indexStart));
        }
        segments.push(entity);
        currentIdx = currentIdx > entity.indexEnd ? currentIdx : entity.indexEnd;
    });

    //remember to add the text after the last entity
    if (!!text && currentIdx < text.length) {
        segments.push(text.substring(currentIdx, text.length));
        currentIdx = text.length;
    }

    if(!text && !!media){
        segments.push('');
    }

    //re-construct the text from segments
    var parsedText = '';
    var textLength = 0;
    _(segments).each(function (seg) {
        switch (seg.type) {
            case 'URL':
                parsedText += urlTmpl(wrapLink(seg));
                break;
            case 'USER_FOLLOW':
                parsedText += mentionTmpl(seg);
                break;
            case 'KEYWORD':
                parsedText += hashtagTmpl(seg);
                break;
            case 'RICH':
                parsedText += ' <span class="richToken" plugin-name="' + seg.plugin + '"></span> ';
                break;
            default:
                parsedText += Handlebars.Utils.escapeExpression(seg);
                break;
        }
    });

    return parsedText; //safestring to prevent Handlebars from escaping everything
}

function parseEmoji(text) {
    _.each(config.EMOJI_REPLACEMENTS, function(val, k) {
        //the regex should work as this: regex.exec(":p:P:pizza:") only match the first two, k should be followed by space or any non-word character
        var regex = new RegExp(k+'(\\s|(?!\\w))', 'gi');
        text = text.replace(regex, val + ' ');
    });

    // Chain the emoji tests
    var customCheckedText = customEmoji(text, config.EMOJI_URL, 18);
    return emoji(customCheckedText, config.EMOJI_URL, 18);
}

function containsAny(arr, values) {
    // at least one (.some) of the values should be in the array (.contains)
    return _.some(values, function (value) {
        return arr.indexOf(value) > -1;
    });
}

function canPreviewContent(name) {
    return containsAny(name.toLowerCase(),[".png", ".gif", ".jpg", ".jpeg", ".bmp"]);
}

function customEmoji(someString, url, size) {
    var customEmojis = [":facepalm:", ":picard_facepalm:", ":lime:", ":projito:"],
        test = /\:[a-z0-9_\-\+]+\:/g;
    return someString.replace(test, function (match) {
        if (customEmojis.indexOf(match) !== -1) {
            var name = String(match).slice(1, -1);
            return '<img class="emoji" title=":' + name + ':" alt="' + name + '" src="' + url + '/' + encodeURIComponent(name) + '.png"' + (size ? (' height="' + size + '"') : '') + ' />';
        } else {
            return match;
        }
    });
}

function wrapLink(linkEntity) {
    var linkWrapper = linkEntity;
    var match = simpleUrlPattern.exec(linkWrapper.text);
    if (match) {
        linkWrapper.prefix = match[1];
        var url = match[2];   // the full link without 'http(s)://'
        if (url.startsWith('www.'))  // remove 'www.'
            url = url.substring(4, url.length);
        var chopIndex = url.indexOf('/', url.indexOf('/') + 1);
        if (chopIndex >= 0 || url.length > linkCharLimit) {
            // remove anything beyond the second '/', subject ot the link character limit
            if (chopIndex > linkCharLimit || url.length > linkCharLimit)
                chopIndex = linkCharLimit;
            linkWrapper.ellipsis = '...';
            linkWrapper.suffix = url.substring(chopIndex);
            linkWrapper.text = url.substring(0, chopIndex);
        } else {
            linkWrapper.text = url;
        }
    }
    if (!linkWrapper.prefix)
        linkWrapper.prefix = 'http://';
    if (!linkWrapper.expandedUrl.startsWith('http'))
        linkWrapper.expandedUrl = 'http://' + linkWrapper.expandedUrl;
    linkWrapper.canPreviewContent= canPreviewContent(linkWrapper.expandedUrl.toLowerCase());
    return linkWrapper;
}

Handlebars.registerHelper('ifPreviewContent', function(text) {
    if (canPreviewContent(text)){
        return " content-preview"
    }
    return "";
});

Handlebars.registerHelper('parseEntities', function(text, entities) {
    return new Handlebars.SafeString(parseEntities(text, entities));
});

Handlebars.registerHelper('parseEmoji', function(text) {
    return new Handlebars.SafeString(parseEmoji(text));
});

Handlebars.registerHelper('parseMessageText', function(text, entities, media) {
    var parser = _.compose(parseEmoji, parseEntities);
    return new Handlebars.SafeString(parser(text, entities, media));
});

Handlebars.registerHelper('pluralize', function(word, count, printNumber) {
    if (printNumber === undefined) {
        printNumber = false;
    }

    return pluralize(word, count, printNumber);
});

Handlebars.registerHelper('timestamp', function (date, format) {
    return moment(date).format(format);
});

Handlebars.registerHelper('fromNow', function (date) {
    return moment(date).fromNow();
});

Handlebars.registerHelper('isoDate', function (date) {
    return moment(date).toISOString();
});

Handlebars.registerHelper('selectItem', function (operator, comp) {
    var ret = '';
    if (operator == comp) {
        ret = 'selected';
    }

    return ret;
});

Handlebars.registerPartial('pagination', paginationTmpl);

//taken from https://gist.github.com/trantorLiu/5924389
Handlebars.registerHelper('pagination', function (currentPage, totalPage, size, options) {
    var startPage, endPage, context;

    if (arguments.length === 3) {
        options = size;
        size = 5;
    }

    startPage = currentPage - Math.floor(size / 2);
    endPage = currentPage + Math.floor(size / 2);

    if (startPage <= 0) {
        endPage -= (startPage - 1);
        startPage = 1;
    }

    if (endPage > totalPage) {
        endPage = totalPage;
        if (endPage - size + 1 > 0) {
            startPage = endPage - size + 1;
        } else {
            startPage = 1;
        }
    }

    context = {
        startFromFirstPage: false,
        pages: [],
        endAtLastPage: false,
        isFirstPage: currentPage === 1,
        isLastPage: currentPage === totalPage
    };
    if (startPage === 1) {
        context.startFromFirstPage = true;
    }
    for (var i = startPage; i <= endPage; i++) {
        context.pages.push({
            page: i,
            isCurrent: i === currentPage
        });
    }
    if (endPage === totalPage) {
        context.endAtLastPage = true;
    }

    return options.fn(context);
});

Handlebars.registerHelper('compare', function (lvalue, rvalue, options) {

    if (arguments.length < 3)
        throw new Error('Handlerbars Helper "compare" needs 2 parameters');

    operator = options.hash.operator || '==';

    var operators = {
        '==': function (l, r) {
            return l == r;
        },
        '===': function (l, r) {
            return l === r;
        },
        '!=': function (l, r) {
            return l != r;
        },
        '<': function (l, r) {
            return l < r;
        },
        '>': function (l, r) {
            return l > r;
        },
        '<=': function (l, r) {
            return l <= r;
        },
        '>=': function (l, r) {
            return l >= r;
        },
        'typeof': function (l, r) {
            return typeof l == r;
        }
    }

    if (!operators[operator])
        throw new Error('Handlerbars Helper "compare" doesn\'t know the operator ' + operator);

    var result = operators[operator](lvalue, rvalue);

    if (result) {
        return options.fn(this);
    } else {
        return options.inverse(this);
    }

});

Handlebars.registerHelper('checked', function(left, right) {
    var ret = '';

    if (left == right) {
        ret = 'checked="checked"';
    }

    return ret;
});

Handlebars.registerHelper('userTypeImage', function (type) {
    var ret;

    switch (type) {
        case 'lc':
            ret = '<div class="tag gs">GS</div>';
            break;
        case 'tw':
            ret = '<div class="tag twitter">Twitter</div>';
            break;
        default:
            ret = '';
            break;
    }

    return new Handlebars.SafeString(ret);
});

Handlebars.registerHelper('msgOrigination', function (flattenedMsg) {
    var origin = '';
    if (flattenedMsg.chatType == 'POST' || !flattenedMsg.chatType) {
        if (flattenedMsg.share)
            origin = ' shared the following';
    } else if (flattenedMsg.chatType == 'CHATROOM') {
        origin = ' in ';
        if (flattenedMsg.localStream) {
            origin += '<span class="stream-link" data-streamId="'+ flattenedMsg.threadId +'" data-module="chatroom">'
                + Handlebars.Utils.escapeExpression(flattenedMsg.localStream.name) + '</span>';
        } else if (flattenedMsg.chatRoomName) {
            origin += '<span class="stream-link-disabled">' +
                Handlebars.Utils.escapeExpression(flattenedMsg.chatRoomName) + '</span>';
        } else {
            origin += 'a room you are no longer in';
        }
    } else if (flattenedMsg.chatType == 'INSTANT_CHAT') {
        origin = ' in <span class="stream-link" data-streamId="'+ flattenedMsg.threadId +'" data-module="im">IM</span>';
    }
    return new Handlebars.SafeString(origin);
});

Handlebars.registerHelper('for', function(start, n, block) {
    var out = '';

    for (var i = start; i < n; i++) {
        out += block.fn({i: i});
    }

    return out;
});

Handlebars.registerHelper('pluralizeShare', function(shareCount) {
    var ret = 'Share';

    if (shareCount > 1) {
        ret = 'Shares';
    }

    return ret;
});

Handlebars.registerHelper('labelSocialConnectors', function(socialConnector) {
    var html;
    switch (socialConnector) {
        case 'lc':
            html = '<span class="lc social-connector"></span><span>Symphony</span>';
            break;
        case 'tw':
            html = '<span class="tw social-connector"></span><span>Twitter</span>';
            break;
    }

    return new Handlebars.SafeString(html);
});

Handlebars.registerHelper('socialConnectorsCount', function(socialConnectors) {
    var ret;
    var actives = {};

    _.forEach(socialConnectors, function(v, k) {
        actives[v.id] = v.active;
    });

    if (actives['lc'] === true && actives['tw'] === true) {
        ret = 'All';
    } else if (actives['lc'] === true) {
        ret = 'Symphony';
    } else if (actives['tw'] === true) {
        ret = 'Twitter';
    }

    return ret;
});
