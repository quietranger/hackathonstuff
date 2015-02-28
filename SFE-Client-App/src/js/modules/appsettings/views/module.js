// 3rd party dependencies
var Q = require("q");
var Symphony = require("symphony-core");
var Spin = require("spin");

// templates
var moduleTmpl = require("../templates/module.handlebars");

// constants
var TABS = {
    general: "general",
    alerts: "alerts",
    permissions: "permissions",
    applications: "applications",
    themes: "themes"
};

// views
var TAB_VIEW_MAP = {};
TAB_VIEW_MAP[TABS.general] = require("./tabs/general");
TAB_VIEW_MAP[TABS.alerts] = require("./tabs/alerts");
TAB_VIEW_MAP[TABS.permissions] = require("./tabs/permissions");
TAB_VIEW_MAP[TABS.applications] = require("./tabs/applications");
TAB_VIEW_MAP[TABS.themes] = require("./tabs/themes");


module.exports = Symphony.View.extend({

    // backbone properties

    className: "appsettings module",


    // backbone methods

    initialize: function (opts) {
        Symphony.View.prototype.initialize.apply(this, arguments);

        // symphony properties
        this.currentViewType = null;
        this.isRunningInClientAppFlag = opts.isRunningInClientAppFlag;

        // module properties
        this._activeTab = TABS.general;
        this._activeTabView = null;

        // setup promise to use in render chain
        var q = Q.defer();
        this._accountDataPromise = q.promise;

        // get account information
        this.sandbox.getData('app.account').then(function (response) {
            q.resolve(response);
            this._accountData = response;
            this._changeActiveTab(this._activeTab || TABS.general);
        }.bind(this));

        // set up spinner
        this._spinner = new Spin({
            color: '#fff',
            lines: 12,
            radius: 5,
            length: 6,
            width: 2,
            top: "50%",
            left: "50%"
        });
        this.listenTo(this.eventBus, "start:loading", this._startLoading.bind(this));
        this.listenTo(this.eventBus, "stop:loading", this._stopLoading.bind(this));
    },

    render: function () {
        this._accountDataPromise.then(function (response) {
            this.$el.html(moduleTmpl({
                showPermissionsTab: this._accountData.entitlement.delegatesEnabled,
                enableApplications: process.env.ENABLE_APPLICATIONS === 'true',
                tabs: TABS
            }));
            this._renderActiveTabView();
        }.bind(this));
        return Symphony.View.prototype.render.apply(this, arguments);
    },

    destroy: function () {
        this._activeTabView.destroy();
        Symphony.View.prototype.destroy.apply(this, arguments);
    },


    // event handlers

    events: {
        "click .tabs .tabs-tab:not(.active)": "_switchTab",
        "click button#done": "_hideModal"
    },

    _switchTab: function (event) {
        this._changeActiveTab(event.currentTarget.dataset.tab);
        this.$el.find(".tabs-tab.active").removeClass("active");
        $(event.currentTarget).addClass("active");
    },

    _hideModal: function (event) {
        this.sandbox.publish("modal:hide");
    },


    // helpers

    _changeActiveTab: function (tab) {
        if (this._activeTabView) {
            this._activeTabView.destroy();
        }

        if (tab in TAB_VIEW_MAP) {
            this._activeTabView = new TAB_VIEW_MAP[tab]({
                sandbox: this.sandbox,
                eventBus: this.eventBus,
                logger: this.logger,
                isRunningInClientAppFlag: this.isRunningInClientAppFlag,
                accountData: this._accountData
            });
            this._renderActiveTabView();
        }
    },

    _renderActiveTabView: function () {
        var self = this;
        this._activeTabView._renderPromise.then(function () {
            self.$el.find('.active-tab-container').html(self._activeTabView.el);
            self._activeTabView.render().postRender();
        });
    },

    _startLoading: function () {
        this._spinner.spin();
        this.$el.find(".appsettings-spinner").html(this._spinner.el);
    },

    _stopLoading: function () {
        this._spinner.stop();
    }

});
