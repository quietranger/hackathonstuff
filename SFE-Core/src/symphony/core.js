'use strict';

var Sandbox = require('./sandbox');
var SandboxFloat = require('./sandboxFloat');
var Logger = require('./extensions/logger');
var Q = require('q');

var ExtensionFactory = function(constructor) {
    var F = constructor.bind.apply(constructor, arguments);

    return new F();
};

var Core = function (opts) {
    var self = this;

    this.modules = {};
    this.opts = opts || {};
    this.isFloater = this.opts.floaterId || false;

    if (this.isFloater) {
        this.sandbox = new SandboxFloat(this.opts.floaterId);
    } else {
        window.name = 'main';

        this.sandbox = new Sandbox();
    }

    this.logger = new Logger(this.sandbox);
    this._extensions = {
        sandbox: this.sandbox,
        logger: this.logger
    };

};

Core.prototype.getClientType = function() {
    var self = this,
        typeQ = Q.defer();


    if(this.opts.floaterId) {
        this.opts.type = 'floater';
        typeQ.resolve({type: 'floater'})
    }

    if(this.opts.type === 'widget') {
        var widgetObj = null;

        this.checkLongpollExistence().then(function(rsp){
            console.log('longpoll running: ', rsp);

            widgetObj = {
                'type'              : 'widget',
                'existingConnection': rsp
            };

            self.opts.type = 'widget';
            self.opts.widget = true;
            self.opts.existingConnection = rsp;
            self.opts.mainWidget = !rsp;

            typeQ.resolve(widgetObj);

            console.log('Widget mode, connection exists:', rsp);

        }, function(rsp){

        });
    }

    if(!this.opts.floaterId && this.opts.type !== 'widget') {
        this.opts.type = 'main';

        typeQ.resolve({type: 'main'});
    }

    return typeQ.promise;
};

Core.prototype.checkLongpollExistence = function() {
    var self = this,
        longpollQ = Q.defer(),
        randomWidgetId = 'widgetId'+new Date().getTime()+Math.floor(Math.random()*1000);

    localStorage.setItem(randomWidgetId, '0');

    setTimeout(function(){
        var existingConnection = localStorage.getItem(randomWidgetId) === '1';

        localStorage.removeItem(randomWidgetId);

        longpollQ.resolve(existingConnection);
    }, 300);

    return longpollQ.promise;
};

Core.prototype.registerExtension = function(name, extension) {
    if (_.isEmpty(name) || typeof name !== 'string') {
        throw new Error('Cannot register a core extension without a valid name.');
    }

    if (this._extensions[name]) {
        throw new Error('An extension named ' + name + ' already exists.');
    }

    var deps = extension.toString().match(/^function\s*[^\(]*\(\s*([^\)]*)\)/m)[1]
        .replace(/ /g, '').split(',');

    var args = [];

    if (deps[0] === '') {
        deps = [];
    }

    for (var i = 0; i < deps.length; i++) {
        var depName = deps[i],
            dep = depName === 'core' ? this : this._extensions[depName];

        if (!dep) {
            throw new Error('Could not resolve dependency: ' + dep);
        }

        args.push(dep);
    }

    this._extensions[name] = ExtensionFactory.apply({}, [extension].concat(args));
};

Core.prototype.getExtension = function(name) {
    return this._extensions[name];
};

Core.prototype.start = function (moduleId, opts) {
    if (this.modules[moduleId] === "undefined") {
        this.logger.warn('Unable to start module "', moduleId, '" does not exist.');
        return false;
    }

    var options = opts || {},
        viewOpts = _.extend(options, {
            'sandbox': this.sandbox,
            'symphony': this.opts
        });

    return new this.modules[moduleId].creator(viewOpts);
};

Core.prototype.register = function (moduleId, creator) {
    if (typeof moduleId !== 'string' || typeof creator.createView !== 'function') {
        this.logger.warn('Unable to register module "', moduleId, '" invalid parameters.');
        return false;
    }

    if (this.modules[moduleId]) {
        this.logger.warn('Unable to register module "', moduleId, '" already registered.');
        return false;
    }

    this.modules[moduleId] = {
        name: moduleId,
        creator: creator.createView
    };

    this.logger.info('Registered "', moduleId, '"');
    return true;
};

Core.prototype.floaterReady = function () {
    //var self = this;

    window.opener.postMessage({
        method: 'floaterReady',
        floaterId: this.opts.floaterId
    }, '*');
};

module.exports = Core;
