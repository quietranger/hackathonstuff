var _ = require('underscore');

var SimpleGrid = function(object){
    // Core variables
    this.maxColumns = 0;
    this.numRows = 0;
    this.rows = [];
    this.tokens = [];
    this.modules = {};
    this.object = object;
    this.tabindexIncrementer = 0;


    // Increments and Area Margins
    this.columnIncrement = 0;

    this.setColumnIncrements(400);

    // Insert a first row
    this.insertRow();

    // Bind resize
    var that = this;
    $(window).resize(_.debounce(function(e){
        //the resize caused by textinput doesn't affect the grid.
        if($(e.target).hasClass('chatroom-compose'))
            return;
        $(that.object).css({
            width: $(window).outerWidth() - that.offsetWidth,
            height: $(window).outerHeight() - that.offsetHeight
        });

        that.organize();
        //if there is textarea has focus, give it focus again (for char count plugin, we rely on focus event to re-calculate the position)
        setTimeout(function(){
            $('div.text-input-text:focus').focus();
        }, 200);
    }, 500));

    $(document).on('keydown', function(e){
        //since we set focus on grid container, messages-scroll won't get keydown event, therefore we need to bind event on document
        var $target = $(e.target);
        if($target.hasClass('simple_grid_container')){
            var $scrollArea = $target.find('.messages-scroll'), top;
            if (e.which == 40) {//down arrow
                top = $scrollArea.scrollTop() + 20;
            } else if (e.which == 38) {//up arrow
                top = $scrollArea.scrollTop() - 20;
            }
            $scrollArea.scrollTop(top);
        }
    });

    object.on('mousedown dragstart', '.gs-draggable', function(e){
        e.preventDefault();

        var moduleId = $(e.currentTarget).parents('.simple_grid_container').attr('data-moduleid');

        that.initMove(moduleId, e);
    }).on('mousedown dragstart', '.module-actions, .module-header h2', function(e){
        e.stopPropagation();
    });
};

SimpleGrid.prototype.bootstrapSavedGrid = function(gridOpts, modules) {
    this.rows = gridOpts.rows;
    this.numRows = gridOpts.numRows;

    var self = this;

    var layouts = _.map(modules, function(module) {
        return module.layout;
    });

    this.modules = _.indexBy(layouts, 'moduleId');

    var sorted = _.sortBy(modules, function(module) {
        return 0 - module.layout.rowNr - module.layout.columnNr; // make it negative to reverse it (_renderModule uses prepend)`
    });

    _.each(sorted, function(module) {
        self._renderModule(module.element, module.layout.moduleId, module.layout)
    });

    this.organize();
};

SimpleGrid.prototype.setOffset = function() {
    this.offsetHeight = parseInt(this.object.css('top'), 10);
    this.offsetWidth = parseInt(this.object.css('left'), 10);
};


// Method to calculate how many columns which are allowed
SimpleGrid.prototype.insertRow = function(){
    this.numRows++;
    this.rows[this.numRows] = {
        numColumns: 0
    }
}

SimpleGrid.prototype._renderModule = function(module, id, layout) {
    var container;
    //Check if module is pinned by default
    if(layout.hasOwnProperty('options') && layout.options.hasOwnProperty('pinned') && layout.options.pinned){
        // Insert pinned module
        container = $('<div class="simple_grid_container" data-moduleid="' + id + '" tabindex="' + this.tabindexIncrementer++ + '"></div>');

        if (layout.rowNr !== undefined && layout.columnNr !== undefined) {
            container.attr('data-module-row', layout.rowNr);
            container.attr('data-module-column', layout.columnNr);
        }

        container.html(module);
        this.object.prepend(container);
    } else{
        // Check if main object exists on page
        if($('.simple_grid_main_container').length === 0){

            // Insert new main grid
            this.object.prepend('<div class="simple_grid_main_container simple_grid_container" tabindex="' + this.tabindexIncrementer++ + '"></div>')
        }
        else{

            // Remove current module to be deleted from memory
            delete this.modules[$('.simple_grid_main_container').attr('data-moduleid')];
        }
        // Insert module into main object
        container = $('.simple_grid_main_container');

        container.attr('data-moduleid', id).html(module);

        if (layout.rowNr !== undefined && layout.columnNr !== undefined) {
            container.attr('data-module-row', layout.rowNr);
            container.attr('data-module-column', layout.columnNr);
        } else if (container.attr('data-module-row') !== undefined && container.attr('data-module-column') !== undefined) {
            this.modules[id].rowNr = container.attr('data-module-row');
            this.modules[id].columnNr = container.attr('data-module-column');
        }
    }
}
/**
 * Method to insert module
 * Unique Id, Module Code, Options (object with conditions)
 *
 *  Options = {
 *    pinned: true/false
 *	}
 *
 **/
