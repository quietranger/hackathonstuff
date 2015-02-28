var Backbone = require('backbone');
var Q = require('q');
var _ = require('underscore');
var config = require('../../../config');
var easyGrid = require('../plugins/easyGrid');
var utils = require('../utils');
var chimeView = require('../views/chime');

var registerTypingViews = function () {
    var self = this,
        updatedIsTypingViews = [];

    Object.keys(this.views).forEach(function (view) {
        if ((this.views[view].module === 'chatroom' || this.views[view].module === 'im') && this.views[view].streamId) {
            updatedIsTypingViews.push(this.views[view].streamId);
        }
    }, this);

    Object.keys(this.floaters).forEach(function(view) {
        if ((this.floaters[view].module === 'chatroom' || this.floaters[view].module === 'im') && this.floaters[view].streamId) {
            updatedIsTypingViews.push(this.floaters[view].streamId);
        }
    }, this);


    if (_.difference(updatedIsTypingViews, self.isTypingViews).length) {
        //todo this is a hack to support floating windows
        if (this.transport) {
            this.transport.send({
                'id': 'REGISTER_IS_TYPING',
                'payload': {
                    'listeningThreads': '["' + updatedIsTypingViews.join('","') + '"]', //did i really just have to do this?
                    '_clientVersion': '1.0'
                }
            });
        }
    }
};

var Layout = function (core, sandbox, dataStore, logger, appBridge, transport) {
    var self = this;

    //views is a map of {viewId : viewInstance}
    self.views = {};
    self.headlessViews = {};
    self.userDefinedLayout = {};
    self.core = core;
    self.sandbox = sandbox;
    self.dataStore = dataStore;
    self.logger = logger;
    self.appBridge = appBridge;
    self.transport = transport;
    self.$body = $('body');
    self.$grid = $('#simple_grid');
    self.moduleInc = 0;
    self.focusedStreamId = null;
    self.isTypingViews = [];
    self.triggerViews = {};
    self.staticViews = ['ftue','changelog', 'appStore'];
    self.$chime = $('#chime');
    self.$chimeAudio = $('#chime-audio');
    self.chimeQueue = [];
    self.isChiming = false;
    self.iFrameReferences = self.sandbox.iFrames;
    self.isFloater = core.isFloater;
    self.floaters = this.isFloater ? {} : self.sandbox.floaters;
    self.headlessRendered = Q.defer();

    console.log('floater?', this.isFloater);

    self.$grid.on('grid:afterResize', function (e, opts) {
        self.sandbox.publish('module:afterResize:' + opts.id, null, opts);
    });

    self.$grid.on('grid:beforeResize', function (e, id) {
        self.sandbox.publish('module:beforeResize:' + id, null, null);
    });

    self.$grid.on('grid:resized', function () {
        self.sandbox.publish('grid:resized', null, null);
    });

    self.$grid.on('drag:drop', function(){
        if (!self.isFloater) {
            self.updateStore();
        }
    });

    self.$grid.on('mousewheel DOMMouseScroll', '.text-input-text, .module-scrollable', function (e) {
        //prevent from scrolling the whole page while scrolling the module
        var delta = e.wheelDelta || (e.originalEvent && e.originalEvent.wheelDelta) || -e.detail,
            bottomOverflow = this.scrollTop + $(this).outerHeight() - this.scrollHeight >= 0,
            topOverflow = this.scrollTop <= 0;

        if ((delta < 0 && bottomOverflow) || (delta > 0 && topOverflow)) {
            e.preventDefault();
        }
        e.stopPropagation();
    });

    self.$grid.on('mousewheel DOMMouseScroll', '.simple_grid_container', function (e) {
        e.preventDefault();
    });

    $(document).on('keydown', '.simple_grid_container', _.throttle(function (e) {
        var $target = $(e.target);
        if($target.hasClass('simple_grid_container')){
            var charCode = (typeof e.which == "number") ? e.which : e.keyCode;
            if(charCode === 35 || charCode === 36){
                //end or home
                var viewId = $target.attr('data-moduleid'), view = self.views[viewId];
                if(view.messageListView){
                    if(charCode === 36)
                        view.messageListView.scrollToTop();
                    else
                        view.messageListView.scrollToBottom();
                    e.preventDefault();
                }
            }
        }
    }, 200));
    this.startTrackActiveElement();
    this.registerTypingViewsThrottled = _.debounce(registerTypingViews, 250);

    this.sandbox.registerMethod('getActiveViewStreamId', this.getActiveViewStreamId.bind(this));
    this.sandbox.registerMethod('getActiveView', this.getActiveView.bind(this));
    this.sandbox.registerMethod('isFloatingWindow', function() {
        return self.isFloater;
    }, true);

    window.onbeforeunload = function (e) {
        if(self.core.opts.type === 'main') {
            //handles multiple views in a single floater
            Object.keys(self.floaters).forEach(function (floaterId) {
                self.appBridge.closeWindow({window: self.floaters[floaterId].floater});
            });
        }

        if(self.core.opts.type === 'widget' && self.core.opts.mainWidget) {
            localStorage.setItem('connectionExists', '0');
        }

        if(self.core.opts.type === 'floater') {
            //handles multiple views in a single floater
            var closingViewIds = [];
            Object.keys(self.views).forEach(function (viewId) {
                closingViewIds.push(viewId);
            });

            window.opener.postMessage({
                method: 'floaterClose',
                floaterId: self.core.opts.floaterId,
                viewIds: closingViewIds
            }, '*');
        }
    };
};

