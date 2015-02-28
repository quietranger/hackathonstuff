var Backbone = require('backbone');
var Morris = require('morris');
var Q = require('q');
var moment = require('moment');
var Handlebars = require('hbsfy/runtime');

var trendingAjax = require('./trendingAjax');
var keywordTrendingTmpl = require('../templates/keywordTrending.handlebars');
var trendingListView = require('./trendingListView');

var KEYWORD_TYPE = {
    "hashtag": "hashtag",
    "cashtag": "cashtag",
    "all": "all"
};

var GRAPH_TYPE = {
    "bar": "bar",
    "line": "line",
    "pie": "pie"
};

module.exports = Backbone.View.extend({
    className: "keyword-trending-main-container",
    events: {
        'click .trending-tab-button': 'onTrendingTabButton',
        'click .trending-button': 'onTrendingButton'
    },

    initialize: function(opts) {
        this.opts = opts || {};
        this.sandbox = this.opts.sandbox;
        this.keywordType = KEYWORD_TYPE[opts.keywordType] || KEYWORD_TYPE.hashtag;
        this.graphType = GRAPH_TYPE[opts.graphType] || GRAPH_TYPE.bar;
        this.trendingData = this._processData(opts.data);
        this.trendingHistoryData = {};
        this.trendingList = null;
        this.graph = null;
        var self = this;
        this.sandbox.subscribe("module:afterResize:" + this.opts.viewId, function(context, args) {
            self.afterResize(args);
        });
        this.qRendered = Q.defer();
    },

    afterResize: function(args) {
        if (this.graph) {
            this.graph.elementWidth = this.$el.width();
            this.graph.elementHeight = this.$el.height();
            this.graph.resizeHandler();
        }
    },

    render: function() {
        var self = this;
        this.$el.html(keywordTrendingTmpl());
        this.qRendered.resolve();
        this.qRendered.promise.done(function() {
            self._refresh();
        });

        return this;
    },
    _refresh: function (reason) {
        // console.log(reason);
        var self = this;
        this._renderList(self.trendingData[self.keywordType]);
        if (this.graphType === 'line') {
            this._fetchTrendingHistoryData(_(self.trendingData[self.keywordType]).pluck('name')).done(function (rsp) {
                self.trendingHistoryData = self._processHistoryData(rsp);
                self._renderGraph(self.trendingHistoryData);
            }, function () {
                console.log("trending ajax failed");
            });
        } else {
            this._renderGraph(this.trendingData[self.keywordType]);
        }
    },
    _renderGraph: function(graphData) {
        this.$el.find('div[data-keyword-type]').parents().removeClass('active');
        this.$el.find("div[data-keyword-type='" + this.keywordType + "']").parent().addClass('active');
        this.$el.find('div[data-graph-type]').parents().removeClass('active');
        this.$el.find("div[data-graph-type='" + this.graphType + "']").parent().addClass('active');
        this._removeGraph();
        this.__drawGraph(graphData);
    },

    _renderList: function(listData) {
        var self = this;
        this._removeList();
        this.trendingList = new trendingListView({
            sandbox: self.sandbox,
            entityName: "Keyword",
            entityUnit: "Count",
            trendingData: listData,
            listType: "keyword"
        });
        this.$el.find('.canvas').append(this.trendingList.render().el);
    },

    __drawGraph: function(graphData) {
        this.nReloads = 0;
        var param = {
            element: 'two-canvas',
            data: graphData,
            hideHover: 'auto'
        };
        switch (this.graphType) {
            case "bar":
                param.xkey = 'name';
                param.ykeys = ['data'];
                param.labels = ['Tweets'];
                param.barColors = function(row, series, type) {
                    var colors = ['#FF6961', '#FFB347', '#90C950', '#89CBDF', '#B19CD9', '#C97586', '#DB8449', '#69821B', '#698AAB', '#68699B'];
                    // var colors = ['#FF6961', '#FFB347', '#90C950', '#89CBDF', '#B19CD9', '#646464', '#646464', '#646464', '#646464', '#646464'];
                    return colors[row.x];
                };
                param.barSizeRatio = 0.7;
                param.xLabelMargin = 2;
                this.graph = Morris.Bar(param);
                break;
            case "line":
                param.xkey = 'timestamp';
                param.ykeys = this.__getYKeys(param.data, param.xkey);
                param.labels = param.ykeys;
                param.smooth = false;
                this.graph = new Morris.Line(param);
                break;
            case "pie":
            default:
                var newData = [];
                for (var i in param.data) {
                    newData[i] = {
                        label: param.data[i]['name'],
                        value: param.data[i]['data']
                    }
                }
                param.data = newData;
                //['#f1614d', '#ff9000', '#90c851', '#88cbdf', '#B19CD9'];
                // param.colors = ['#FF6961', '#FFB347', '#90C950', '#89CBDF', '#B19CD9'];
                param.colors = ['#FF6961', '#FFB347', '#90C950', '#89CBDF', '#B19CD9', '#C97586', '#DB8449', '#69821B', '#698AAB', '#68699B'];
                param.backgroundColor = "rgba(#000,0)";
                param.labelColor = "#fff";
                param.formatter = function(x) {
                    return "Tweets: " + x;
                };
                this.graph = Morris.Donut(param);
                break;
        }
    },

    _fetchTrendingHistoryData: function (list) {
        return trendingAjax.doGET({
            baseUrl: trendingAjax.URL.historyQuery,
            payload: {
                action: "records",
                category: "KEYWORD",
                keys: list.join(),
                from: +moment().subtract(24, 'hours').toDate(),
                to: +moment().toDate()
            }
        });
    },
    _processData: function(data) {
        var envelope = {};
        for(var type in KEYWORD_TYPE){
            var datum;
            if(type != "all") {
                datum = data[type];
            }else{
                datum = data["cashtag"].concat(data["hashtag"]);
                datum = _(datum).sortBy(function (item) {
                    return item[1];
                }).reverse().slice(0, 10);
            }

//            datum = _(datum).sortBy(function(item) {
//                return item[1];
//            }).reverse().slice(0, 10);
            datum = _(datum).map(function(item, i) {
                return {
                    index: 1 + i,
                    name: item[0],
                    data: item[1],
                    // TODO: change the status algorithm
                    status: true
                };
            });
            envelope[type] = datum;
        }
        return envelope;

    },
    _processHistoryData: function(data) {
        var ret = _.chain(data["trendingStatList"]).flatten().map(function(it) {
            return {
                timestamp: Math.floor(new Date(it.timestamp).getTime() / (1000 * 60 * 30)) * (1000 * 60 * 30),
                key: it.key,
                count: it.count
            };
        }).groupBy('timestamp').map(function(it, key) {
            return _.chain(it).reduce(function(sum, num) {
                if (!sum[num.key]) sum[num.key] = 0;
                sum[num.key] += num.count;
                return sum;
            }, {}).extend({
                timestamp: moment.unix(key/1000).format('YYYY-MM-DD HH:mm')
            }).value();
        }).last(24).value();
        return ret;
    },
    _removeGraph: function() {
        if (this.graph) {
            // remove raphael paper
            this.graph.raphael.remove();
            // detach all events
            this.$el.find('#two-canvas').off();
            // clean up the div
            this.$el.find('#two-canvas').empty();
            this.graph = null;
        }
    },

    _removeList: function() {
        if (this.trendingList) {
            this.trendingList.destroy();
            this.trendingList = null
        }
    },

    __getYKeys: function(data, x) {
        var keys = [];
        for (var i in data) {
            keys = _.union(_(data[i]).keys(), keys);
        }
        return _(keys).without(x, 'index');
    },

    onTrendingButton: function(e) {
        var type = $(e.currentTarget).attr('data-graph-type');

        if (this.graphType == type) {
            return;
        }

        this.graphType = type;
        this._refresh();
    },

    onTrendingTabButton: function(e) {
        var type = $(e.currentTarget).attr('data-keyword-type');

        if (this.keywordType == type) {
            return;
        }

        this.keywordType = type;
        this._refresh();
    },

    destroy: function() {
        this._removeGraph();
        this._removeList();
        this.remove();
    }
});