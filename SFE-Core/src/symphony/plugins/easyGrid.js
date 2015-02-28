var _ = require('underscore');

var EasyGrid = function(elem, opts) {
    var self = this;

    if(!opts.views || !opts.userDefinedLayout) {
        throw new Error('easyGrid requires view and userDefinedLayout objects.')
    }

    self.minWidth = opts.minWidth || 300;
    self.offsetLeft = opts.offsetLeft || 0;
    self.offsetTop = opts.offsetTop || 0;
    self.isFloater = opts.isFloater;
    self.symphony = opts.symphony;

    self.width = 0;
    self.height = 0;
    self.rowCount = 0;
    self.rowHeight = 0;

    self.$placeholder = $('#simple-grid-placeholder'); //not a good idea
    self.views = opts.views;
    self.$elem = elem;
    self.radius = 100;
    self.gutter = 10;
    self.tokens = [];
    self.$tokens = null;
    self.allowedTokens = [];
    self.activeToken = null;
    self.scrollTop = 0;
    self.userDefinedLayout = opts.userDefinedLayout; ///updated on open/close/pin/rearrange, and NOT on resize

    if(self.symphony.type !== 'widget') {
        self.$elem.on('mousedown dragstart', '.gs-draggable', function(e){
            e.preventDefault();
            var moduleId = $(e.currentTarget).parents('.simple_grid_container').attr('data-viewid');
            self.handleDrag(moduleId, e);
        }).on('mousedown dragstart', '.module-header *', function(e){
            e.stopPropagation();
        });
    }


    $(window).resize(_.debounce(function(e){
        //the resize caused by textinput doesn't affect the grid.
        if($(e.target).hasClass('chatroom-compose')) {
            return;
        }

        self.resize({});

        //if there is textarea has focus, give it focus again (for char count plugin, we rely on focus event to re-calculate the position)
        setTimeout(function(){
            $('div.text-input-text:focus').focus();
        }, 200);
    }, 250));


    $(document).on('keydown', function(e){
        //since we set focus on grid container, messages-scroll won't get keydown event, therefore we need to bind event on document
        var $target = $(e.target);
        if($target.hasClass('simple_grid_container')){
            var $scrollArea = $target.find('.messages-scroll'), top;
            if (e.which === 40) {//down arrow
                top = $scrollArea.scrollTop() + 20;
            } else if (e.which === 38) {//up arrow
                top = $scrollArea.scrollTop() - 20;
            }
            $scrollArea.scrollTop(top);
        }
    });

    self.$elem.on('scroll', function(){
        self.scrollTop = self.$elem.scrollTop();
    });
};

/**
 * @param {object} oldGrid The old grid information youd like to convert
 * Convert the old grid data, corrupted or not, to the new easyGrid standard. EasyGrid
 * used odd numbers only (with events reserved for placement tokens). This will shift all
 * data to start at zero, and increment by one.
 * @returns {object}
 */
EasyGrid.prototype.normalizeGridData = function(oldGrid) {
    var oldRowSet = _.chain(oldGrid).pluck('row').unique().value(),
        normalizedGrid = {};

    _.each(oldGrid, function(view){
        if(!view.col || !view.row) {
            delete oldGrid[view.viewId];
        }
    });

    _.each(oldRowSet, function(currentRow, i) { //iterate over the set of old rows
        var colIndex = 0;

        _.chain(oldGrid)
            .where({'row': currentRow})
            .sortBy(function(view){return view.col})
            .each(function(view){
                normalizedGrid[view.viewId] = _.extend({}, view, {
                    row: view.row,
                    col: (colIndex*2)+1,
                    isPinned: true
                });
                delete normalizedGrid[view.viewId].pinned;
                delete normalizedGrid[view.viewId].init;
                colIndex++;
            });
    });
    return normalizedGrid;
};

/**
 * @param {int} opts.offsetLeft Left offset of the grid
 * @param {int} opts.offsetTop Top offset of the grid
 * @param {bool} opts.skipPaint Pass true to avoid the paint operation
 * This method resizes the grid data, and optionally repaints the grid.
 */
