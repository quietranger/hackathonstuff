// symphony dependencies
var config = require("../../../../config/config");
var utils = require("../../../../utils");

// templates
var applicationsTmpl = require("../../templates/applications/index.handlebars");
var confirmRemovalTmpl = require("../../templates/applications/confirmRemoval.handlebars");

// views
var BaseTabView = require("./base");


module.exports = BaseTabView.extend({

  // backbone methods

  initialize: function (opts) {
    this._baseClientDataPath = "documents.apps";
    BaseTabView.prototype.initialize.apply(this, arguments);
  },

  render: function () {
    this._renderPromise.then(function(response) {
      this.$el.html(applicationsTmpl({
        applications: this._tabSettingsData.activeApps.map(function(app) {
          if (!app.iconUrl) {
            app.iconUrl = "http://symphony.com/wp-content/themes/twentytwelve-child/img/bg/secure-bg.png";
          };
          return app;
        })
      }));
      this.delegateEvents();
    }.bind(this));
    return BaseTabView.prototype.render.apply(this, arguments);
  },
  

  // event handlers
  
  events: {
    "click li[data-id] .field-remove button": "_askToConfirmRemoval",
    "click li[data-id] .field-yes button": "_removeApp",
    "click li[data-id] .field-no button": "_cancelRemoval"
  },

  _askToConfirmRemoval: function(event) {
    var $element = $(event.currentTarget);
    var $container = $element.closest("li[data-id]");
    $container.find(".application-info").addClass("hidden");
    $container.find(".application-buttons").addClass("hidden");
    $container.append(confirmRemovalTmpl({
      name: _.findWhere(this._tabSettingsData.activeApps, {appId: $container.data("id").toString()}).name
    }));
  },

  _removeApp: function(event) {
    var self = this,
        $element = $(event.currentTarget),
        appData = _.findWhere(this._tabSettingsData.activeApps, {'appId': $element.closest("li[data-id]").data("id").toString()});

    this._tabSettingsData.activeApps = _.filter(this._tabSettingsData.activeApps, function(app) {
      return app.appId != appData.appId
    });
    this._persistUpdate(utils.dotify(this._baseClientDataPath, "activeApps"), this._tabSettingsData.activeApps).then(function(){

        self.sandbox.publish('view:removed', null, appData.streamId);  //remove from left nav
        self.sandbox.publish('app:uninstall', null, appData); //today, just for appstore to update state

    if(appData.runHeadless) {
        self.sandbox.publish('headless:remove', null, _.extend({close:true}, appData));
    } else {
        self.sandbox.publish('view:close', null, appData.moduleName+appData.streamId);
    }
    });


  },

  _cancelRemoval: function(event) {
    var $element = $(event.currentTarget);
    var $container = $element.closest("li[data-id]");
    $container.find(".application-confirm-removal").remove();
    $container.find(".application-info.hidden").removeClass("hidden");
    $container.find(".application-buttons.hidden").removeClass("hidden");
  }

});