Layout.prototype.getTriggerViews = function () {
    return this.triggerViews;
};

Layout.prototype.startTrackActiveElement = function () {
    var self = this;

    function _dom_trackActiveElement(evt) {
        var activeView = self.getActiveView(evt),
            $target = $(evt.target);
        //if current view is not the one with focus, or even if current view has focus but the user click on the empty area which won't cause any action
        if (self.focusedViewId != activeView.viewId || $target.is("p") || $target.hasClass('messages-scroll') || $target.hasClass('text-input-text')) {
            // remove focus from the old view and add to the new
            if (self.focusedViewId) {
                var oldView = self.views[self.focusedViewId];
                if (oldView) {
                    oldView.$el.removeClass('focus-active');
                }
            }

            if (activeView) {
                //need to register to change first, then publish event, otherwise will cause infinite loop
                self.focusedStreamId = activeView.streamId;
                self.focusedViewId = activeView.viewId;

                if (self.views[activeView.viewId]) {
                    self.views[activeView.viewId].$el.addClass('focus-active');
                    self.sandbox.publish('view:focus:requested', null, {viewId: activeView.viewId});
                }

                self.sandbox.publish("view:focus:changed", null, {
                    streamId: activeView.streamId,
                    viewId: activeView.viewId
                });
            } else {
                self.sandbox.publish('view:focus:changed', null, {
                    streamId: null,
                    viewId: null
                });
            }
            console.log('active stream changed active=' + activeView.viewId);
        }
    }

    function onClick(evt){
        var $target = $(evt.target);

        if ($target.hasClass('no-focus') || window.getSelection().type === 'Range') {
            return;
        }

        _dom_trackActiveElement(evt);
    }
    if (document.addEventListener) {
        document.addEventListener("focus", _dom_trackActiveElement, true);
        document.addEventListener("click", onClick, true);
    }
};