EasyGrid.prototype.resize = function(opts) {
    var gutterWidth = 0,
        i = 0;

    opts = opts || {};

    this.maxColumns = 0;
    this.offsetLeft = typeof opts.offsetLeft === 'number' ? opts.offsetLeft : this.offsetLeft;
    this.offsetTop = typeof opts.offsetTop === 'number' ? opts.offsetTop : this.offsetTop;
    this.width = window.innerWidth - this.offsetLeft;
    this.height = window.innerHeight - this.offsetTop;

    while(!this.maxColumns) {
        i++;
        gutterWidth = this.gutter+(this.gutter*i);
        if((this.width-gutterWidth)/i < 300) {
            this.maxColumns = i-1;
        }
    }

    if(!opts.skipPaint) {
        this.$elem.css({
            'width' : this.width,
            'height': this.height,
            'left'  : this.offsetLeft,
            'top'   : this.offsetTop
        });

        this.waterfallViews();
    }
};

/**
 * Get all the grid data regarding the sole unpinned panel
 * @returns {object}
 */
EasyGrid.prototype.getDataForUnpinnedView = function() {
    return _.findWhere(this.views, {'unpinned': true});
};

/**
 * Get all the grid data for the supplied viewId
 * @returns {object}
 */
EasyGrid.prototype.getDataForView = function(viewId) {
    return _.findWhere(this.views, {'viewId': viewId});
};

/**
 * Paint the grid, this updates the CSS for all panels
 */
EasyGrid.prototype.paintPanels = function() {
    if(!Object.keys(this.views).length) {
        return;
    }

    var self = this,
        rowViews = null,
        rowCount = 0;

    for (var view in this.views) {
        if (this.views.hasOwnProperty(view)) {
            rowCount = this.views[view].row > rowCount ? this.views[view].row : rowCount;
        }
    }

    rowCount = (rowCount+1)/2;

    this.rowCount = rowCount;

    var rowHeight = Math.round((this.height - ((this.rowCount + 1) * this.gutter)) / this.rowCount);

    this.rowHeight = rowHeight < 300 ? 300 : rowHeight; //minimum row height is 300px

    for(var i = 0; i < rowCount; i++) {
        rowViews = _.where(this.views, {'row': (i*2)+1});

        if(!rowViews.length) {
            return;
        }

        var colWidth = Math.floor((this.width - (rowViews.length+1) * this.gutter)/rowViews.length),
            row = rowViews[0].row;

        for(var j = 0; j < rowViews.length; j++) {
            var column = (this.views[rowViews[j].viewId].col-1)/2,
                left = Math.round((colWidth * column) + (this.gutter * (column + 1))),
                top = Math.round((this.rowHeight * ((row-1)/2)) + (this.gutter * ( (row+1)/2))),
                widthClass = null;

            if(colWidth <= 350){
                widthClass = 'simple-jack-tiny';
            }
            else if (colWidth > 350 && colWidth < 430) {
                widthClass = 'simple-jack-small';
            }
            else if(colWidth > 430 && colWidth < 631){
                widthClass = 'simple-jack-medium';
            }
            else {
                widthClass = 'simple-jack-large';
            }

            this.$elem.trigger('grid:beforeResize', rowViews[j].viewId);

            $('#'+rowViews[j].htmlId)
                .css({
                    'width'     : colWidth,
                    'height'    : self.rowHeight,
                    'left'      : left,
                    'top'       : top
                })
                .removeClass('simple-jack-tiny simple-jack-small simple-jack-medium simple-jack-large')
                .addClass(widthClass);

            this.$elem.trigger('grid:afterResize', {
                'id'    : rowViews[j].viewId,
                'width' : colWidth
            });
        }
    }

    this.$elem.trigger('grid:resized', {});

    setTimeout(self.paintTokens(), 300);
};

/**
 * Paint the tokens that indicate viable drop locations. We'll call this shortly
 * after the regular paint fn to spread out the executions
 */
