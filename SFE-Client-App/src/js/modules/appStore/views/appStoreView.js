var Backbone = require('backbone');
var Symphony = require('symphony-core');
var config = require('../../../config/config');
var Q = require('q');

var appStoreTmpl = require('../templates/appStore.handlebars');
var applicationView = require('./appView');
var appsCollection = require('../collections/appCollection');

module.exports = Symphony.Module.extend({
    className: 'app-store module',

    events: {

    },

    psEvents: {
        'app:uninstall': 'appUninstall'
    },

    moduleHeader: '<h2>Symphony App Store</h2>',

    initialize: function(opts) {
        var self = this,
            accountData = opts.sandbox.getData('app.account'),
            activeApps = opts.sandbox.getData('documents.apps.activeApps'),
            q = Q.defer();

        this.appsMockup = [
            {
                'name'              : 'eTask (beta)',
                'appId'             : '123',
                'module'            : 'iFrameLoader',
                'moduleName'        : 'iFrameLoader',
                'streamId'          : '123',
                'version'           : '1.0',
                'description'       : 'Firmwide task list that provides users the ability to see and action tasks managed by the EP Workflow Platform.',
                'iFrame'            : 'https://prod-ep.etask.workflow.ep.site.gs.com/#/etask/symphony/tasks',
                'thumbnail'         : 'etask_icon_large.png',
                'runHeadless'       : true
            },{
                'name'              : 'Trending (beta)',
                'appId'             : '1234',
                'module'            : 'trendingTool',
                'moduleName'        : 'trendingTool',
                'streamId'          : 'trending',
                'version'           : '0.1',
                'description'       : 'View trending content on the Symphony platform. This is a beta product and users may notice certain issues isolated to the app.',
                'thumbnail'         : 'trending_icon_large.png'
            }
        ];

        Symphony.Module.prototype.initialize.call(this, opts);

        this.activeApps = q.promise;

        Q.all([accountData, activeApps]).spread(function(acct, apps){
            if(apps && apps.length) {
                for(var i = 0, len = apps.length; i < len; i++) {
                    for(var j = 0, len2 = self.appsMockup.length; j < len2; j++) {
                        if(apps[i].appId === self.appsMockup[j].appId) {
                            self.appsMockup[j].activeApp = true;
                        }
                    }
                }
            }

            self.apps = new appsCollection(self.appsMockup);

            q.resolve();

        }, function(rsp) {
            console.log('bad', rsp)
        });


    },

    render: function() {
        this.$content.html(appStoreTmpl());
        return Symphony.Module.prototype.render.call(this);
    },

    postRender: function() {
        var self = this,
            $appList = this.$content.find('.app-list');

        this.activeApps.then(function(activeApps){

            self.apps.each(function(app){
                var theApp = new applicationView({
                    model: app,
                    sandbox: self.sandbox
                });

                $appList.append(theApp.render().el);
            });

            return Symphony.Module.prototype.postRender.call(self);
        });
    },

    destroy: function() {
        Symphony.Module.prototype.destroy.call(this);
    },

    appUninstall: function(appData) {
        this.apps.each(function(model){
            //if(model.get('appId') === appData.appId) {
                model.trigger('change');
            //}
        });
    }
});