Layout.prototype.defaultLayout = function () {
    var self = this;

    this.core.start('header', null, {viewId: 'header' }).render().postRender();
    this.core.start('leftnav', null, {viewId: 'leftnav'}).render().postRender();

    Q.all([this.sandbox.getData('documents.layout'), this.sandbox.getData('documents.apps.activeApps')]).spread(function(layoutRsp, activeAppsRsp){
            if(activeAppsRsp && Object.prototype.toString.call(activeAppsRsp) === '[object Array]' && activeAppsRsp.length && _.where(activeAppsRsp, {'runHeadless': true}).length) {

                self.headlessAfter = _.after(_.where(activeAppsRsp, {'runHeadless': true}).length, function(){self.headlessRendered.resolve()});

                _.each(activeAppsRsp, function (app) {
                    if (app.iFrame && app.runHeadless) {
                        self.addHeadless(_.extend(app,{'init': true}, {
                            isPinned: layoutRsp && layoutRsp['iFrameLoader'+app.appId] && layoutRsp['iFrameLoader'+app.appId].isPinned
                        }));
                    }
                });
            } else {
                self.headlessRendered.resolve();
            }

            self.headlessRendered.promise.then(function() {
                if(!_.isEmpty(layoutRsp)) {
                    _.each(layoutRsp, function(view){
                        if(view.col && view.row) {
                            self.sandbox.publish('view:show', null, _.extend(view, {init: true}));
                        }
                    });
                } else {
                    self.showFtue();
                }

                self.sandbox.publish('grid:ready', null, {}); //left nav listens, publish the nav size event, layout listens and calls resize to trigger the paint
            });

    });
};

Layout.prototype.widgetLayout = function(params) {
    var self = this;
    console.log(params);

    this.easyGrid.resize({
        offsetLeft: 0,
        offsetTop: 0
    });

    var methods = {
        chatroom: function() {

            var roomInfo = self.sandbox.send({
                id: 'GET_ROOM_MANAGER',
                payload: {
                    action: 'findrooms',
                    threadid: params.streamId
                }
            }).then(function(rsp){
                //got room info
                self.sandbox.getData('app.account.userName').then(function(userName){
                    if(rsp.result.userJoinDate === 0) {
                        self.sandbox.send({
                            id: 'GET_ROOM_MANAGER',
                            payload: {
                                action: 'adduser',
                                threadid: params.streamId,
                                userid: userName
                            }
                        }).then(function (rsp) {
                            //joined room
                            self.core.sandbox.publish('view:show', null, {
                                'streamId': params.streamId,
                                'module': params.module
                            });
                        }, function (rsp) {
                            //failed to join room
                            //todo show error
                        });
                    } else {
                        //user is arleady a memeber of this room, so just open it
                        self.core.sandbox.publish('view:show', null, {
                            'streamId': params.streamId,
                            'module': params.module
                        });
                    }
                }, function(rsp){
                    //failed to get user id... probably shouldnt ever happen
                });
            }, function(rsp){
                //failed to get room info
                //todo show error
            });
        },
        im: function(){
            utils.startChat({
                'sandbox': self.core.sandbox,
                'userId': [params.userId]
            }).then(function(rsp){
                console.log('good', rsp);
            }, function(rsp){
                console.log('bad', rsp);
            });
        },
        none: function() {
            throw new Error('Must supply a valid module parameter.');
        }
    };

    methods[methods.hasOwnProperty(params.module) ? params.module : 'none']();
};

Layout.prototype.addHeadless = function(app) {
    var self = this,
        viewId = 'iFrameLoader'+app.appId;

    this.headlessViews[viewId] = this.core.start('iFrameLoader', _.extend({
        viewId: viewId,
        init: app.init
    }, app));

    this.$grid.append(this.headlessViews[viewId].render().el);
    this.headlessViews[viewId].postRender();
};

Layout.prototype.removeHeadless = function(app) {
    var viewId = 'iFrameLoader'+app.appId;

    if (this.headlessViews[viewId].destroy && typeof this.headlessViews[viewId].destroy === 'function') {
        this.headlessViews[viewId].destroy();
    } else {
        this.headlessViews[viewId].remove();
        this.core.logger.warn('The module with viewId: ', viewId, ' was closed and did not have a .destroy() method.');
    }

    if(app.close) {
        this.sandbox.publish('view:close', null, {
            viewId: viewId
        });
    }
};