EasyGrid.prototype.paintTokens = function() {
    var docFrag = document.createDocumentFragment(),
        tokenDiv = document.getElementById('simple-tokens'),
        token = null,
        tokenId = 0,
        rowViews = null;

    this.tokens.length = 0;

    for(var i = 0; i < this.rowCount; i++) {
        rowViews = _.where(this.views, {'row': (i*2)+1});

        if(!rowViews.length) {
            return;
        }

        token = document.createElement('div');
        token.setAttribute('class', 'grid-token grid-token-horizontal');
        token.setAttribute('style', 'top:'+((this.rowHeight*(i+1))+(this.gutter*(i+1))+4)+'px;width:'+(this.width-30)+'px; left:15px;');
        token.setAttribute('id', 'token'+(++tokenId));
        docFrag.appendChild(token);

        this.tokens.push({  //add bottom tokens to all rows
            'x1'        : -(this.radius),
            'y1'        : (this.rowHeight*(i+1))+(this.gutter*(i+1))-(this.radius),
            'x2'        : this.width+(this.radius),
            'y2'        : (this.rowHeight*(i+1))+(this.gutter*(i+1))+(this.radius),
            'row'       : (i*2)+2,
            'col'       : 0,
            'tokenId'   : 'token'+tokenId
        });

        var colWidth = Math.floor((this.width - (rowViews.length+1) * this.gutter)/rowViews.length),
            row = rowViews[0].row;

        colWidth = colWidth < this.minWidth ? this.minWidth : colWidth;

        for(var j = 0; j < rowViews.length; j++) {
            var column = (this.views[rowViews[j].viewId].col-1)/2,
                left = Math.round((colWidth * column) + (this.gutter * (column + 1))),
                top = Math.round((this.rowHeight * ((row-1)/2)) + (this.gutter * ( (row+1)/2)));

            token = document.createElement('div');
            token.setAttribute('class', 'grid-token grid-token-vertical');
            token.setAttribute('style', 'top:'+(top+5)+'px;left:'+(left+colWidth+4)+'px;height:'+(this.rowHeight-this.gutter)+'px');
            token.setAttribute('id', 'token'+(++tokenId));
            docFrag.appendChild(token);

            this.tokens.push({ //add right tokens to everyone
                'x1'        : left+colWidth-(this.radius),
                'y1'        : top-(this.radius),
                'x2'        : left+colWidth+(this.radius),
                'y2'        : top+this.rowHeight+(this.radius),
                'row'       : row,
                'col'       : this.views[rowViews[j].viewId].col+1,
                'tokenId'   : 'token'+tokenId
            });

            if(column === 0) {
                token = document.createElement('div');
                token.setAttribute('class', 'grid-token grid-token-vertical');
                token.setAttribute('style', 'top:'+(top+5)+'px;left:'+(left-5)+'px;height:'+(this.rowHeight-this.gutter)+'px');
                token.setAttribute('id', 'token'+(++tokenId));
                docFrag.appendChild(token);

                this.tokens.push({  //add left tokens to the first column
                    'x1'        : -(this.radius),
                    'y1'        : top-(this.radius),
                    'x2'        : (this.radius),
                    'y2'        : top+this.rowHeight+(this.radius),
                    'row'       : row,
                    'col'       : 0,
                    'tokenId'   : 'token'+tokenId
                });
            }
        }
    }

    token = document.createElement('div');
    token.setAttribute('class', 'grid-token grid-token-horizontal');
    token.setAttribute('style', 'top:5px;width:'+(this.width-30)+'px;left:15px;');
    token.setAttribute('id', 'token'+(++tokenId));
    docFrag.appendChild(token);

    this.tokens.push({ //add the top token to top row
        'x1'    : -(this.radius),
        'y1'    : -(this.radius),
        'x2'    : this.width+(this.radius),
        'y2'    : (this.radius),
        'row'   : 0,
        'col'   : 0,
        'tokenId'   : 'token'+tokenId
    });

    while (tokenDiv.firstChild) {
        tokenDiv.removeChild(tokenDiv.firstChild);
    }

    tokenDiv.appendChild(docFrag);
    this.$tokens = $('#simple-tokens').children();
};

/**
 * @param {object} params
 *
 */
