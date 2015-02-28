var Backbone = require('backbone');
var Morris = require('morris');
var Q = require('q');
var Handlebars = require('hbsfy/runtime');
var mixinDefaults = require('../../common/mixins/moduleDefaults');
var trendingTmpl = require('../templates/trending.handlebars');
var trendingAjax = require('./trendingAjax');
var keywordTrendingView = require('./keywordTrending');
var peopleTrendingView = require('./peopleTrending');
var roomTrendingView = require('./roomTrending');

var TRENDING_TYPE = {
    'keywords': 'KEYWORD',
    'users': 'USER',
    'rooms': 'ROOM'
};

var TRENDING_VIEWS = {
    'KEYWORD': keywordTrendingView,
    'USER': peopleTrendingView,
    'ROOM': roomTrendingView
};

module.exports = Backbone.View.extend({
    className: 'module static-content-module',
    events: {
        'click dd': 'didSelectTrendingType',
        'click .pin-view': 'togglePinned',
        'click .remove': 'closeView'
    },

    initialize: function(opts) {
        this.opts = opts || {};
        this.viewId = opts.viewId;
        this.isPinned = !!opts.isPinned;
        this.streamId = opts.streamId;
        this.module = opts.module;
        this.sandbox = this.opts.sandbox;
        this.data = {};
        this.qDataRequests = {};
        this.trendingType = TRENDING_TYPE[opts.trendingType] || TRENDING_TYPE.users;
        this.activeSubView = null;
        this._renderSubView.bind(this);
        var self = this;
        this.timerID = setTimeout(function() {
                self._onTimer();
            }.bind(self),
                Math.ceil(new Date().getTime() / (1000 * 60 * 30)) * (1000 * 60 * 30) - new Date());
    },

    render: function() {
        this.$el.html(trendingTmpl({
            moduleTitle: 'Trending Tool',
            isPinned: this.isPinned
        }));
        this.updateTrendingData();
        this._renderSubView();
        this.initTooltips();

        return this;
    },

    updateTrendingData: function(){
        for(var key in TRENDING_TYPE){
            var type = TRENDING_TYPE[key];
            this.updateCategory(type);
        }

    },

    updateCategory: function(category){
        var self = this;
        self.qDataRequests[category] = Q.defer();
        trendingAjax.doGET({
            baseUrl: trendingAjax.URL.realtimeQuery,
            payload: {
                action: 'ranking',
                category: category,
                limit: 10
            }
        }).done(function(rsp){
            self.data[category] = rsp;
            self.qDataRequests[category].resolve();
            //refresh current view
        }, function () {
            console.log('trending request to get ' + category + ' failed');
        });
    },

    _renderSubView: function () {
        var self = this;
        self.qDataRequests[self.trendingType].promise.done(function(){
            var type = self.trendingType;
            self.$el.find('a[data-trending-type]').parents().removeClass('active');
            self.$el.find("a[data-trending-type='" + type + "']").parent().addClass('active');
            if (self.activeSubView) {
                self.activeSubView.destroy();
                self.activeSubView = null;
            }

            self.activeSubView = new TRENDING_VIEWS[type]({
                sandbox: self.sandbox,
                viewId: self.opts.viewId,
                data: self.data[type]
            });
            self.$el.find('.module-content').append(self.activeSubView.render().el);
        });
    },

    _onTimer: function() {
        var self = this;
        this._removeTimer();
        this.timerID = setTimeout(function() {
                self._onTimer();
            }.bind(self),
                Math.ceil(new Date().getTime() / (1000 * 60 * 30)) * (1000 * 60 * 30) - new Date());
        this.updateTrendingData();
    },

    _removeTimer: function() {
        if (this.timerID) {
            clearInterval(this.timerID);
            this.timerID = null;
        }
    },

    togglePinned: function () {
        if (!this.isPinned) {
            var pinIcon = this.$el.find('.pin-view');

            this.isPinned = true;

            pinIcon.addClass('pinned');
            pinIcon.attr('data-tooltip', 'Module Pinned');
            this.destroyTooltips();
            this.initTooltips();
            this.sandbox.publish('view:pin', null, this.viewId);
        }
    },

    closeView: function () {
        this.sandbox.publish('view:close', null, this.viewId);
    },

    destroy: function() {
        if (this.activeSubView) {
            this.activeSubView.destroy();
            this.activeSubView = null;
        }
        this._removeTimer();
        this.remove();
    },

    didSelectTrendingType: function(e) {
        var type = $(e.currentTarget).find('a').attr('data-trending-type');

        if (this.trendingType == type) {
            return;
        }

        this.trendingType = type;
        this._renderSubView();
    }
});

mixinDefaults(module.exports);