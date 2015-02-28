var Q = require('q');

var HashtagValidator = /(?:^[^!@#$%^&*()+=<>,./?`~:;'"\\\\|\s-]+)$/g;
var CashtagValidator = /(?:^[a-zA-Z0-9][a-zA-Z0-9_]*(?:[^\s][a-zA-Z]+)?)$/g;

var ruleTypes = {
    KEYWORD: 'KEYWORD',
    CASHTAG: 'CASHTAG',
    USER_FOLLOW: 'USER_FOLLOW'
};

var prefixes = {
    '#': ruleTypes.KEYWORD,
    '$': ruleTypes.CASHTAG,
    '@': ruleTypes.USER_FOLLOW
};

var FilterBuilder = function(opts) {
    this.sandbox = opts.sandbox;
    this.userId = opts.userId;
    this.operator = opts.operator;
    this.name = opts.name;
    this.id = opts.id;

    this.existingKeywordsFollowers = {};
    this.addedRulesMap = {};
    this.rules = [];

    if (!this.sandbox) {
        throw new Error('Filter builder requires a valid sandbox instance.');
    }
};

FilterBuilder.prototype._didGetFilterData = function(rsp) {
    var keywords = _.findWhere(rsp, { filterType: 'KEYWORD' }),
        following = _.findWhere(rsp, { filterType: 'FOLLOWING' }),
        rules = [].concat(keywords.ruleGroup.rules).concat(following.ruleGroup.rules);

    for (var i = 0; i < rules.length; i++) {
        var rule = rules[i];
        this.existingKeywordsFollowers[rule.id + ':' + rule.connectorId] = true;
    }

    this.filterData = rsp;
};

FilterBuilder.prototype.addRule = function(rule) {
    var text = rule.text,
        id = rule.id,
        connectorId = rule.connectorId,
        type = prefixes[text[0]];

    if (_.isEmpty(text) || _.isEmpty(id) || _.isEmpty(connectorId) || _.isEmpty(type)) {
        return false;
    }

    if ((type === ruleTypes.KEYWORD && !text.substr(1).match(HashtagValidator)) ||
        (type === ruleTypes.CASHTAG && !text.substr(1).match(CashtagValidator))) {
        return false;
    }

    var key = id + ':' + connectorId;

    key = key.toLowerCase();

    if (this.addedRulesMap[key]) {
        return true;
    }

    var obj = {
        text: text,
        id: id,
        connectorId: connectorId,
        definitionType: type === ruleTypes.USER_FOLLOW ? type : ruleTypes.KEYWORD,
        type: 'DEFINITION'
    };

    this.addedRulesMap[key] = true;
    this.rules.push(obj);

    return true;
};

FilterBuilder.prototype.save = function() {
    var q = Q.defer();

    this.sandbox.getData('app.account.filters').then(this._didGetFilterData.bind(this))
        .then(this._saveFilter.bind(this))
        .then(function(rsp) {
            q.resolve(rsp);
        }).fail(function(rsp) {
            q.reject(rsp);
        });

    return q.promise;
};

FilterBuilder.prototype.delete = function() {
    if (!this.id) {
        throw new Error('Cannot delete a filter without an ID.');
    }

    var self = this;

    var ret = this.sandbox.send({
        id: 'DELETE_FILTER',
        urlExtension: encodeURIComponent(this.id)
    });

    ret.then(function() {
        self.id = null;
    });

    return ret;
};

FilterBuilder.prototype._saveFilter = function() {
    var q = Q.defer(),
        self = this;

    var payload = {
        ruleGroup: {
            rules: this.rules,
            operator: this.operator,
            type: 'GROUP'
        },
        userId: this.userId,
        name: this.name,
        filterType: 'FILTER'
    };

    var sendOpts = {
        id: 'CREATE_FILTER',
        payload: payload
    };

    if (this.id) {
        sendOpts.urlExtension = encodeURIComponent(this.id);
        sendOpts.id = 'UPDATE_FILTER';
    }

    this.sandbox.send(sendOpts).then(function(rsp) {
        self._updateDataStore(rsp);
        self.sandbox.publish('view:created', null, rsp);

        q.resolve(rsp);
    });

    return q.promise;
};

FilterBuilder.prototype._updateDataStore = function(rsp) {
    var setting = _.find(this.filterData, function(item) {
        return item._id === rsp._id;
    });

    if (setting) {
        setting.ruleGroup = rsp.ruleGroup;
    } else {
        this.filterData.push(rsp);
    }

    if(rsp.filterType === 'FOLLOWING'){
        //broadcast the following change, datastore will update itself upon receiving the event
        this.sandbox.publish('following:change', null, rsp);
    } else {
        this.sandbox.setData('app.account.filters', this.filterData);
    }
};

module.exports = FilterBuilder;