EasyGrid.prototype.insert = function(params) {
    var opts = params || {},
        $view = $('<div></div>', {
            'class' : 'simple_grid_container simple_grid_main_container',
            'id'    : opts.htmlId
        });

    if(!opts.viewId || !opts.elem || _.isUndefined(opts.isPinned)) {
        return;
    }

    opts.htmlId = opts.viewId.replace(/[^A-Za-z-_0-9]/g, "");

    if(this.symphony.type === 'widget') {
        this.$elem.prepend($view.html(opts.elem)
            .attr({
                'id': opts.htmlId,
                'data-viewid' : opts.viewId
            })
            .addClass('simple-grid-widget')
        );

        return;
    }

    if(opts.runHeadless) {
        opts.elem.css({'display': ''});
    } else {
    this.$elem.prepend($view.html(opts.elem).attr({
        'id': opts.htmlId,
        'data-viewid' : opts.viewId
    }));
    }

    if(opts.init) {
        this.views[opts.viewId].col = opts.col;
        this.views[opts.viewId].row = opts.row;
        this.views[opts.viewId].htmlId = opts.htmlId;

        if(opts.isPinned) {
            $view.removeClass('simple_grid_main_container');
        }
        return;
    }

    if(opts.isPinned) {
        this.adjust({
            'row': opts.row || 0,
            'col': opts.col || 0,
            'opts': opts,
            'skipPaint': opts.init || opts.skipPaint
        });
    } else if(typeof opts.row === "number" && typeof opts.col === "number") {
        this.adjust({
            'row': opts.row,
            'col': opts.col,
            'opts': opts,
            'skipPaint': opts.init || opts.skipPaint
        });
    } else {
        this.adjust({
            'row':  _.where(this.views, {'row':1}).length === this.maxColumns ? 0 : 1,
            'col': 0,
            'opts': opts,
            'skipPaint': opts.init || opts.skipPaint
        });
    }
};

EasyGrid.prototype.insertHeadless = function(params) {

};

/**
 * @param {string} viewId The view ID of the item to be pinned.
 *
 */
EasyGrid.prototype.pin = function(viewId) {
    $('#'+this.views[viewId].htmlId).removeClass('simple_grid_main_container');
};

/**
 * Update the coordinates of all impacted views (when adding a new view)
 */
EasyGrid.prototype.adjust = function(params) {
    //assumes valid position data
    var oldRow = [],
        oldRowNum = null;

    //handle the old row
    if(this.views[params.opts.viewId] && this.views[params.opts.viewId].row && this.views[params.opts.viewId].col) {
        oldRow = _.where(this.views, {'row': this.views[params.opts.viewId].row});
        oldRowNum = this.views[params.opts.viewId].row;

        if(params.row === this.views[params.opts.viewId].row) {
            //its being moved within the same row
            if(params.col < this.views[params.opts.viewId].col) { //to the left
                for(var i = 0, len = oldRow.length; i < len; i++) {
                    if(oldRow[i].col > params.col && oldRow[i].col < this.views[params.opts.viewId].col) {
                        this.views[oldRow[i].viewId].col = this.views[oldRow[i].viewId].col + 2;
                    }
                }
            } else { //to the right
                for(var i = 0, len = oldRow.length; i < len; i++) {
                    if(oldRow[i].col < params.col && oldRow[i].col > this.views[params.opts.viewId].col) {
                        this.views[oldRow[i].viewId].col = this.views[oldRow[i].viewId].col - 2;
                    }
                }
            }


            this.views[params.opts.viewId].viewId    = params.opts.viewId;
            this.views[params.opts.viewId].htmlId    = params.opts.htmlId;
            this.views[params.opts.viewId].col       = params.col < this.views[params.opts.viewId].col ? params.col+1 : params.col-1;
            this.views[params.opts.viewId].row       = params.row; //guaranteed to be an odd number (existing views)
            this.views[params.opts.viewId].isPinned  = params.opts.isPinned || false;

            this.paintPanels();
            return;
        }

        //frameshift to the left by 2 if necessary
        for(var i = 0, len = oldRow.length; i < len; i++) {
            if(this.views[oldRow[i].viewId].col > this.views[params.opts.viewId].col) {
                this.views[oldRow[i].viewId].col = this.views[oldRow[i].viewId].col - 2;
            }
        }
    }

    if(params.row % 2 === 0) {
        //creating a new row
        for(var view in this.views) {
            if(this.views.hasOwnProperty(view)) {
                var rowNumber = this.views[view].row;
                if(rowNumber > params.row) {
                    this.views[view].row = this.views[view].row+2;
                }
            }
        }

        this.views[params.opts.viewId].viewId    = params.opts.viewId;
        this.views[params.opts.viewId].htmlId    = params.opts.htmlId;
        this.views[params.opts.viewId].col       = 1;
        this.views[params.opts.viewId].row       = params.row+1;
        this.views[params.opts.viewId].isPinned    = params.opts.isPinned || false;

    } else {
        //inject into existing different row
        //frame shift everything to the right in the new row
        var effectedViews = _.where(this.views, {'row': params.row});
        for(var i = 0, len = effectedViews.length; i < len; i++) {
            if(this.views[effectedViews[i].viewId].col > params.col) {
                this.views[effectedViews[i].viewId].col = this.views[effectedViews[i].viewId].col+2;
            }
        }

        this.views[params.opts.viewId].viewId    = params.opts.viewId;
        this.views[params.opts.viewId].htmlId    = params.opts.htmlId;
        this.views[params.opts.viewId].col       = params.col+1;
        this.views[params.opts.viewId].row       = params.row; //guaranteed to be an odd number (existing views)
        this.views[params.opts.viewId].isPinned    = params.opts.isPinned || false;
    }

    if(oldRowNum && oldRow.length === 1) {
        //since we removed a row, move everything thats below up to take its place
        for(var view in this.views) {
            if(this.views.hasOwnProperty(view)) {
                if(this.views[view].row > oldRowNum) {
                    this.views[view].row = this.views[view].row - 2;
                }
            }
        }
    }
    if(!params.skipPaint) {
        this.paintPanels();
    }
};

