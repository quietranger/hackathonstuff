'use strict';

var pluginName = 'tokenInput';

var defaultCallbacks = {
    makeToken: function(token) { return { name: token, id: token }; },
    makeAutocompleteToken: $.noop,
    didAddToken: $.noop,
    didRemoveToken: $.noop,
    didDisableTokens: $.noop,
    didMarkErrorTokens: $.noop,
    inputDidKeydown: $.noop,
    inputDidKeyup: $.noop
};

var tokenTemplate = require('./templates/token.handlebars');

require('typeahead.js');

var TokenInput = function(element, opts) {
    this.$input = $(element).wrap('<div class="token-input"></div>');
    this.$el = this.$input.closest('.token-input').prepend('<ul></ul>');

    this.$el.on('click', '.remove', this.didClickRemoveToken.bind(this))
        .on('keydown', 'input', this.inputDidKeydown.bind(this))
        .on('keyup', 'input', this.inputDidKeyup.bind(this))
        .on('typeahead:autocompleted typeahead:selected', this.typeaheadDidAutocomplete.bind(this))
        .on('click', this.didClickContainer.bind(this));

    this.tokens = [];

    this.opts = {
        tokenTemplate: opts.tokenTemplate || tokenTemplate,
        callbacks: _.extend({}, defaultCallbacks, opts.callbacks),
        typeaheadOptions: opts.typeaheadOptions || null
    };

    this.apiContext = {
        'disableTokens': this.disableTokens.bind(this),
        'markErrorTokens': this.markErrorTokens.bind(this),
        'destroy': this.destroy.bind(this),
        'reset': this.reset.bind(this),
        'addToken': this.addToken.bind(this),
        'removeToken': this.removeToken.bind(this),
        'makeToken': this.opts.callbacks.makeToken.bind(this),
        'makeAutocompleteToken': this.opts.callbacks.makeAutocompleteToken.bind(this)
    };

    if (this.opts.typeaheadOptions) {
        if (this.opts.callbacks.makeAutocompleteToken == $.noop) {
            throw new Error('makeAutocompleteToken callback is required when using a typeahead.');
        }

        this.typeahead = this.$input.typeahead.apply(this.$input, this.opts.typeaheadOptions);
    }
};

TokenInput.prototype.callback = function(callback, args) {
    return this.opts.callbacks[callback].apply(this.apiContext, args);
};

TokenInput.prototype.api = function(command) {
    if (this.apiContext[command]) {
        var args = Array.prototype.slice.call(arguments, 1);
        this.apiContext[command].apply(this, args);
    } else {
        throw new Error('Unrecognized command.');
    }
};

TokenInput.prototype.typeaheadDidAutocomplete = function(e, suggestion, dataset) {
    var token = this.callback('makeAutocompleteToken', arguments);

    if (!token) {
        throw new Error('makeAutocompleteToken callback did not return a proper token object.');
    }

    token.type = dataset;
    token.enabled = true;

    this.addToken(token);
};

TokenInput.prototype.inputDidKeydown = function(e) {
    var $target = $(e.currentTarget);

    if (e.which == 8 && $target.val().length == 0) {
        var lastToken = _.last(this.tokens);

        if (lastToken) {
            this.removeToken(lastToken.id);
        }
    }

    this.callback('inputDidKeydown', [ e ]);
};

TokenInput.prototype.inputDidKeyup = function(e) {
    this.callback('inputDidKeyup', [ e ]);
};

TokenInput.prototype.didClickContainer = function() {
    this.$input.focus();
};

TokenInput.prototype.didClickRemoveToken = function(e) {
    var $target = $(e.currentTarget),
        tokenId = $target.closest('li').attr('data-id');

    this.removeToken(tokenId);
};

TokenInput.prototype.addToken = function(token) {
    var tokenExists = _.find(this.tokens, function(item) {
        return item.id == token.id;
    });

    if (tokenExists) {
        return;
    }

    this.$el.find('ul').append(this.opts.tokenTemplate(token));
    this.tokens.push(token);

    this.clearInput();

    this.callback('didAddToken', [ token, _.clone(this.tokens) ]);
};

TokenInput.prototype.removeToken = function(id) {
    var ids = _.pluck(this.tokens, 'id'),
        idx = _.indexOf(ids, id),
        token;

    if (idx > -1) {
        token = this.tokens.splice(idx, 1)[0];
    } else {
        return;
    }

    this.$el.find('li').eq(idx).remove();

    this.callback('didRemoveToken', [ token, _.clone(this.tokens) ]);
};

TokenInput.prototype.disableTokens = function(ids) {
    var map = _.indexBy(this.tokens, 'id'),
        disabledTokens = [],
        self = this;

    this.$el.find('li.disabled').removeClass('disabled');

    _.each(ids, function(id) {
        var token = map[id];

        if (token) {
            token.enabled = false;

            disabledTokens.push(_.clone(token));

            self.$el.find('li[data-id="' + id + '"]').addClass('disabled');
        }
    });

    this.callback('didDisableTokens', [ disabledTokens, _.clone(this.tokens) ]);
};

TokenInput.prototype.markErrorTokens = function(ids) {
    var map = _.indexBy(this.tokens, 'id'),
        errorTokens = [],
        self = this;

    this.$el.find('li.error').removeClass('error');

    _.each(ids, function(id) {
        var token = map[id];

        if (token) {
            errorTokens.push(_.clone(token));
            self.$el.find('li[data-id="' + id + '"]').addClass('error');
        }
    });

    this.callback('didMarkErrorTokens', [ errorTokens, _.clone(this.tokens) ]);
};

TokenInput.prototype.clearInput = function() {
    if (this.typeahead) {
        this.typeahead.typeahead('val', '');
    } else {
        this.$input.val('');
    }
};

/*
* reset tokenInput so that you can change the auto-complete behavior, use case: quick action
* @param: opts {typeaheadOptions, callbacks, tokenTemplate}, if not opts provided, just destroy typeahead
*
* */
TokenInput.prototype.reset = function(opts) {
    if (this.typeahead) {
        this.typeahead.typeahead('destroy');
    }

    if (opts) {
        this.opts = {
            tokenTemplate: opts.tokenTemplate || tokenTemplate,
            callbacks: _.extend({}, defaultCallbacks, opts.callbacks),
            typeaheadOptions: opts.typeaheadOptions || null
        };

        if (this.opts.callbacks.makeAutocompleteToken == $.noop) {
            throw new Error('makeAutocompleteToken callback is required when using a typeahead.');
        }

        this.apiContext.makeAutocompleteToken = this.opts.callbacks.makeAutocompleteToken.bind(this);
        this.typeahead = this.$input.typeahead.apply(this.$input, this.opts.typeaheadOptions);
    }
};

TokenInput.prototype.destroy = function() {
    if (this.typeahead) {
        this.typeahead.typeahead('destroy');
    }

    this.$el.off();
    this.$input.data('plugin_' + pluginName, null);
};

$.fn[pluginName] = function() {
    var parentArgs = arguments;

    return this.each(function() {
        var inst = $.data(this, 'plugin_' + pluginName);
        if (inst) {
            inst.api(parentArgs[0], parentArgs[1]);
        } else {
            $.data(this, 'plugin_' + pluginName, new TokenInput(this, parentArgs[0]));
        }
    })
};