SimpleGrid.prototype.insertModule = function(id, module, options){
    this.modules[id] = _.extend({
        moduleId: id
    }, options);

    this._renderModule(module, id, options);

    this.organize();

    return 'Done';
}

// Method to render all place tokens
SimpleGrid.prototype.renderTokens = function(nr){
    this.object.append('<div class="simple_grid_token" data-tokenid="'+nr+'"></div>');

    var o = $('.simple_grid_token:last');

    o.css({
        left: this.tokens[nr].left,
        top: this.tokens[nr].top,
        width: this.tokens[nr].width,
        height: this.tokens[nr].height
    });

    if(this.tokens[nr].row == 'top' || this.tokens[nr].row == 'bottom'){
        o.addClass('simple_grid_token_preview_horizontal')
    }
}

SimpleGrid.prototype.previewTokens = function(lastRow){
    for(var i = 0; i < this.tokens.length; i++){
        if(!this.tokens[i].rowIsFull || this.tokens[i].row == lastRow){
            this.object.prepend('<div class="simple_grid_token_preview" data-tokenid="'+i+'"></div>');

            var o = $('.simple_grid_token_preview:first');

            o.css({
                left: this.tokens[i].left,
                top: this.tokens[i].top,
                width: this.tokens[i].width,
                height: this.tokens[i].height
            });

            if(this.tokens[i].row == 'top' || this.tokens[i].row == 'bottom'){
                o.addClass('simple_grid_token_preview_horizontal')
            }
        }
    }
}

SimpleGrid.prototype.togglePin = function(id){

    // Check if already pinned
    if(this.modules[id].options.pinned){
        this.modules[id].options.pinned = false;
    }
    else{
        this.modules[id].options.pinned = true;

        // Check if it is in main container
        if($('[data-moduleid="'+id+'"]').hasClass('simple_grid_main_container')){

            // Make main container a regular container
            $('[data-moduleid="'+id+'"]').removeClass('simple_grid_main_container');
        }
    }
}
// Method to close module
SimpleGrid.prototype.close = function(id){

    $('[data-moduleid="'+id+'"]').remove();

    delete this.modules[id];

    this.organize();

    return 'Removed';
}

// Method to organize open modules
// May have issues in older browsers due to Object.keys
SimpleGrid.prototype.organize = function(){
    var numModules = $('.simple_grid_container').length;
    var workspaceWidth = $('#simple_grid').outerWidth();
    var workspaceHeight = $('#simple_grid').outerHeight();
    this.tokens = [];

    // Assign positions to all modules
    for(var id in this.modules){
        if(!this.modules[id].hasOwnProperty('rowNr')){
            this.assignRow(this.modules[id]);
        }
        // Set column for new module
        if(!this.modules[id].hasOwnProperty('columnNr')){
            $('[data-moduleid="'+id+'"]').attr('data-module-column', 0);
            this.modules[id].columnNr = 0;
        }
    }

    // Iterate all rows and resize properly
    for(var i = 0; i < this.numRows; i++){
        // Number of columns in this row
        var numColumns = this.rows[i + 1].numColumns;
        var allColumns = $('[data-module-row=' + (i + 1) + ']');

        // Check if row needs to be corrected
        if(numColumns !== allColumns.length){
            this.rows[i + 1].numColumns = allColumns.length;
            numColumns = allColumns.length;

            if(numColumns === 0 && this.numRows > 1){
                this.deleteRowInMiddle(i+1)
            }
        }

        var columnWidth = Math.round((workspaceWidth - ((numColumns + 1) * 10)) / numColumns);
        var rowHeight = Math.round((workspaceHeight - ((this.numRows + 1) * 10)) / this.numRows);

        if(rowHeight < 300){
            rowHeight = 300;
        }

        if(columnWidth < 300){
            columnWidth = 300;
        }

        // Each column in this row
        for(var j = 0; j < allColumns.length; j++){
            var $col = $(allColumns[j]), id = $col.attr('data-moduleid'),
            moduleProperties = {
                // Set module size and position
                width: columnWidth,
                height: rowHeight,
                left: Math.round((columnWidth * j) + (10 * (j + 1))),
                top: Math.round((rowHeight * ((this.numRows - 1) - i)) + (10 * (this.numRows - i)))
            };

            this.object.trigger('grid:beforeResize', id);

            $col.css(moduleProperties);
            $col.removeClass('simple-jack-tiny simple-jack-small simple-jack-medium simple-jack-large');

            if(columnWidth <= 350){
                $col.addClass('simple-jack-tiny');
            }
            else if (columnWidth > 350 && columnWidth < 430) {
                $col.addClass('simple-jack-small');
            }
            else if(columnWidth > 430 && columnWidth < 526){
                $col.addClass('simple-jack-medium')
            }
            else{
                $col.addClass('simple-jack-large')
            }

            // Create tokens for row
            if((numColumns > 1 || numModules > 1)){
                var tokenProperties = {
                    left: moduleProperties.left - 5,
                    top: moduleProperties.top + 4,
                    width: 1,
                    height: moduleProperties.height - 8,
                    row: i + 1,
                    column: j,
                    rowIsFull: false
                }

                if(numColumns >= this.getMaxColumns()){
                    tokenProperties.rowIsFull = true;
                }

                this.tokens.push(tokenProperties);

                // Add last token
                if(j + 1 === numColumns){
                    var tokenProperties = {
                        left: moduleProperties.left + moduleProperties.width + 5,
                        top: moduleProperties.top + 4,
                        width: 1,
                        height: moduleProperties.height - 8,
                        row: i + 1,
                        column: j + 1,
                        rowIsFull: false
                    }
                    if(numColumns >= this.getMaxColumns()){
                        tokenProperties.rowIsFull = true;
                    }
                    this.tokens.push(tokenProperties);
                }
            }
            this.object.trigger('grid:afterResize', id);
        }
    }
    if(numModules > 1){
        // Create token for top and bottom
        this.tokens.push({
            left: 10,
            top: 5,
            width: workspaceWidth - 20,
            height: 1,
            row: 'top',
            column: 0,
            rowIsFull: false
        });
        this.tokens.push({
            left: 10,
            top: workspaceHeight - 5,
            width: workspaceWidth - 20,
            height: 1,
            row: 'bottom',
            column: 0,
            rowIsFull: false
        });
    }
}