/**
 *
 */
EasyGrid.prototype.close = function(opts) {
    var opts = opts || {};
    if(opts.runHeadless) {
        $('#'+this.views[opts.viewId].htmlId).css({'display': 'none'});
    } else {
        $('#'+this.views[opts.viewId].htmlId).remove();
    }

    var effectedRow = this.views[opts.viewId].row,
        frameshiftStart = this.views[opts.viewId].col;

    delete this.views[opts.viewId];

    var effectedViews = _.where(this.views, {'row': effectedRow});

    for(var i = 0, len = effectedViews.length; i < len; i++) {
        if(this.views[effectedViews[i].viewId].col >= frameshiftStart) {
            this.views[effectedViews[i].viewId].col = this.views[effectedViews[i].viewId].col-2;
        }
    }

    if(effectedViews.length === 0) {
        //shift all the below rows up one row
        for(var view in this.views) {
            if(this.views.hasOwnProperty(view)) {
                if(this.views[view].row > effectedRow) {
                    this.views[view].row = this.views[view].row-2;
                }
            }
        }
    }
    if(!opts.skipPaint) {
        this.paintPanels();
    }
};

EasyGrid.prototype.handleMousemove = function(e) {
    var left = this.lastLeft-(this.lastX - e.pageX),
        top = this.lastTop-(this.lastY - e.pageY);

    this.$placeholder.css({
        left: left,
        top: top
    });

    this.lastX = e.pageX;
    this.lastY = e.pageY;
    this.lastLeft = left;
    this.lastTop = top;

    this.findNearestToken();
};

EasyGrid.prototype.findNearestToken = _.throttle(function() {
    var mouseX = this.lastX-this.offsetLeft,
        mouseY = this.lastY-this.offsetTop+this.scrollTop;

    this.activeToken = null;

    for(var i = 0, len = this.allowedTokens.length; i < len; i++) {
        if(
            mouseX >= this.allowedTokens[i].x1 &&
            mouseX <= this.allowedTokens[i].x2 &&
            mouseY >= this.allowedTokens[i].y1 &&
            mouseY <= this.allowedTokens[i].y2) {
            this.activeToken = this.allowedTokens[i];
            break;
        }
    }

    this.$tokens.removeClass('token-active');

    if(this.activeToken) {
        $('#'+this.activeToken.tokenId).addClass('token-active');
    }
}, 200);

EasyGrid.prototype.handleMouseUp = function(e) {
    $(document).off('mouseup', this.handleMouseUp);
    $(document).off('mousemove', this.handleMousemove);

    this.$elem.css('overflow', ''); //removes the inline style
    this.$placeholder.addClass('hidden');

    if(this.activeToken) {
        this.adjust({
            'row': this.activeToken.row,
            'col': this.activeToken.col,
            'opts': this.views[e.data.viewId]
        });
    } else {
        $('#simple-tokens').children().removeClass('token-allowed token-active');
    }

    this.$elem.trigger('drag:drop', true);
};

