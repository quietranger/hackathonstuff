/**
 * Created by whinea on 11/18/2014.
 */
var _ = require('underscore');
var Handlebars = require("hbsfy/runtime");

var RCPCore = function(sandbox) {
    var self = this;
    this.sandbox = sandbox;

    self.registeredPlugins = [];

    this.sandbox.registerMethod('parseUsingRichContentPlugins', this.parseUsingRichContentPlugins.bind(this), true);
    this.sandbox.registerMethod('renderUsingRichContentPlugins', this.renderUsingRichContentPlugins.bind(this), true);

    //todo: whinea - This will be removed once we have a settings parser panel
//    this.sandbox.registerMethod('registerRichContentPlugin', this.registerRichContentPlugin.bind(this), true);
    var temp = require('../plugins/excelRCP/excelRCP.js');
    this.registerRichContentPlugin(temp);

    Handlebars.registerHelper('parseRichContent', function(text, richContent) {
        var s = self.parseRichContent(text, richContent);
        return new Handlebars.SafeString(s);
    });

};

RCPCore.prototype.registerRichContentPlugin = function(plugin) {
    if (!(typeof plugin.parse != 'function' || typeof plugin.render != 'function')) {
        this.registeredPlugins.push(plugin);
        return true;
    }
    //todo: whinea - once we add settings parser panel, we should display some type of error message
    return false;
};

RCPCore.prototype.parseUsingRichContentPlugins = function(opts) {
    var clipboard = opts.clipboard;
    var pastedText = clipboard.getData('text/html');
    var useHtml = true;
    if (_.isEmpty(pastedText)) {
        pastedText = clipboard.getData('text/plain');
        useHtml = false;
    }
    var unparsedText = $('<div></div>').html(pastedText);
    for (var i = 0; i < this.registeredPlugins.length; i++) {
        var plugin = this.registeredPlugins[i];
        var result = plugin.parse(unparsedText, opts);
        if (result !== undefined){
            result.useHtml = useHtml;
            return result;
        }
    }
    return null;
};

RCPCore.prototype.getRegisteredRichContentPlugins = function() {
    return JSON.stringify(this.registeredPlugins);
};

RCPCore.prototype.parseRichContent = function(text, richContent) {
    if (richContent != null) {
        if (richContent.mediaType == 'CODE') {
            try {
                var content = JSON.parse(richContent.content);
                var result = this.renderParsedText(text, content);
                text += result.innerHTML;
            }
            catch (e) {
                //todo: whinea - return a parser error warning span containing the raw text on hover
            }
        }
    }
    return text;
};

RCPCore.prototype.renderParsedText = function(rawText, richContent) {
    var self = this;
    return _.reduce(richContent, function(text, rc) {
        //todo: whinea convert to a set or for each loop
        if (self.registeredPlugins[0] != rc.type) {
            var rend = self.registeredPlugins[0].render(JSON.parse(rc.text));
            //todo: still need to insert the table at the right place
            return rend.el;
        }
        return "";
    }, rawText);
};

RCPCore.prototype.renderUsingRichContentPlugins = function(parser, opts) {
    //todo: find correct parser
    return this.registeredPlugins[0].render(
        _(opts).extend({sandbox: this.sandbox}));
};
module.exports = RCPCore;