Layout.prototype.showFtue = function () {
    var filters = this.dataStore.get('app.account.filters'),
        myDept = _.find(filters, function (i) {
            return i.filterType === 'DEPT_FOLLOWING';
        }),
        orgLeaders = _.find(filters, function (i) {
            return i.filterType === 'LEADERSHIP_FOLLOWING';
        });


    this.sandbox.publish('view:show', null, {
        module: 'ftue',
        isPinned: true,
        init: true,
        row: 1,
        col: 1
    });

    if (myDept) {
        this.sandbox.publish('view:show', null, {
            module: 'my-department',
            streamId: myDept._id,
            isPinned: true,
            init: true,
            row: 3,
            col: 1
        });
    }

    if (orgLeaders) {
        this.sandbox.publish('view:show', null, {
            module: 'organizational-leaders',
            streamId: orgLeaders._id,
            isPinned: true,
            init: true,
            row: myDept ? 5 : 3,
            col: 1
        });
    }
};

Layout.prototype.init = function () {
    var self = this;

    self.easyGrid = new easyGrid(self.$grid, {
        'views':                this.views,
        'userDefinedLayout':    this.userDefinedLayout,
        'isFloater':            this.isFloater,
        'offsetLeft' :          0,
        'offsetTop'  :          this.isFloater ? 0 : 50, //leftnav will update w/ paint:true when ready, floaters are always 0 and 0,
        'symphony' :            this.core.opts
    });

    this.sandbox.subscribe('view:show', function (context, args) {
        if (args != null) {
            self.sandbox.publish("usage-event", null, {
                action: "SHOW_VIEW",
                details: {
                    module: args.module
                }
            });
        }
        self.show(args);
    });

    this.sandbox.subscribe('view:showfromfloat', function (context, args) {
        if(!$('body').hasClass('floater')) {
            self.show(args);
        }
    });

    this.sandbox.subscribe('view:close', function (context, args) {
        // TODO - investigate who isn't sending args
        if (args != null) {
            self.sandbox.publish("usage-event", null, {
                action: "CLOSE_VIEW",
                details: {
                    module: args.module
                }
            });
        }
        self.close(args);
    });

    this.sandbox.subscribe('view:pin', function (context, args) {
        if (args != null) {
            self.sandbox.publish("usage-event", null, {
                action: "PIN_VIEW",
                details: {
                    module: args.module
                }
            });
        }
        self.pin(args);
    });

    this.sandbox.subscribe('view:unfloat', function (context, args) {
        self.unfloat(args);
    });

    this.sandbox.subscribe('view:float', function (context, args) {
        if (args != null) {
            self.sandbox.publish("usage-event", null, {
                action: "FLOAT_VIEW",
                details: {
                    module: args.module
                }
            });
        }
        self.float(args);
    });

    this.sandbox.subscribe('view:headless', function (context, args) {
        if (args != null) {
            self.sandbox.publish("usage-event", null, {
                action: "HEADLESS_VIEW",
                details: {
                    module: args.module
                }
            });
        }
        self.viewHeadless(args);
    });

    this.sandbox.subscribe('bodyStyle', function (context, args) {
        if (utils.updateBodyStyle.hasOwnProperty(args.method) && typeof utils.updateBodyStyle[args.method] === 'function') {
            utils.updateBodyStyle[args.method](args.choice);
        }
    });

    this.sandbox.subscribe('leftnav:resized', function (context, args) {
        self.easyGrid.resize({
            offsetLeft: args.navWidth,
            skipPaint: args.skipPaint
        });
    });

    this.sandbox.subscribe('incoming:message', function(context, args) {
        if(args.isChime && !args.historical) {
            self.chimeQueue.push(args);
            self.chime();
        }
    });
    this.sandbox.subscribe('headless:add', function(context, args){
        self.addHeadless(args);
    });

    this.sandbox.subscribe('headless:remove', function(context, args){
        self.removeHeadless(args);
    });

    this.sandbox.subscribe('iframe:rendered', function(context, args){
        var iFrame = $('.app-window.'+args.appId);
        if(iFrame.length) {
            self.iFrameReferences[args.appId] = iFrame[0].contentWindow;
        }
        if(!args.init) {
            self.sandbox.publish('view:show', null, args);
        }
        if(self.headlessAfter && typeof self.headlessAfter === 'function') {
            self.headlessAfter();
        }
    });

    this.sandbox.subscribe('iframe:remove', function(context, args){
        delete self.iFrameReferences[args.appId];
    });
};