// Delete row in middle of rows
SimpleGrid.prototype.deleteRowInMiddle = function(rowId){
    var that = this;

    for(var i = 0; i < this.numRows; i++){
        if(i + 1 > rowId){
            var affectedModules = $('[data-module-row='+(i + 1)+']');
            $.each(affectedModules, function(key, value){
                $(value).attr('data-module-row', i);
                that.modules[$(value).attr('data-moduleid')].rowNr = i;
            });
        }
    }

    delete this.rows[this.numRows];
    this.numRows--;
    this.organize();
}

// Method to assign a module to a row
SimpleGrid.prototype.assignRow = function(module){
    var $module = $('[data-moduleid="'+module.moduleId+'"]');

    // Check if top row has enough columns already
    if(this.rows[this.numRows].numColumns >= this.getMaxColumns() && !module.hasOwnProperty('columnNr')){

        // Check if model already has a row
        var hasAttribute = $module.attr('data-module-row');

        // Increment column
        if(!(typeof hasAttribute !== 'undefined' && hasAttribute !== false)){
            this.insertRow();
        }
    }

    module.rowNr = this.numRows;

    $module.attr('data-module-row', this.numRows);

    // Check if column number is still valid
    if(this.rows[this.numRows].numColumns !== $('[data-module-row='+this.numRows+']').length){

        // Assign row and columns
        this.rows[this.numRows].numColumns = $('[data-module-row='+this.numRows+']').length;

        // Increment columns
        this.assignColumn(module);

    }
}

// Method to assign module to a column within a row
SimpleGrid.prototype.assignColumn = function(module){

    // Get all modules for this row
    var modulesInRow = $('[data-module-row='+module.rowNr+']');

    for(var i = 0; i < modulesInRow.length; i++){

        // Check if model already has a column
        var hasAttribute = $(modulesInRow[i]).attr('data-module-column');

        // Increment column
        if(typeof hasAttribute !== 'undefined' && hasAttribute !== false){
            var columnNr = Math.round($(modulesInRow[i]).attr('data-module-column')) + 1;
            $(modulesInRow[i]).attr('data-module-column', columnNr);

            var moduleId = $(modulesInRow[i]).attr('data-moduleid'),
                mod = this.modules[moduleId];

            mod.columnNr = columnNr;
        }
    }
}

