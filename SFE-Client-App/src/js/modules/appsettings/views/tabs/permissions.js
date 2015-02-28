// symphony dependencies
var config = require("../../../../config/config");
var utils = require("../../../../utils");
var Symphony = require("symphony-core");

// 3rd party dependencies
var Q = require("q");

// templates
var permissionsTmpl = require("../../templates/permissions/index.handlebars");
var typeaheadResultTmpl = require('../../../common/templates/person-result.handlebars');

// views
var BaseTabView = require("./base");
var ListView = require("../tools/list");


module.exports = BaseTabView.extend({

    // backbone methods

    initialize: function (opts) {
        this._baseClientDataPath = "app.account";
        BaseTabView.prototype.initialize.apply(this, arguments);

        // view properties
        this._ownAccountDelegates = [];
        this._sharedAccounts = [];
        this._activeSharedAccount = null;
        this._activeSharedAccountDelegates = [];

        // set up typeahead
        this._peopleTypeaheadSearch = new Bloodhound({
            datumTokenizer: Bloodhound.tokenizers.obj.whitespace("value"),
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            limit: 3,
            remote: {
                url: Symphony.Config.API_ENDPOINT + "/search/Search?q=%QUERY&type=people",
                filter: function (parsedResponse) {
                    var users = [];
                    for (var i = 0; i < parsedResponse.queryResults[0].users.length; i++) {
                        var user = parsedResponse.queryResults[0].users[i];
                        if (user.person.id != this._accountData.userName) {
                            users.push(user);
                        }
                    }
                    return users;
                }.bind(this)
            }
        });
        this._peopleTypeaheadSearch.initialize();
    },

    render: function () {
        this._renderPromise.then(function (response) {
            this.$el.html(permissionsTmpl({
                showSharedAccounts: process.env.ENABLE_SHARED_ACCOUNTS === 'true' && this._accountData.systemAccountOwner && this._sharedAccounts.length > 0,
                sharedAccounts: this._sharedAccounts
            }));
        }.bind(this));
        return BaseTabView.prototype.render.apply(this, arguments);
    },

    postRender: function () {
        this._renderPromise.then(function () {
            this._renderOwnAccountDelegates();
            this._renderActiveSharedAccountDelegates();

            // attach typeahead to own account add people input field
            this._ownAccountAddDelegateTypeahead = this.$el.find('.field-own-account-add-delegates-input input').typeahead({
                minLength: config.MIN_SEARCH_LENGTH,
                highlight: true
            }, {
                name: 'ownAccountAddDelegateTypeahead',
                displayKey: function (suggestion) {
                    return suggestion.person.prettyName;
                },
                source: this._peopleTypeaheadSearch.ttAdapter(),
                templates: {
                    suggestion: typeaheadResultTmpl
                }
            });

            // attach typeahead to shared account add people input field
            this._activeSharedAccountAddDelegateTypeahead = this.$el.find('.field-shared-account-add-delegates-input input').typeahead({
                minLength: config.MIN_SEARCH_LENGTH,
                highlight: true
            }, {
                name: 'sharedAccountAddDelegateTypeahead',
                displayKey: function (suggestion) {
                    return suggestion.person.prettyName;
                },
                source: this._peopleTypeaheadSearch.ttAdapter(),
                templates: {
                    suggestion: typeaheadResultTmpl
                }
            });
        }.bind(this));

        return BaseTabView.prototype.postRender.apply(this, arguments);
    },

    destroy: function () {
        if (this._ownAccountDelegatesView) {
            this._ownAccountDelegatesView.destroy();
        }
        if (this._activeSharedAccountDelegatesView) {
            this._activeSharedAccountDelegatesView.destroy();
        }
        if (this._ownAccountAddDelegateTypeahead) {
            this._ownAccountAddDelegateTypeahead.typeahead("destroy");
        }
        if (this._sharedAccountAddDelegateTypeahead) {
            this._sharedAccountAddDelegateTypeahead.typeahead("destroy");
        }
        BaseTabView.prototype.destroy.apply(this, arguments);
    },


    // event handlers

    events: {
        "click .field-own-account-add-delegates button": "_showOwnAccountAddDelegateInput",
        "click .field-shared-account-add-delegates button": "_showSharedAccountAddDelegateInput",
        "change .field-shared-accounts select": "_changeActiveSharedAccount",
        "typeahead:selected .field-own-account-add-delegates-input": "_addOwnAccountDelegate",
        "typeahead:selected .field-shared-account-add-delegates-input": "_addActiveSharedAccountDelegate",
        "click .field-own-account-delegates-list .list-item i.delete:not(.temporarily-disabled)": "_removeOwnAccountDelegate",
        "click .field-shared-account-delegates-list .list-item i.delete:not(.temporarily-disabled)": "_removeActiveSharedAccountDelegate"
    },

    _showOwnAccountAddDelegateInput: function (event) {
        $(event.currentTarget).closest(".field").addClass("hidden");
        this.$el.find(".field-own-account-add-delegates-input").removeClass("hidden").find("input").focus();
    },

    _showSharedAccountAddDelegateInput: function (event) {
        $(event.currentTarget).closest(".field").addClass("hidden");
        this.$el.find(".field-shared-account-add-delegates-input").removeClass("hidden").find("input").focus();
    },

    _changeActiveSharedAccount: function (event) {
        this._activeSharedAccount = _.findWhere(this._sharedAccounts, {userId: $(event.currentTarget).val()});
        this._getActiveSharedAccountDelegates()
            .then(function () {
                this._renderActiveSharedAccountDelegates();
                this.$el.find(".field-shared-account-add-delegates.hidden").removeClass("hidden");
                this.$el.find(".field-shared-account-add-delegates-input:not(.hidden)").addClass("hidden");
            }.bind(this));
    },

    _addOwnAccountDelegate: function (event, suggestion, dataset) {
        this._ownAccountAddDelegateTypeahead.typeahead("val", "");
        if (_.findWhere(this._ownAccountDelegates, {id: suggestion.person.id})) {
            return;
        }
        this.eventBus.trigger("start:loading");
        this.sandbox.send({
            id: "DELEGATE",
            payload: {
                action: "add",
                userid: suggestion.person.id
            }
        }).then(function () {
                this._ownAccountDelegates.push({
                    id: suggestion.person.id,
                    prettyName: suggestion.person.prettyName
                });
                this._renderOwnAccountDelegates();
                // rerender active shared account delegates if same as own account
                if (this._activeSharedAccount && this._activeSharedAccount.userId == this._accountData.userName) {
                    this._getActiveSharedAccountDelegates().then(function () {
                        this._renderActiveSharedAccountDelegates();
                        this.eventBus.trigger("stop:loading");
                    }.bind(this));
                } else {
                    this.eventBus.trigger("stop:loading");
                }
            }.bind(this));
    },

    _addActiveSharedAccountDelegate: function (event, suggestion, dataset) {
        this._activeSharedAccountAddDelegateTypeahead.typeahead("val", "");
        if (_.findWhere(this._activeSharedAccountDelegates, {id: suggestion.person.id})) {
            return;
        }
        this.eventBus.trigger("start:loading");
        this.sandbox.send({
            id: "DELEGATE",
            payload: {
                action: "add",
                userid: suggestion.person.id,
                accountid: this._activeSharedAccount.userId
            }
        }).then(function () {
                this._activeSharedAccountDelegates.push({
                    id: suggestion.person.id,
                    prettyName: suggestion.person.prettyName
                });
                this._renderActiveSharedAccountDelegates();
                // rerender own account delegates if same as active shared account
                if (this._activeSharedAccount.userId == this._accountData.userName) {
                    this._getOwnAccountDelegates().then(function () {
                        this._renderOwnAccountDelegates();
                        this.eventBus.trigger("stop:loading");
                    }.bind(this));
                } else {
                    this.eventBus.trigger("stop:loading");
                }
            }.bind(this));
    },

    _removeOwnAccountDelegate: function (event) {
        this.eventBus.trigger("start:loading");
        var $element = $(event.currentTarget).closest(".list-item");
        var delegateId = $element.data("id");
        this.sandbox.send({
            id: "DELEGATE",
            payload: {
                action: "remove",
                userid: delegateId
            }
        }).then(function (response) {
                if (response.status != "OK") {
                    this._logChange(false, {
                        tab: "permissions",
                        action: "removing a delegate from the user's own account",
                        message: response.message
                    });
                    return;
                }
                this._ownAccountDelegates = _.filter(this._ownAccountDelegates, function (delegate) {
                    return delegate.id != delegateId;
                });
                $element.remove();
                // rerender active shared account delegates if same as own account
                if (this._activeSharedAccount && this._activeSharedAccount.userId == this._accountData.userName) {
                    this._getActiveSharedAccountDelegates().then(function () {
                        this._renderActiveSharedAccountDelegates();
                        this.eventBus.trigger("stop:loading");
                    }.bind(this));
                } else {
                    this.eventBus.trigger("stop:loading");
                }
            }.bind(this));
    },

    _removeActiveSharedAccountDelegate: function (event) {
        this.eventBus.trigger("start:loading");
        var $element = $(event.currentTarget).closest(".list-item");
        var delegateId = $element.data("id");
        this.sandbox.send({
            id: "DELEGATE",
            payload: {
                action: "remove",
                userid: delegateId,
                accountid: this._activeSharedAccount.id
            }
        }).then(function (response) {
                if (response.status != "OK") {
                    this._logChange(false, {
                        module: "appsettings",
                        tab: "permissions",
                        action: "removing a delegate from the user's shared account (" + this._activeSharedAccount.prettyName + ")",
                        message: response.message
                    });
                    return;
                }
                this._activeSharedAccountDelegates = _.filter(this._activeSharedAccountDelegates, function (delegate) {
                    return delegate.id != delegateId;
                });
                $element.remove();
                // rerender own account delegates if same as active shared account
                if (this._activeSharedAccount.userId == this._accountData.userName) {
                    this._getOwnAccountDelegates().then(function () {
                        this._renderOwnAccountDelegates();
                        this.eventBus.trigger("stop:loading");
                    }.bind(this));
                } else {
                    this.eventBus.trigger("stop:loading");
                }
            }.bind(this));
    },


    // helpers

    _refreshData: function () {
        var deferred = Q.defer();
        var promise = BaseTabView.prototype._refreshData.apply(this, arguments);
        this._renderPromise = deferred.promise;
        promise.then(function (response) {
            this._getOwnAccountDelegates().then(function () {
                if (this._accountData.systemAccountOwner) {
                    this._getSharedAccounts().then(function () {
                        this._getActiveSharedAccountDelegates().then(function () {
                            deferred.resolve(true);
                        }.bind(this));
                    }.bind(this));
                } else {
                    deferred.resolve(true);
                }
            }.bind(this));
        }.bind(this));
        return this._renderPromise;
    },

    _getSharedAccounts: function () {
        var promise = this.sandbox.send({
            id: "DELEGATE",
            payload: {
                action: "getaccounts",
                userid: this._accountData.userId
            }
        });
        promise.then(function (response) {
            this._sharedAccounts = response.result;
            if (this._sharedAccounts.length) {
                this._activeSharedAccount = this._sharedAccounts[0];
            }
        }.bind(this));
        return promise;
    },

    _getOwnAccountDelegates: function () {
        var promise = this.sandbox.send({
            id: "DELEGATE",
            payload: {
                action: "get",
                userid: this._accountData.userName
            }
        });
        promise.then(function (response) {
            this._ownAccountDelegates = _.filter(response.result, function (delegate) {
                return delegate.id != this._accountData.userName;
            }.bind(this));
        }.bind(this));
        return promise;
    },

    _getActiveSharedAccountDelegates: function () {
        var promise = this.sandbox.send({
            id: "DELEGATE",
            payload: {
                action: "get",
                accountid: this._activeSharedAccount.userId
            }
        });
        promise.then(function (response) {
            this._activeSharedAccountDelegates = _.filter(response.result, function (delegate) {
                return delegate.id != this._accountData.userName;
            }.bind(this));
        }.bind(this));
        return promise;
    },

    _renderOwnAccountDelegates: function () {
        if (!this._ownAccountDelegatesView) {
            // create list view
            this._ownAccountDelegatesView = new ListView({
                sandbox: this.sandbox,
                eventBus: this.eventBus,
                header: "People who can post on your behalf"
            });
            this._ownAccountDelegatesView.setElement(this.$el.find(".field-own-account-delegates-list"));
        } else {
            this._ownAccountDelegatesView._removeAllItems();
        }

        // add delegates
        this._ownAccountDelegates.forEach(function (delegate) {
            this._ownAccountDelegatesView._add({
                id: delegate.id,
                value: delegate.prettyName,
                canDelete: true
            });
        }.bind(this));

        // render it
        this._ownAccountDelegatesView._items.sort(utils.sortObjectArrayCompareFunction("value"));
        this._ownAccountDelegatesView.render().postRender();
    },

    _renderActiveSharedAccountDelegates: function () {
        if(this._activeSharedAccount) {
            if (!this._activeSharedAccountDelegatesView) {
                // create list view
                this._activeSharedAccountDelegatesView = new ListView({
                    sandbox: this.sandbox,
                    eventBus: this.eventBus,
                    header: "People who can post from " + (this._activeSharedAccount ? this._activeSharedAccount.prettyName : ""),
                    el: this.$el.find(".field-shared-account-delegates-list")
                });
            } else {
                this._activeSharedAccountDelegatesView._removeAllItems();
            }

            // add delegates
            this._activeSharedAccountDelegates.forEach(function (delegate) {
                this._activeSharedAccountDelegatesView._add({
                    id: delegate.id,
                    value: delegate.prettyName,
                    canDelete: true
                });
            }.bind(this));

            // render it
            this._activeSharedAccountDelegatesView._items.sort(utils.sortObjectArrayCompareFunction("value"));
            this._activeSharedAccountDelegatesView.render().postRender();
        }
    }



});