Layout.prototype.unfloat = function (args) {
    this.appBridge.closeWindow({window: this.floaters[args.floaterId].floater});
    delete this.floaters[args.floaterId];

    this.sandbox.publish('view:show', null, _.extend({}, _.omit(args, 'viewId')));
};

/**
 * @desc: generate a view and render it
 * @param: args : {'streamId': threadId or filterId or whatever specify a stream, 'module': prototype of the view}
 * @param: init : bool, appends the view outside of main, used for switching modes
 **/
Layout.prototype.show = function (args) {
    console.log(args);
    if(this.isFloater && Object.keys(this.views).length === 1) {
        this.sandbox.publish('view:showfromfloat', null, args);
        return;
    }

    var self = this,
        viewId = null,
        isPinned = !!args.isPinned,
        replaceRow = null,
        replaceCol = null,
        replaceView = null,
        currentlyUnpinned = _.findWhere(this.views, {'isPinned':false});

    if(currentlyUnpinned) {
        replaceView =  currentlyUnpinned;
        replaceCol = currentlyUnpinned.col-1;
        replaceRow = currentlyUnpinned.row;
    }

    if(args.replace) { //this could override the above if statement
        replaceView =  _.findWhere(this.views, {'streamId':args.replace});
        replaceCol = replaceView.col-1;
        replaceRow = replaceView.row;
    }

    if(args.viewId) {
        viewId = args.viewId;
    } else {
        if(args.module === 'profile') {
            //userId is used as the unqiue identifier
            viewId = args.module + args.userId;
        }
        if(args.streamId) {
            //streamId is used as the unqiue identifier
            viewId = args.module + args.streamId;
        }

        if(_.contains(self.staticViews, args.module)) {
            viewId = args.module;
        }

        //hashtag-context + hashtag is no longer a valid unique identifier for
        //hashtag context views once non-alphanumeric characters are stripped.
        //therefore, they are given a generic view ID.
        if(!viewId) {
            //otherwise we increment a counter. This allows something like search to be opened multiple times
            self.moduleInc = self.moduleInc+1;
            if(this.views[args.module + self.moduleInc]) {
                //handle cases where layout data has been saved to server. ie module0, so go forward to module1
                while(this.views[args.module + self.moduleInc]) {
                    self.moduleInc++;
                }
                viewId = args.module + self.moduleInc;
            } else {
                viewId = args.module + self.moduleInc;
            }
        }
    }

    if (!args.module) {
        this.logger.error('You must supply a module name.');
    }

    if (!this.core.modules[args.module]) {
        this.logger.error('Error in Layout.prototype.show: ', args.module, ' doesn\'t exist');
        return;
    }

    //if the view already exist in current window
    if (this.views[viewId]) {
        this.sandbox.publish('view:focus:requested', null, _.extend({viewId: viewId}, args));
        this.sandbox.publish('view:existing', null, _.extend({viewId: viewId}, args));
        return;
    }

    //if the view already exist in pop-up window
    for (var floater in this.floaters) {
        if (this.floaters.hasOwnProperty(floater)) {
            if (this.floaters[floater].viewId === viewId) { //for now floaters only have a single view
                this.sandbox.publish('view:focus:requested', null, _.extend({viewId: viewId}, args));
                this.sandbox.publish('view:existing', null, _.extend({viewId: viewId}, args));
                this.appBridge.activateWindow('window'+floater, true);
                return;
            }
        }
    }

    var moduleArgs = _.extend({'viewId': viewId}, args),
        runHeadless;

    self.userDefinedLayout[viewId] = {
        row: typeof args.row === 'number' ? args.row : undefined,
        col: typeof args.col === 'number' ? args.col : undefined
    };

    if(args.module === 'iFrameLoader' && this.headlessViews.hasOwnProperty(viewId)) {
        self.views[viewId] = this.headlessViews[viewId];
        runHeadless = true;
    } else {
        self.views[viewId] = self.core.start(args.module, moduleArgs);
    }

    self.easyGrid.insert({
        'viewId': viewId,
        'elem': runHeadless ? self.views[viewId].$el : self.views[viewId].render().el,
        'isPinned': isPinned,
        'init': args.init,
        'col': replaceView ? replaceCol : args.col,
        'row': replaceView ? replaceRow : args.row,
        'skipPaint': replaceView,
        'runHeadless': runHeadless
    });

    if (replaceView) {
        self.close(self.views[replaceView.viewId], false);
        if (!self.isFloater) {
            self.sandbox.publish('view:close', null, {viewId: replaceView.viewId});
        }
    }

    if (!args.init && !self.isFloater) {
        self.updateStore();
    }

    if (self.views[viewId].postRender && typeof self.views[viewId].postRender === 'function') {
        self.views[viewId].postRender();
    }

    if(this.isFloater) {
        this.easyGrid.resize(); //floater only shows 1 view, so trigger paint()
    }

    self.registerTypingViewsThrottled();
    self.registerTriggerViews();
};