// Method to do move
SimpleGrid.prototype.initMove = function(id, e){
    this.object.css('overflow', 'hidden');
    this.object.append('<div class="simple_grid_placeholder"></div>');
    var originalObject = $('[data-moduleid="'+id+'"]');
    var lastX = e.pageX;
    var lastY = e.pageY;
    var o = $('.simple_grid_placeholder:last');
    var radius = 120;
    var that = this;
    var mouseReleased = false;
    var lastRow = this.modules[id].rowNr;

    // Display previews of tokens
    this.previewTokens(lastRow);

    o.css({
        left: originalObject.css('left'),
        top: originalObject.css('top'),
        width: originalObject.css('width'),
        height: originalObject.css('height')
    });

    function smoothMove(e) {
        o.css({
            left: Math.round(parseInt(o.css('left'), 10) - (lastX - e.pageX)),
            top: Math.round(parseInt(o.css('top'), 10) - (lastY - e.pageY))
        });

        lastX = e.pageX;
        lastY = e.pageY;

        throttledsimpleGridMouseMove(e);
    }

    function simpleGridMouseMove(e){
        if(mouseReleased) {
            return;
        }

        $('.simple_grid_token').remove();

        // Check if close to token area
        for(var i = 0; i < that.tokens.length; i++){
            var t = that.tokens[i]
            if(lastX > t.left - radius + that.offsetWidth
                && lastX < t.left + t.width + radius + that.offsetWidth
                && lastY > t.top - radius + that.offsetHeight
                && lastY < t.top + t.height + radius + that.offsetHeight
                && (!t.rowIsFull || t.row == lastRow)){

                that.renderTokens(i);

                break;
            }
        }
    };

    var throttledsimpleGridMouseMove = _.throttle(simpleGridMouseMove, 200);

    $(document).mousemove(smoothMove);
    $(document).mouseup(simpleGridMouseUp);

    function simpleGridMouseUp(e){
        mouseReleased = true;

        $(document).off('mousemove', smoothMove);
        $(document).off('mouseup', simpleGridMouseUp);


        var t = $('.simple_grid_token');

        if(t.length > 0){
            var tId = t.attr('data-tokenid');

            if(that.tokens[tId].row === 'top'){
                that.insertRow();

                var rowNumber = that.numRows;
            }
            else if(that.tokens[tId].row === 'bottom'){
                that.insertRow();

                for (var key in that.modules) {
                    var newRow = that.modules[key].rowNr + 1;

                    that.modules[key].rowNr = newRow;
                    $('[data-moduleid="'+that.modules[key].moduleId+'"]').attr('data-module-row', newRow)
                }

                var rowNumber = 1;
            }
            else{
                var rowNumber = that.tokens[tId].row;
            }

            var rowObjects = $('[data-module-row='+rowNumber+']');

            that.modules[id].rowNr = rowNumber;
            originalObject.attr('data-module-row', rowNumber);

            if(that.tokens[tId].column === rowObjects.length){
                $(rowObjects[that.tokens[tId].column - 1]).after($('[data-moduleid="'+id+'"]'));
            }
            else if(that.tokens[tId].column !== 0){
                $(rowObjects[that.tokens[tId].column]).before($('[data-moduleid="'+id+'"]'));
            }
            else{
                $(rowObjects[0]).before($('[data-moduleid="'+id+'"]')[0]);
            }

            _.each($('[data-module-row=' + lastRow + ']'), that._iter_setColumns.bind(that));

            if (lastRow !== rowNumber) {
                _.each($('[data-module-row=' + rowNumber + ']'), that._iter_setColumns.bind(that));
            }

            that.organize();
            t.remove();
        }

        that.object.css('overflow', 'auto');
        $('.simple_grid_placeholder, .simple_grid_token, .simple_grid_token_preview').remove();
    };
}

SimpleGrid.prototype._iter_setColumns = function(item, idx) {
    var $item = $(item),
        moduleId = $item.attr('data-moduleid');

    var idx = idx + 1;

    $item.attr('data-module-column', idx);

    this.modules[moduleId].columnNr = idx;
};

// Getters and Setters
SimpleGrid.prototype.setColumnIncrements = function(value){
    this.columnIncrement = value;
    this.setMaxColumns();
}

SimpleGrid.prototype.getColumnIncrements = function(){
    return this.columnIncrement;
}

SimpleGrid.prototype.setMaxColumns = function(){
    this.maxColumns = Math.round(this.object.innerWidth() / this.getColumnIncrements());
}

SimpleGrid.prototype.getMaxColumns = function(){
    return this.maxColumns;
}

SimpleGrid.prototype.getLayoutForView = function(id) {
    var layout = $.extend(true, {}, this.modules[id]);

    return layout;
}

SimpleGrid.prototype.getCurrentLayout = function() {
    return {
        modules: $.extend(true, {}, this.modules),
        rows: $.extend(true, {}, this.rows),
        numRows: this.numRows
    };
}

SimpleGrid.prototype.getNumRows = function() {
    return this.numRows;
}



module.exports = SimpleGrid;