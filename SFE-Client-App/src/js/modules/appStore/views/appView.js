var Backbone = require('backbone');
var Symphony = require('symphony-core');

var appItemTmpl = require('../templates/appItem.handlebars');

module.exports = Symphony.View.extend({
    className: 'app-item',

    model: null,

    events: {
        'click .add-app': 'addApp' //remove app achieved from app settings
    },

    initialize: function(opts) {
        Symphony.View.prototype.initialize.call(this, opts);

        this.model = opts.model;
        this.sandbox = opts.sandbox;

        this.listenTo(this.model, 'change', this.render);
    },

    render: function() {
        var self = this;

        this.sandbox.getData('documents.apps.activeApps').then(function(rsp){
            self.$el.html(appItemTmpl(_.extend(self.model.toJSON(), {
                'activeApp': _.findWhere(rsp, {'name': self.model.get('name')})
            })));
        }).done();

        return Symphony.View.prototype.render.call(this);
    },

    addApp: function() {
        var self = this,
            modelJSON = this.model.toJSON(),
            activeApps = [],
            $url = this.$el.find('.url'); //temporary

        /*this is temporary*/
        if(modelJSON.iFrame && $url.length && $url.val()) {
            this.model.set('iFrame', $url.val());
            modelJSON = this.model.toJSON();
        }

        this.sandbox.getData('documents.apps.activeApps').then(function(rsp) {
            activeApps = Object.prototype.toString.call(rsp) === "[object Array]" ? rsp : [];

            if(_.findWhere(activeApps, {'appId':modelJSON.appId})) {
                return;
            }

            activeApps.push(modelJSON);

            self.sandbox.setData('documents.apps.activeApps', activeApps).then(function(rsp) {
                self.sandbox.publish('view:created', null, modelJSON);

                if(modelJSON.runHeadless) {
                    self.sandbox.publish('headless:add', null, _.extend({'init': false}, modelJSON));
                } else {
                    self.sandbox.publish('view:show', null, modelJSON);
                }

                self.render();

                console.log(rsp);
            }, function(rsp){
                    //todo radaja failed to save to active apps
            });
        });
    },

    destroy: function() {
        this.model = null;

        Symphony.View.prototype.destroy.call(this);
    }
});