EasyGrid.prototype.handleDrag = function(viewId, e) {
    var view = this.views[viewId],
        rowItems = _.where(this.views, {'row': view.row}).length,
        colWidth = Math.floor((this.width - (rowItems+1) * this.gutter)/rowItems),
        row = this.views[viewId].row,
        column = (this.views[viewId].col-1)/2,
        columnTrue = this.views[viewId].col,
        left = Math.round((colWidth * column) + (this.gutter * (column + 1))),
        top = Math.round((this.rowHeight * ((row-1)/2)) + (this.gutter * ( (row+1)/2)));

    this.$elem.css('overflow', 'hidden');
    this.$placeholder.removeClass('hidden').css({
        height: this.rowHeight,
        width: colWidth,
        left: left,
        top : top
    });

    this.lastX = e.pageX;
    this.lastY = e.pageY;
    this.lastLeft = left;
    this.lastTop = top;
    this.allowedTokens.length = 0;
    this.activeToken = null;

    for(var i = 0, len = this.tokens.length; i < len; i++) {
        /*
         1. if its the only one on the row, the left and right cols arent allowed
         2. if its the only one on the row, the above and below rows arent allowed
         3. the left and right are never allowed
         */

        if(this.tokens[i].row === row && (this.tokens[i].col === columnTrue-1 || this.tokens[i].col === columnTrue+1)) {
            continue;
        }

        if(rowItems === 1) {
            if(this.tokens[i].row === row-1 || this.tokens[i].row === row+1) {
                continue;
            }
        }

        var tokensInRow = _.where(this.tokens, {'row': this.tokens[i].row});

        if(tokensInRow.length > 1 && this.tokens[i].row !== row) { //todo we could make this way more performant
            var gutterWidth = this.gutter+(this.gutter*tokensInRow.length);
            if((this.width-gutterWidth)/tokensInRow.length < 300) {
                continue;
            }
        }

        this.allowedTokens.push(this.tokens[i]);
    }

    for(var j = 0, len = this.allowedTokens.length; j < len; j++) {
        $('#'+this.allowedTokens[j].tokenId).addClass('token-allowed');
    }

    $(document).on('mousemove', {viewId: viewId}, $.proxy(this.handleMousemove, this));
    $(document).on('mouseup', {viewId: viewId}, $.proxy(this.handleMouseUp, this));
};

EasyGrid.prototype.waterfallViews = function() {
    var rowCount = 0;

    if(!this.isFloater) {
        _.each(this.views, function(view){
            view.row = this.userDefinedLayout[view.viewId].row;
            view.col = this.userDefinedLayout[view.viewId].col;
        }, this);
    }


    _.each(this.views, function(view){
        rowCount = this.views[view.viewId].row > rowCount ? this.views[view.viewId].row : rowCount;
    }, this);

    rowCount = (rowCount+1)/2;

    for(var i = 0; i < rowCount; i++) {
        var currentRow = (i*2)+1,
            viewsInRow = _.where(this.views, {'row': currentRow}),
            panelWidth = Math.floor((this.width - (viewsInRow.length+1) * this.gutter)/viewsInRow.length),
            maxPerRow = viewsInRow.length;

        panelWidth = panelWidth < 300 ? 300 : panelWidth;

        for(var j = 1, len = viewsInRow.length; j <= len; j++) {
            if(( this.gutter + (this.minWidth*j) + (this.gutter*j)) > this.width) {
                maxPerRow = j-1;
                break;
            }
        }

        if(viewsInRow.length > 1) {
            if(viewsInRow.length > maxPerRow) {
                //we have too many in the row... start popping off from the right side and place in row below
                var sortedViews = _.sortBy(viewsInRow, 'col').reverse(),
                    countToShift = viewsInRow.length - maxPerRow;

                for(var j = 0; j < countToShift; j++) {
                    if(i === rowCount-1) {
                        this.adjust({
                            'row': currentRow+1,
                            'col': 0,
                            'opts': sortedViews[j],
                            'skipPaint': true
                        });
                    } else {
                        this.adjust({
                            'row': currentRow+2,
                            'col': 0,
                            'opts': sortedViews[j],
                            'skipPaint': true
                        });
                    }
                }
            }
        }
    }

    this.paintPanels();
};

EasyGrid.prototype.updateUserDefinedLayout = function() {
    _.each(this.views, function(view){
        this.userDefinedLayout[view.viewId].row = view.row;
        this.userDefinedLayout[view.viewId].col = view.col;
    }, this);
};

module.exports =  EasyGrid;