Layout.prototype.pin = function (viewId) {
    this.views[viewId].isPinned = true;
    this.easyGrid.pin(viewId);

    if (!this.isFloater) {
        this.updateStore();
    }
};

Layout.prototype.float = function (viewId) {
    var self = this,
        floatCount = ++this.sandbox.availFloaterId,
        streamId = this.views[viewId].threadId || this.views[viewId].filterId || this.views[viewId].streamId,
        moduleType = this.views[viewId].module;

    var viewToFloat = this.views[viewId], viewData;
    if (!viewToFloat) {
        this.logger.error('Error in Layout.prototype.float: ', viewId, ' doesn\'t exist');
        return;
    }
    if (viewToFloat.exportJson && typeof viewToFloat.exportJson === 'function') {
        viewData = _.omit(viewToFloat.exportJson(), 'init', 'viewId');
    } else {
        viewData = _.extend({}, {
            module: moduleType,
            streamId: streamId
        });
    }

    delete viewData.col;
    delete viewData.row;

    var $view = $('#simple_grid').children('[data-viewid="' + viewId + '"]'),
        height = $view.height(),
        width = $view.width(),
        windowName = 'window'+floatCount;

    this.close(viewId);

    //the CEF container window.open dimensions include the chrome/title bar... so add in the extra width/height here.
    height = height + 60;
    width = width + 40;

    this.floaters[floatCount] = {
        floater: window.open(
                'float.html?floaterId=' + floatCount,
            windowName,
                'chrome=yes,width=' + width + ',height=' + height + ',centerscreen=yes,menubar=no,toolbar=no,location=no,status=no,scrollbars=no,resizable=yes,titlebar=no'
        ),
        floaterReady: Q.defer(),
        viewId: viewId,
        streamId: streamId,
        lastHeartBeat: new Date().getTime(),
        module: moduleType
    };

    this.floaters[floatCount].floaterReady.promise.then(function () {
        //now postMessage to window what to open
        console.log('VD: ', viewData);
        self.floaters[floatCount].floater.postMessage({
            'method': 'pubsub',
            'data': ['view:show', null, viewData]
        }, "*");
        //set min width and bring floating window to foreground
        if(self.appBridge.isRunningInClientApp()){
            self.appBridge.setMinWidth(windowName, 300);
            self.appBridge.activateWindow(windowName, true);
        }
        self.sandbox.publish('view:floated', null, floatCount);
        self.sandbox.publish('view:focus:requested', null, _.extend({viewId: viewId}, viewData));
    });

    this.registerTriggerViews();
};

Layout.prototype.viewHeadless = function (opts) {
    console.log('layout viewHeadless:', opts);

    if (typeof opts.contentView === 'string') {
        opts.contentView = this.core.start(opts.contentView);
    }

    // TODO - do I also need to destroy it? OF COURSE YOU DO. But views need to handle this themselves. - matt
};

