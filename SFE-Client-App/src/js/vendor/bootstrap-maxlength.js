/* ==========================================================
 * bootstrap-maxlength.js v1.4.2
 * 
 * Copyright (c) 2013 Maurizio Napoleoni; 
 *
 * Licensed under the terms of the MIT license.
 * See: https://github.com/mimo84/bootstrap-maxlength/blob/master/LICENSE
 * ========================================================== */

/*jslint browser:true*/
/*global  jQuery*/
(function ($) {
    "use strict";

    $.fn.extend({
        maxlength: function (options, callback) {

            var //documentBody = $('body'),
                defaults = {
                    alwaysShow: false, // if true the indicator it's always shown.
                    threshold: 10, // Represents how many chars left are needed to show up the counter
                    warningClass: "label label-success",
                    limitReachedClass: "label label-important",
                    separator: ' / ',
                    preText: '',
                    postText: '',
                    showMaxLength : true,
                    placement: 'bottom',
                    showCharsTyped: true, // show the number of characters typed and not the number of characters remaining
                    validate: false, // if the browser doesn't support the maxlength attribute, attempt to type more than
                    // the indicated chars, will be prevented.
                    utf8: false, // counts using bytesize rather than length.  eg: '£' is counted as 2 characters.
                    ignoreBreaks: false, //true will consider either CR or LF, false would consider both.
                    onOverCount: null,
                    onSafeCount: null
                };
            var domains = {
                "ac": 1,
                "ad": 1,
                "ae": 1,
                "aero": 1,
                "af": 1,
                "ag": 1,
                "ai": 1,
                "al": 1,
                "am": 1,
                "an": 1,
                "ao": 1,
                "aq": 1,
                "ar": 1,
                "arpa": 1,
                "as": 1,
                "asia": 1,
                "at": 1,
                "au": 1,
                "aw": 1,
                "ax": 1,
                "az": 1,
                "ba": 1,
                "bb": 1,
                "bd": 1,
                "be": 1,
                "bf": 1,
                "bg": 1,
                "bh": 1,
                "bi": 1,
                "biz": 1,
                "bj": 1,
                "bl": 1,
                "bm": 1,
                "bn": 1,
                "bo": 1,
                "bq": 1,
                "br": 1,
                "bs": 1,
                "bt": 1,
                "bv": 1,
                "bw": 1,
                "by": 1,
                "bz": 1,
                "ca": 1,
                "cat": 1,
                "cc": 1,
                "cd": 1,
                "cf": 1,
                "cg": 1,
                "ch": 1,
                "ci": 1,
                "ck": 1,
                "cl": 1,
                "cm": 1,
                "cn": 1,
                "co": 1,
                "com": 1,
                "coop": 1,
                "cr": 1,
                "cu": 1,
                "cv": 1,
                "cw": 1,
                "cx": 1,
                "cy": 1,
                "cz": 1,
                "de": 1,
                "dj": 1,
                "dk": 1,
                "dm": 1,
                "do": 1,
                "dz": 1,
                "ec": 1,
                "edu": 1,
                "ee": 1,
                "eg": 1,
                "eh": 1,
                "er": 1,
                "es": 1,
                "et": 1,
                "eu": 1,
                "fi": 1,
                "fj": 1,
                "fk": 1,
                "fm": 1,
                "fo": 1,
                "fr": 1,
                "ga": 1,
                "gb": 1,
                "gd": 1,
                "ge": 1,
                "gf": 1,
                "gg": 1,
                "gh": 1,
                "gi": 1,
                "gl": 1,
                "gm": 1,
                "gn": 1,
                "gov": 1,
                "gp": 1,
                "gq": 1,
                "gr": 1,
                "gs": 1,
                "gt": 1,
                "gu": 1,
                "gw": 1,
                "gy": 1,
                "hk": 1,
                "hm": 1,
                "hn": 1,
                "hr": 1,
                "ht": 1,
                "hu": 1,
                "id": 1,
                "ie": 1,
                "il": 1,
                "im": 1,
                "in": 1,
                "info": 1,
                "int": 1,
                "io": 1,
                "iq": 1,
                "ir": 1,
                "is": 1,
                "it": 1,
                "je": 1,
                "jm": 1,
                "jo": 1,
                "jobs": 1,
                "jp": 1,
                "ke": 1,
                "kg": 1,
                "kh": 1,
                "ki": 1,
                "km": 1,
                "kn": 1,
                "kp": 1,
                "kr": 1,
                "kw": 1,
                "ky": 1,
                "kz": 1,
                "la": 1,
                "lb": 1,
                "lc": 1,
                "li": 1,
                "lk": 1,
                "lr": 1,
                "ls": 1,
                "lt": 1,
                "lu": 1,
                "lv": 1,
                "ly": 1,
                "ma": 1,
                "mc": 1,
                "md": 1,
                "me": 1,
                "mf": 1,
                "mg": 1,
                "mh": 1,
                "mil": 1,
                "mk": 1,
                "ml": 1,
                "mm": 1,
                "mn": 1,
                "mo": 1,
                "mobi": 1,
                "mp": 1,
                "mq": 1,
                "mr": 1,
                "ms": 1,
                "mt": 1,
                "mu": 1,
                "museum": 1,
                "mv": 1,
                "mw": 1,
                "mx": 1,
                "my": 1,
                "mz": 1,
                "na": 1,
                "name": 1,
                "nc": 1,
                "ne": 1,
                "net": 1,
                "nf": 1,
                "ng": 1,
                "ni": 1,
                "nl": 1,
                "no": 1,
                "np": 1,
                "nr": 1,
                "nu": 1,
                "nz": 1,
                "om": 1,
                "org": 1,
                "pa": 1,
                "pe": 1,
                "pf": 1,
                "pg": 1,
                "ph": 1,
                "pk": 1,
                "pl": 1,
                "pm": 1,
                "pn": 1,
                "post": 1,
                "pr": 1,
                "pro": 1,
                "ps": 1,
                "pt": 1,
                "pw": 1,
                "py": 1,
                "qa": 1,
                "re": 1,
                "ro": 1,
                "rs": 1,
                "ru": 1,
                "rw": 1,
                "sa": 1,
                "sb": 1,
                "sc": 1,
                "sd": 1,
                "se": 1,
                "sg": 1,
                "sh": 1,
                "si": 1,
                "sj": 1,
                "sk": 1,
                "sl": 1,
                "sm": 1,
                "sn": 1,
                "so": 1,
                "sr": 1,
                "ss": 1,
                "st": 1,
                "su": 1,
                "sv": 1,
                "sx": 1,
                "sy": 1,
                "sz": 1,
                "tc": 1,
                "td": 1,
                "tel": 1,
                "tf": 1,
                "tg": 1,
                "th": 1,
                "tj": 1,
                "tk": 1,
                "tl": 1,
                "tm": 1,
                "tn": 1,
                "to": 1,
                "tp": 1,
                "tr": 1,
                "travel": 1,
                "tt": 1,
                "tv": 1,
                "tw": 1,
                "tz": 1,
                "ua": 1,
                "ug": 1,
                "uk": 1,
                "um": 1,
                "us": 1,
                "uy": 1,
                "uz": 1,
                "va": 1,
                "vc": 1,
                "ve": 1,
                "vg": 1,
                "vi": 1,
                "vn": 1,
                "vu": 1,
                "wf": 1,
                "ws": 1,
                "ye": 1,
                "yt": 1,
                "za": 1,
                "zm": 1,
                "zw": 1
            };
            var urlPattern = new RegExp("(^|[^@#$\\w\\\\/.])(([Hh][Tt][Tt][Pp][Ss]?://)[a-zA-Z0-9._~-]*[a-zA-Z0-9]\\.([a-z]{2,6})(:\\d+)?(\\S*[\\)\\w_#/])?)", "g");

            if ($.isFunction(options) && !callback) {
                callback = options;
                options = {};
            }
            options = $.extend(defaults, options);

            /**
             * Return the length of the specified input.
             *
             * @param input
             * @return {number}
             */
            function inputLength(input) {
                var text,link = "", breaks = 0, currentLength = 0, domain;
                if(input.is('input') || input.is('textarea'))
                    text = input.val();
                else if(input.attr('contenteditable') == "true"){
                    text = formatTextInputHTMLToText(input.html(), input);
                }else
                    text = input.text();

                var  matches = text.match(/\n/g);
                if (options.utf8) {
                    breaks = matches ? utf8Length(matches) : 0;
                    currentLength = utf8Length(text);
                } else {
                    breaks = matches ? matches.length : 0;
                    currentLength = text.length;
                }
                currentLength += (options.ignoreBreaks ? 0 : breaks);

                //detect links, only count 20 if the link length is > 20
                while(matches = urlPattern.exec(text)) {
                    // double check if it is a valid url, if not, next
                    if(!matches[4]) continue;

                    domain = matches[4].trim();
                    if (!domains[domain]) continue;

                    // now count the characters
                    link = matches[0].trim();

                    if(link.length > 20)
                        currentLength += 20 - link.length;
                } // eo while matches

                return currentLength;
            }

            //used by symphony text input
            function formatTextInputHTMLToText(inputHTML, $input) {
                var $el = $('<div></div>'),
                    inputText;

                //change the inputHTML instead of the original editableDiv, you don't want to change the content every time the function is called
                $el.html(inputHTML).find('.entity, .emoji').each(function () {
                    var $this = $(this), val = $this.attr('data-value');
                    if ($this.hasClass('entity')) {
                        var $originalEntity = $input.find('.entity[data-value="' + val + '"]'),
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
            }

            /**
             * Return the length of the specified input in UTF8 encoding.
             *
             * @param string
             * @return {number}
             */
            function utf8Length(string) {
                string = string.toString();
                var utf8length = 0;
                for (var n = 0; n < string.length; n++) {
                    var c = string.charCodeAt(n);
                    if (c < 128) {
                        utf8length++;
                    }
                    else if((c > 127) && (c < 2048)) {
                        utf8length = utf8length+2;
                    }
                    else {
                        utf8length = utf8length+3;
                    }
                }
                return utf8length;
            }

            /**
             * Return true if the indicator should be showing up.
             *
             * @param input
             * @param thereshold
             * @param maxlength
             * @return {number}
             */
            function charsLeftThreshold(input, thereshold, maxlength) {
                var output = true;
                if (!options.alwaysShow && (maxlength - inputLength(input) > thereshold)) {
                    output = false;
                }
                return output;
            }

            /**
             * Returns how many chars are left to complete the fill up of the form.
             *
             * @param input
             * @param maxlength
             * @return {number}
             */
            function remainingChars(input, maxlength) {
                return maxlength - inputLength(input);
            }

            /**
             * When called displays the indicator.
             *
             * @param indicator
             */
            function showRemaining(indicator) {
                indicator.css({
                    display: 'block'
                });
            }

            /**
             * When called shows the indicator.
             *
             * @param indicator
             */
            function hideRemaining(indicator) {
                indicator.css({
                    display: 'none'
                });
            }

            /**
             * This function updates the value in the indicator
             *
             * @param maxLengthThisInput
             * @param typedChars
             * @return String
             */
            function updateMaxLengthHTML(maxLengthThisInput, typedChars) {
                var output = '';
                if (options.message){
                    output = options.message.replace('%charsTyped%', typedChars)
                        .replace('%charsRemaining%', maxLengthThisInput - typedChars)
                        .replace('%charsTotal%', maxLengthThisInput);
                } else {
                    if (options.preText) {
                        output += options.preText;
                    }
                    if (!options.showCharsTyped) {
                        output += maxLengthThisInput - typedChars;
                    }
                    else {
                        output += typedChars;
                    }
                    if (options.showMaxLength) {
                        output += options.separator + maxLengthThisInput;
                    }
                    if (options.postText) {
                        output += options.postText;
                    }
                }
                return output;
            }

            /**
             * This function updates the value of the counter in the indicator.
             * Wants as parameters: the number of remaining chars, the element currently managed,
             * the maxLength for the current input and the indicator generated for it.
             *
             * @param remaining
             * @param currentInput
             * @param maxLengthCurrentInput
             * @param maxLengthIndicator
             */
            function manageRemainingVisibility(remaining, currentInput, maxLengthCurrentInput, maxLengthIndicator) {
                maxLengthIndicator.html(updateMaxLengthHTML(maxLengthCurrentInput, (maxLengthCurrentInput - remaining)));

                if (remaining > 0) {
                    if (charsLeftThreshold(currentInput, options.threshold, maxLengthCurrentInput)) {
                        showRemaining(maxLengthIndicator.removeClass(options.limitReachedClass).addClass(options.warningClass));
                    } else {
                        hideRemaining(maxLengthIndicator);
                    }
                } else {
                    showRemaining(maxLengthIndicator.removeClass(options.warningClass).addClass(options.limitReachedClass));
                }
            }

            /**
             *  This function places the maxLengthIndicator at the
             *  top / bottom / left / right of the currentInput
             *
             *  @param currentInput
             *  @param maxLengthIndicator
             *  @return null
             *
             */
            function place(currentInput, maxLengthIndicator) {
                var pos = currentInput.position(),
                    inputOuter = currentInput.outerWidth(),
                    outerWidth = maxLengthIndicator.outerWidth(),
                    actualWidth = maxLengthIndicator.width(),
                    actualHeight = maxLengthIndicator.outerHeight();
                pos.height = currentInput.outerHeight();
                pos.width = currentInput.width();
                switch (options.placement) {
                    case 'bottom':
                        maxLengthIndicator.css({top: pos.top + pos.height, left: pos.left + pos.width / 2 - actualWidth / 2});
                        break;
                    case 'top':
                        maxLengthIndicator.css({top: pos.top - actualHeight, left: pos.left + pos.width / 2 - actualWidth / 2});
                        break;
                    case 'left':
                        maxLengthIndicator.css({top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left - actualWidth});
                        break;
                    case 'right':
                        maxLengthIndicator.css({top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left + pos.width});
                        break;
                    case 'bottom-right':
                        maxLengthIndicator.css({top: pos.top + pos.height, left: pos.left + pos.width});
                        break;
                    case 'top-right':
                        maxLengthIndicator.css({top: pos.top - actualHeight, left: pos.left + inputOuter});
                        break;
                    case 'top-left':
                        maxLengthIndicator.css({top: pos.top - actualHeight, left: pos.left - outerWidth});
                        break;
                    case 'bottom-left':
                        maxLengthIndicator.css({top: pos.top + currentInput.outerHeight(), left: pos.left - outerWidth});
                        break;
                    case 'centered-right':
                        maxLengthIndicator.css({top: pos.top + (actualHeight / 2), left: pos.left + inputOuter - outerWidth - 3});
                        break;
                }
            }

            /**
             *  This function retrieves the maximum length of currentInput
             *
             *  @param currentInput
             *  @return {number}
             *
             */
            function getMaxLength(currentInput) {
                return currentInput.attr('maxlength') || currentInput.attr('size');
            }

            return this.each(function() {

                var currentInput = $(this),
                    maxLengthCurrentInput,
                    maxLengthIndicator = $('<span class="bootstrap-maxlength label-info label"></span>').css({
                        display: 'none',
                        position: 'absolute',
                        whiteSpace: 'nowrap',
                        zIndex: 1099
                    });
                maxLengthIndicator.insertBefore(currentInput);
                //documentBody.append(maxLengthIndicator);

                currentInput.focus(function () {
                    maxLengthCurrentInput = getMaxLength(currentInput);
                    var maxlengthContent = updateMaxLengthHTML(maxLengthCurrentInput, '0');

                    maxLengthIndicator.html(maxlengthContent);

                    // We need to detect resizes if we are dealing with a textarea:
                    if (currentInput.is('textarea')) {
                        currentInput.data('maxlenghtsizex', currentInput.outerWidth());
                        currentInput.data('maxlenghtsizey', currentInput.outerHeight());

                        currentInput.mouseup(function() {
                            if (currentInput.outerWidth() !== currentInput.data('maxlenghtsizex') || currentInput.outerHeight() !== currentInput.data('maxlenghtsizey')) {
                                place(currentInput, maxLengthIndicator);
                            }

                            currentInput.data('maxlenghtsizex', currentInput.outerWidth());
                            currentInput.data('maxlenghtsizey', currentInput.outerHeight());
                        });
                    }

                    var remaining = remainingChars(currentInput, getMaxLength(currentInput));
                    manageRemainingVisibility(remaining, currentInput, maxLengthCurrentInput, maxLengthIndicator);
                    place(currentInput, maxLengthIndicator);

                    if(remaining < 0 && options.onOverCount){
                        options.onOverCount();
                    } else if(remaining >= 0 && options.onSafeCount){
                        options.onSafeCount();
                    }

                });

                currentInput.blur(function() {
                    //maxLengthIndicator.remove();
                    //remove all indicators, for unknown reason we may have more than 1 indicators in client, maybe the event handler is not invoked properly in the webkit container
                    hideRemaining(maxLengthIndicator);
                });

                currentInput.keyup(function(e) {
                    maxLengthCurrentInput = getMaxLength(currentInput);
                    var remaining = remainingChars(currentInput, maxLengthCurrentInput),
                        output = true;
                    if (options.validate && remaining < 0) {
                        output = false;
                    } else {
                        manageRemainingVisibility(remaining, currentInput, maxLengthCurrentInput, maxLengthIndicator);
                    }

                    if(remaining < 0 && options.onOverCount){
                        options.onOverCount();
                    } else if(remaining >= 0 && options.onSafeCount){
                        options.onSafeCount();
                    }
                    return output;
                });
            });
        }
    });
}(jQuery));
