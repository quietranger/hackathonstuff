var Backbone = require('backbone');
var Morris = require('morris');
var Q = require('q');
var moment = require('moment');
var Handlebars = require('hbsfy/runtime');

var sampleData = require('./sampleData');
var trendingAjax = require('./trendingAjax');
var peopleTrendingTmpl = require('../templates/peopleTrending.handlebars');

var trendingListView = require('./trendingListView');

var PEOPLE_TYPE = {
    "talkers": "talkers",
    "popstars": "popstars",
    "rising": "rising"
};

module.exports = Backbone.View.extend({
    className: "people-trending-main-container",
    events: {
        'click .trending-tab-button': 'onTrendingTabButton'
    },

    initialize: function (opts) {
        this.opts = opts || {};
        this.sandbox = this.opts.sandbox;
        this.peopleType = PEOPLE_TYPE[opts.peopleType] || PEOPLE_TYPE.talkers;
        this.rankingData = null;
        this.trendingList = null;
        this.graph = null;
        var self = this;
        this.sandbox.subscribe("module:afterResize:" + this.opts.viewId, function (context, args) {
            self.afterResize(args);
        });
        this.qRendered = Q.defer();
        this.timerID = setTimeout(function () {
                self._onTimer();
            }.bind(self),
                Math.ceil(new Date().getTime() / (1000 * 60 * 30)) * (1000 * 60 * 30) - new Date());
    },

    afterResize: function (args) {
        if (this.graph) {
            this.graph.elementWidth = this.$el.width();
            this.graph.elementHeight = this.$el.height();
            this.graph.resizeHandler();
        }
    },

    //TODO: need to refactor the logic. Should render the ranking data in render function, fetcg history data in postRender
    render: function () {
        var self = this;
        this.$el.html(peopleTrendingTmpl());
        this.qRendered.resolve();
        this.qRendered.promise.done(function () {
            self._refresh();
        });
        return this;
    },
    _refresh: function () {
        var self = this;
        this._fetchTrendingRealtimeData().done(function (rsp) {
            //TODO: should let Backend return the older data too, bcz front end may lose the data if user closes the view
            self.oldRankingData = self.rankingData;
            self.rankingData = self._processRankingData(rsp);
            var userIds = _(self.rankingData).pluck("userId");
            self._fetchTrendingHistoryData(userIds).done(function (rsp) {
                self.processedData = self._processData(rsp, self.rankingData);
                self._renderGraph(self.processedData);
                self._renderList(self.processedData);
            }, function (rsp) {
                console.log("trending ajax failed");
            });
        }, function (rsp) {
            console.log("trending ajax failed");
        });
    },
    _refreshShallow: function () {
        this._renderGraph(this.processedData);
        this._renderList(this.processedData);
    },
    _renderGraph: function (graphData) {
        // console.log(this.peopleType, this.graphType);
        this.$el.find('div[data-people-type]').parents().removeClass('active');
        this.$el.find("div[data-people-type='" + this.peopleType + "']").parent().addClass('active');
        this._removeGraph();
        this.__drawGraph(graphData);
    },
    _renderList: function (graphData) {
        var self = this;
        this._removeList();
        this.trendingList = new trendingListView({
            sandbox: self.sandbox,
            entityName: "People",
            entityUnit: "Posts",
            trendingData: graphData,
            listType: "people"
        });
        this.$el.find('.canvas').append(this.trendingList.render().el);
    },

    __drawGraph: function (graphData) {
        var param = {
            element: 'two-canvas',
            data: graphData,
            xkey: 'prettyName',
            ykeys: ['a', 'b', 'c', 'd', 'e', 'f'],
            labels: _.map(_.range(6), function (i) {
                var ts = Math.ceil(new Date().getTime() / (1000 * 60 * 30)) * (1000 * 60 * 30);
                return i === 0 ? 'Now' : i === 6 ? 'History' : moment(ts).subtract('minutes', i * 30).format("HH:mm");
            }),
            gridTextColor: '#898992',
            barColors: function(row, series, type) {
                var colors = ['#FF6961','#90C950', '#89CBDF', '#B19CD9', '#C97586', '#DB8449', '#69821B', '#698AAB', '#68699B', '#ebc875'];
                return colors[row.x];
            },
            stacked: true,
            hideHover: 'auto',
            xLabelMargin: 2
        };
        this.nReloads = 0;
        this.graph = Morris.Bar(param);
    },

    _fetchTrendingRealtimeData: function () {
        return trendingAjax.doGET({
            baseUrl: trendingAjax.URL.realtimeQuery,
            payload: {
                limit: 10,
                action: "ranking",
                category: "USER"
            }
        });
    },
    _fetchTrendingHistoryData: function (list) {
        return trendingAjax.doGET({
            baseUrl: trendingAjax.URL.historyQuery,
            payload: {
                keys: list.join(),
                action: "records",
                category: "USER",
                from: +moment().subtract(6, 'hours').toDate(),
                // from: 0,
                to: +moment().toDate()
            }
        });
    },
    getStatus: function (newData, oldData) {
        if (_(newData).isUndefined()) {
            return {
                css: "no",
                icon: "question-circle"
            };
        }
        if (_(oldData).isUndefined()) {
            return {
                css: "new",
                icon: "certificate"
            };
        }
        if (newData < oldData) {
            return {
                css: "down",
                icon: "arrow-down"
            };
        }
        if (newData > oldData) {
            return {
                css: "up",
                icon: "arrow-up"
            };
        }
        return {
            css: "no",
            icon: "dot-circle-o"
        };
    },
    _processRankingData: function (rsp) {
        /* generate the array in such format [{
            userId: numbericId,
            prettyName: user's prettyName
            messageCount: 8,
            rankingScore: 360,
            rank: 1
        },
          ...
        ]*/
        var self = this;
        return _.chain(rsp["USER"]).map(function (it) {
            var user = it[0];
            var obj = {
                userId: user.userId,
                prettyName: user.prettyName,
                messageCount: it[1],
                rankingScore: it[2]
            };
            return obj;
        }).sortBy('rankingScore').reverse().map(function (it, idx) {
            var oldIt = _(self.oldRankingData).findWhere({
                userId: it.userId
            });
            var oldRankingScore = oldIt ? oldIt.rankingScore : undefined;
            return _(it).extend({
                rank: idx + 1,
                status: self.getStatus(it.rankingScore, oldRankingScore)
            });
        }).value();
    },

    _processData: function (data, rankingData) {
        //a list of data grouped by userId + aggregated by timestamp (every 30 min)
        var groupedData = _(data["trendingStatList"]).chain().flatten().map(function (it) {
            return {
                timestamp: Math.round(new Date(it.timestamp).getTime() / (1000 * 60 * 30)) * (1000 * 60 * 30),
                key: it.key,
                count: it.count
            };
        }).groupBy('key').map(function (it, key) {
            var val = _(it).chain().groupBy('timestamp').map(function (it, key) {
                var val = _(it).pluck("count").reduce(function (sum, num) {
                    return sum + num;
                }, 0);
                return {
                    timestamp: it[0].timestamp,
                    key: it[0].key,
                    count: val
                };
            }).value();
            return {
                key: key,
                val: val
            }
        }).map(function (it) {
            var sorted = _(it['val']).chain().sortBy('timestamp');
            var sum = sorted.reduce(function (sum, num) {
                return sum + num.count;
            }, 0).value();
            var latestRecords = sorted.first(6).pluck("count").value();
            var history = sorted.rest(6).reduce(function (sum, num) {
                return sum + num.count;
            }, 0).value();
            //generate an object {a: firstRecord, b: second record ...}
            var arr = _(['a', 'b', 'c', 'd', 'e', 'f']).object(latestRecords);
            var userId = it['key'];
            return _(arr).extend({
                //z: history,
                userId: userId,
                data: arr['a'], /*message count in the latest 30 min*/
                sum: sum /*total msg count*/
            })
        }).value();

        var enrichedData = _(rankingData).map(function (it) {
            var aggregatedRecord = _.find(groupedData, function(data){
                return data.userId == it.userId
            });
            return _(it).extend(aggregatedRecord);
        });

        return enrichedData;

    },
    _removeGraph: function () {
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

    _removeList: function () {
        if (this.trendingList) {
            this.trendingList.destroy();
            this.trendingList = null
        }
    },

    _removeTimer: function () {
        if (this.timerID) {
            clearTimeout(this.timerID);
            this.timerID = null;
        }
    },

    __getYKeys: function (data, x) {
        var keys = [];
        for (var i in data) {
            keys = _.union(_.keys(data[i]), keys);
        }
        return _.without(keys, x);
    },

    _onTimer: function () {
        var self = this;
        this._removeTimer();
        this.timerID = setTimeout(function () {
                self._onTimer();
            }.bind(self),
                Math.ceil(new Date().getTime() / (1000 * 60 * 30)) * (1000 * 60 * 30) - new Date());
        this._refresh();
    },

    onTrendingTabButton: function (e) {
        var type = $(e.currentTarget).attr('data-people-type');

        if (this.peopleType == type) {
            return;
        }

        this.peopleType = type;
        this._refresh();
    },

    destroy: function () {
        this._removeTimer();
        this._removeGraph();
        this._removeList();
        this.remove();
    }
});