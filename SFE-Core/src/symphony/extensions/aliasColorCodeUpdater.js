'use strict';

var config = require('../../../config');

var AliasColorCodeUpdater = function(layout, sandbox, dataStore) {
    this.sandbox = sandbox;
    this.floated = layout.isFloater;
    this.dataStore = dataStore;

    this.rules = {};
    this.$stylesheet = null;
    this.STYLESHEET_ID = 'aliases-color-codes-generated';

    var self = this;

    this.sandbox.subscribe('alias-color-code:changed', function(ctx, rules) {
        self.updateAliasesColorCodes(rules);
    });

    if (this.floated) {
        this.sandbox.subscribe('alias-color-code:float-changed', function(ctx, rules) {
            self.updateAliasesColorCodes(rules);
        });
    } else {
        this.sandbox.subscribe('view:floated', function() {
            self.sandbox.publish('alias-color-code:float-changed', null, self.rules);
        });

        this.updateAliasesColorCodes();
    }
};

AliasColorCodeUpdater.prototype.updateAliasesColorCodes = function(rules) {
    var themeId = this.dataStore.get('app.account.config.activeTheme'),
        theme = _.find(config.THEMES, function(t) { return t.key === themeId; }) || config.THEMES[0],
        self = this;

    this.COLORS = theme.config.userColorCodes;

    if (!rules && !this.floated) {
        this.dataStore.get('documents.' + config.PER_USER_METADATA_DOCUMENT_ID).then(function(rsp) {
            if (!rsp) {
                return;
            }

            self.rules = rsp;

            var aliasesPayload = [];

            _.each(self.rules, function(value, key) {
                if (value.alias) {
                    aliasesPayload.push({
                        userId: key,
                        alias: value.alias
                    });
                }
            });

            self.sandbox.publish('aliases:updated', null, aliasesPayload);
            self.updateColorCodes();
        });
    } else if (rules) {
        _.each(rules, function(value, key) {
            self.rules[key] = value;

            self.sandbox.publish('aliases:updated', null, [{
                userId: key,
                alias: value.alias
            }]);

            self.updateColorCodes();
        });
    }
};

AliasColorCodeUpdater.prototype.updateColorCodes = function() {
    var styles = '',
        payload = [],
        self = this;

    _.each(_.keys(this.rules), function(key) {
        var rule = self.rules[key];

        if (rule.color === null || rule.color === undefined) {
            return;
        }

        payload.push({
            userId: key,
            color: rule.color
        });

        var hex = self.COLORS[rule.color],
            rgb = self._hexToRgb(hex);

        styles += '.colorable[data-userid="' + key + '"], .colorable[data-userid="' + key + '"] a  { color: ' + hex + ' !important; }';

        if (rule.showBackgroundColor) {
            styles += '.background-colorable[data-userid="' + key + '"] { background-color: rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.15); }';
        }
    });

    this.sandbox.publish('colors:updated', null, payload);

    if (!this.$stylesheet) {
        this.$stylesheet = $('<style id="'+ this.STYLESHEET_ID + '"></style>').html(styles).appendTo('head');
    } else {
        this.$stylesheet.html(styles);
    }
};

AliasColorCodeUpdater.prototype._hexToRgb = function(hex) {
    var result = /^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

module.exports = AliasColorCodeUpdater;
