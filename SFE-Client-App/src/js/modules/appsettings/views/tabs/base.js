// symphony dependencies
var config = require("../../../../config/config");

// 3rd party dependencies
var Symphony = require("symphony-core");
var Q = require("q");


module.exports = Symphony.View.extend({

    // backbone methods

    initialize: function (opts) {
        Symphony.View.prototype.initialize.apply(this, arguments);

        // symphony properties
        this.logger = opts.logger;
        this.currentViewType = null;
        this.isRunningInClientAppFlag = opts.isRunningInClientAppFlag;

        // module properties
        this._accountData = opts.accountData;

        this._refreshData();
    },


    // helpers

    _refreshData: function () {
        this.eventBus.trigger("start:loading");
        var self = this;
        this._renderPromise = this.sandbox.getData(this._baseClientDataPath);
        this._renderPromise.then(function (response) {
            var json = JSON.stringify(response);
            self._tabSettingsData = JSON.parse(json, function (k, v) {
                if (typeof v == "string") {
                    v = v.replace(/"/g, "");
                }

                if (v === "false") {
                    return false;
                } else if (v === "true") {
                    return true;
                }

                return v;
            });
        });
        return this._renderPromise;
    },

    postRender: function () {
        this.eventBus.trigger("stop:loading");
        return Symphony.View.prototype.postRender.apply(this, arguments);
    },

    _persistUpdate: function (path, value, noRender) {
        this.eventBus.trigger("start:loading");
        var q = Q.defer();
        this._disableInputFields();
        var promise = this.sandbox.setData(path, value);
        promise.then(function (response) {
            this._enableInputFields();
            if (response && response.status != "OK") {
                this._logChange(false, {
                    tab: "base",
                    action: "persisting to client data",
                    message: "error persisting to client data at path: " + path + ", with value: " + value
                });
                this.eventBus.trigger("stop:loading");
                q.resolve(false);
                return;
            }

            this._logChange(true, {
                tab: "base",
                action: "persisting to client data",
                message: "successful persisting to client data at path: " + path + ", with value: " + value
            });
            // reload view's data
            var dataPromise = this._refreshData();
            dataPromise.then(function () {
                if (!noRender) { // should re render the view?
                    this.render().postRender();
                }
                this.eventBus.trigger("stop:loading");
                q.resolve(true);
            }.bind(this));
        }.bind(this));
        return q.promise;
    },

    _disableInputFields: function () {
        this.$el.find("input:not(:disabled), textarea:not(:disabled), button:not(:disabled), select:not(:disabled)")
            .addClass("temporarily-disabled")
            .prop("disabled", true);
    },

    _enableInputFields: function () {
        this.$el.find(".temporarily-disabled")
            .removeClass("temporarily-disabled")
            .prop("disabled", false);
    },

    _logChange: function (success, messageObject) {
        console.log(_.extend(messageObject, {
            module: "appsettings",
            error: !success,
            success: success
        }));
    }

});