Layout.prototype.close = function (opts, skipPaint) {
    var viewId = typeof opts === "string" ? opts : opts.viewId;

    if (!this.views[viewId]) {
        return;
    }

    if(this.views[viewId].opts && this.views[viewId].opts.iFrame && this.views[viewId].opts.runHeadless) {
        this.easyGrid.close({
            viewId: viewId,
            skipPaint: skipPaint,
            runHeadless: true
        });

        //awkward/hackish below
        this.headlessViews[viewId].pinned = false;
        delete this.headlessViews[viewId].col;
        delete this.headlessViews[viewId].row;

    } else {
    if (this.views[viewId].destroy && typeof this.views[viewId].destroy === 'function') {
        this.views[viewId].destroy();
    } else {
        this.views[viewId].remove();
        this.logger.warn('The module with viewId: ', viewId, ' was closed and did not have a .destroy() method.');
    }
    if (this.views[viewId].streamId) {
        this.sandbox.deleteMessagesByStream(this.views[viewId].streamId);
    }
        this.easyGrid.close({
            viewId: viewId,
            skipPaint: skipPaint
        });
    }

    if (!this.isFloater) {
        this.updateStore();
    }
    if (this.isFloater) {
        //window.close will cause the ghost window keep posting heart beat
        //call onbeforeunload so that the main window will receive floaterClose message and use appBridge to close the window correctly
        window.onbeforeunload();
    }

    this.registerTypingViewsThrottled();
    this.registerTriggerViews();
};

Layout.prototype.getActiveViewStreamId = function () {
    //return this.getActiveView.apply(this).streamId;
    return this.focusedStreamId;
};

Layout.prototype.getActiveView = function (evt) {
    var target = evt && evt.target ? evt.target : document.activeElement;

    var view = $(target).closest('div[data-viewid]'), viewId = null, streamId = null;

    if (view.length != 0) {
        var attr = $(view).attr('data-viewid');
        if (this.views[attr] && this.views[attr].opts) {
            viewId = attr;
            streamId = this.views[attr].opts.streamId;
        }
    }

    return {
        viewId: viewId,
        streamId: streamId
    };

};

Layout.prototype.getOptionsForView = function (id) {
    var view = this.views[id];

    if (view) {
        return view.exportJson();
    }
};

Layout.prototype.registerTriggerViews = function () {
    var self = this,
        updatedTriggerViews = {};

    Object.keys(this.views).forEach(function (view) {
        var currentView = this.views[view];
        if ((currentView.module === 'chatroom' || currentView.module === 'im'
            || currentView.module === 'filter' || currentView.module === 'profile') && currentView.streamId) {
            updatedTriggerViews[currentView.streamId] = true;
        }
    }, this);

    Object.keys(this.floaters).forEach(function (floater) {
        var currentFloat = this.floaters[floater];
        if ((currentFloat.module === 'chatroom' || currentFloat.module === 'im'
            || currentFloat.module === 'filter' || currentFloat.module === 'profile') && currentFloat.streamId) {
            updatedTriggerViews[currentFloat.streamId] = true;
        }
    }, this);

    self.triggerViews = updatedTriggerViews;
};

Layout.prototype.chime = function() {
    if(this.isChiming) {
        setTimeout(_.bind(this.chime, this), 500);
        return;
    }

    if(!this.chimeQueue) {
        return; //this logic isnt really needed
    }

    this.isChiming = true;

    var self = this,
        chime = new chimeView({
            msg: this.chimeQueue[0],
            sandbox: this.sandbox
        });

    if(this.chimeQueue[0].from.id !== this.dataStore.get('app.account.userName')) {
        this.$chime.append(chime.render().el);
    }

    this.$chimeAudio[0].play();
    //this.appBridge.playChime();

    setTimeout(function(){
        self.chimeQueue.shift();
        chime.expire();
        self.isChiming = false;
    }, 2000);
};

Layout.prototype.updateStore = function() {
    if(this.core.opts.type === 'widget') {
        return;
    }

    var store = {},
        self = this;

    this.easyGrid.updateUserDefinedLayout();

    _.each(this.views, function(view) {
        store[view.viewId] = _.extend({}, self.getOptionsForView(view.viewId), {
            col:    self.userDefinedLayout[view.viewId].col,
            row:    self.userDefinedLayout[view.viewId].row
        });
    });

    console.log('persist: ', store);
    this.dataStore.upsert('documents.layout', store);
};

module.exports = Layout;
