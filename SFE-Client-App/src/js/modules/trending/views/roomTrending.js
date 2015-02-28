var Backbone = require('backbone');
var Morris = require('morris');
var Q = require('q');
var moment = require('moment');
var Handlebars = require('hbsfy/runtime');

var trendingAjax = require('./trendingAjax');
var peopleTrendingTmpl = require('../templates/roomTrending.handlebars');
var trendingListView = require('./trendingListView');
var MS_PER_MIN = 60000;
var TIME_RANGE = 6; //time range for historical data in hours, will show room message count from 6 hours ago to now

var DATA_SET_NAME = {
    "most_messages": "ROOM",
    "most_members": "ROOM_MOST_MEMBERS"
};

module.exports = Backbone.View.extend({
    className: "room-trending-main-container",
    events: {
        'click .trending-tab-button': 'onTrendingTabButton'
    },

    initialize: function(opts) {
        this.opts = opts || {};
        this.sandbox = this.opts.sandbox;
        this.currentDataSet = opts.currentDataSet || 'most_messages';
        this.data = opts.data;
        this.trendingData = null;
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
        this.$el.html(peopleTrendingTmpl());
        this.qRendered.resolve();
        this.qRendered.promise.done(function() {
            self._refresh();
        });

        return this;
    },

    _refresh: function () {
        var self = this;
        var dataToUse = self.data[DATA_SET_NAME[self.currentDataSet]];
        self.trendingData = self._preprocessData(dataToUse);
        if(this.currentDataSet == 'most_members'){
            self._renderGraph(self.trendingData);
        }else{
            //load historical data for ranking list
            self._fetchTrendingHistoryData(_(self.trendingData).pluck("threadId")).done(function (rsp) {
                self.historicalData = self._processData(rsp["trendingStatList"]);
                if(self.historicalData && self.historicalData.length){
                    self._renderGraph(self.historicalData);
                }
            }, function (rsp) {
                console.log("trending ajax failed");
            });
        }

        var listData = self._processData(dataToUse);
        self.sandbox.getData('app.account').then(function (rsp) {
            self.userId = rsp.userName;
            var tData = _(listData).map(function (it) {
                it.isMember = _(rsp.roomParticipations).findWhere({
                    threadId: it.threadId
                }) !== undefined;
                return it;
            });
            self._renderList(tData);
        });
    },

    _renderGraph: function(graphData) {
        // console.log(this.currentDataSet, this.graphType);
        this.$el.find('div[data-room-type]').parents().removeClass('active');
        this.$el.find("div[data-room-type='" + this.currentDataSet + "']").parent().addClass('active');
        this._removeGraph();
        this.__drawGraph(graphData);
    },
    _renderList: function(graphData) {
        var self = this;
        this._removeList();
        this.trendingList = new trendingListView({
            sandbox: self.sandbox,
            userId: self.userId,
            entityName: "Room Name",
            entityUnit: "Count",
            trendingData: graphData,
            listType: "room"
        });
        this.$el.find('.canvas').append(this.trendingList.render().el);
    },

    __drawGraph: function(graphData) {
        var param = {
            element: 'two-canvas',
            data: graphData,
            xkey: 'name',
            gridTextColor: '#898992',
            barColors: function(row, series, type) {
                var colors = ['#FF6961','#90C950', '#89CBDF', '#B19CD9', '#C97586', '#DB8449', '#69821B', '#698AAB', '#68699B', '#ebc875'];
                return colors[row.x];
            },
            stacked: true,
            hideHover: 'auto',
            xLabelMargin: 2
        };

        if(this.currentDataSet == 'most_members'){
            param.ykeys = ['data'];
            param.labels = ["Member count"];
        }else{
            var numIntervals = TIME_RANGE * 2;
            param.ykeys = _.range(numIntervals);
            param.labels = _.map(_.range(numIntervals), function(i) {
                var ts = Math.ceil(new Date().getTime() / (MS_PER_MIN * 30)) * (MS_PER_MIN * 30);
                return i === 0 ? 'Now' : i === numIntervals ? 'History' : moment(ts).subtract('minutes', i * 30).format("HH:mm");
            });
        }

        this.nReloads = 0;
        this.graph = Morris.Bar(param);
    },

    _fetchTrendingHistoryData: function (list) {
        return trendingAjax.doGET({
            baseUrl: trendingAjax.URL.historyQuery,
            payload: {
                keys: list.join(),
                action: "records",
                category: "ROOM",
                from: +moment().subtract(TIME_RANGE, 'hours').toDate(),
                // from: 0,
                to: +moment().toDate()
            }
        });
    },

    _preprocessData: function(data) {
        var ret = _(data).map(function (it, i) {
            return {
                index: i+1,
                name: it[0]["name"],
                threadId: it[0]["threadId"],
                data: it[1],
                rankingScore: it[2]
            };
        });

        return ret;
    },
    _processData: function (data) {
        function getStatus(n, e) {
            if (_(n).isUndefined()) {
                return {
                    css: "no",
                    icon: "question-circle"
                };
            }
            if (_(e).isUndefined()) {
                return {
                    css: "new",
                    icon: "certificate"
                };
            }
            if (n < e) {
                return {
                    css: "down",
                    icon: "arrow-down"
                };
            }
            if (n > e) {
                return {
                    css: "up",
                    icon: "arrow-up"
                };
            }
            return {
                css: "no",
                icon: "dot-circle-o"
            };
        }
        var tData = this.trendingData;
        var finalExam = _(data).chain().flatten().map(function(it) {
            return {
                timestamp: Math.round(new Date(it.timestamp).getTime() / (MS_PER_MIN * 30)) * (MS_PER_MIN * 30),
                key: it.key,
                count: it.count
            };
        }).groupBy('key').map(function(it, key) {
            var val = _(it).chain().groupBy('timestamp').map(function(it, key) {
                var val = _(it).pluck("count").reduce(function(sum, num) {
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
        }).map(function(it) {
            var sorted = _(it['val']).chain().sortBy('timestamp');
            var sum = sorted.reduce(function(sum, num) {
                return sum + num.count;
            }, 0).value();
            var numInterval = TIME_RANGE * 2;
            var a = sorted.first(numInterval-2).pluck("count").value();
            var history = sorted.rest(numInterval-2).reduce(function(sum, num) {
                return sum + num.count;
            }, 0).value();
            var index = _.range(numInterval);
            var arr = _(index).object(a);
            arr[numInterval-1] = history;
            var threadId = it['key'];
            return _(arr).extend({
                //z: history,
                threadId: threadId,
                data: arr[0],
                sum: sum
            })
        }).value();

        tData = _(tData).chain().map(function(it) {
            var t = _(finalExam).findWhere({
                threadId: it.threadId
            });
            return _(it).extend(t);

            // return _(it).extend(_(finalExam).chain().filter(function(elem) {
            //     return elem["threadId"] === it["threadId"];
            // }).first().value());
        }).sortBy("data").reverse().map(function(it, idx) {
            if (typeof it[0] === "undefined") {
                it[0] = it.data;
            }
            return _(it).extend({
                index: idx + 1,
                status: getStatus(it[0], it[1])
            });
        }).value();
        return tData;

    },
    destroy: function() {
        this._removeGraph();
        this._removeList();
        this.remove();
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
            keys = _.union(_.keys(data[i]), keys);
        }
        return _.without(keys, x);
    },

    onTrendingTabButton: function(e) {
        var type = $(e.currentTarget).attr('data-room-type');

        if (this.currentDataSet == type) {
            return;
        }

        this.currentDataSet = type;
        this._refresh();
    }
});