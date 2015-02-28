/*
Author: Matthew Slipper (slippm)

GroupableList: a library for creating and managing groupable/sortable lists
 */

;(function($, window, document, undefined) {
    var ACTIONS = {
        REORDER_TOP: 'reorder-top',
        REORDER_BOTTOM: 'reorder-bottom',
        CREATE_GROUP: 'create-group',
        APPEND_GROUP: 'append-group'
    };

    var GROUP_NAME_TMPL = function(name) {
        name = name || '';

        var ret = $('<div class="group-name-wrap">' +
            '<a class="group-collapse-drag-handle group-circle-button">Collapse</a>' +
            '<a class="group-name" data-name=""></a>' +
            '<span class="rightside-wrap">' +
            '<a class="nav-view-badge"></a>' +
            '<a class="edit-group group-square-button">Edit</a>' +
            '</span>' +
            '</div>');

        ret.find('.group-name').attr('data-name', name).text(name);

        return ret;
    };

    var EDIT_GROUP_TMPL = function(name) {
        name = name || '';

        var ret = $('<div class="edit-group-wrap">' +
            '<a class="group-collapse-drag-handle group-circle-button"></a>' +
            '<div class="edit-group-input-wrap"><input type="text" placeholder="Enter a name" class="edit-group-name" value=""></div>' +
            '<div class="edit-group-actions">' +
            '<a class="delete group-square-button" href="#">Delete</a>' +
            '<a class="save group-square-button" href="#">Save</a>' +
            '</div></div>');

        ret.find('input').val(name);

        return ret;
    };

    var ACTION_CLASSES = [];

    for (var k in ACTIONS) {
        if (ACTIONS.hasOwnProperty(k)) {
            ACTION_CLASSES.push(ACTIONS[k]);
        }
    }

    ACTION_CLASSES = ACTION_CLASSES.join(' ');

    var defaults = {
        didReorderContent: $.noop,
        didCreateGroup: $.noop,
        didBeginEditingGroup: $.noop,
        shouldCommitEditingGroup: function(group) {
            var $group = this.$el.find(group);

            if ($group.length === 0) {
                return false;
            }

            var $editor = $group.find('input.edit-group-name');

            if ($editor.length === 0 || $editor.val().trim() === '') {
                return false;
            }

            return true;
        },
        didCommitEditingGroup: $.noop,
        didFinishEditingGroup: $.noop,
        didDeleteGroup: $.noop,
        didReorderItem: $.noop,
        didAddItemToGroup: $.noop,
        didRemoveItemFromGroup: $.noop,
        didMoveItemBetweenGroups: $.noop,
        didCollapseGroup: $.noop,
        didTriggerSave: $.noop,
        threshold: 3,
        useOffsetParent: false,
        itemIdAttribute: null,
        allowGrouping: true
    };

    var GroupableList = function(el, opts) {
        this.opts = $.extend({}, defaults, opts);
        this.el = el;
        this.$el = $(el);
        this.$clone = null;
        this.$target = null;

        this._mouseY = null;
        this._elementX = null;
        this._elementY = null;
        this._parentY = null;
        this._elementWidth = null;
        this._startedDrag = false;
        this._dropAreas = [];
        this.dropTarget = null;

        this._boundMouseMove = this._onItemMouseMove.bind(this);
        this._boundMouseUp = this._onItemMouseUp.bind(this);

        this.initialize();
    };

    GroupableList.prototype.initialize = function() {
        var self = this;

        this.$el.on('mousedown', 'li', this._onItemMouseDown.bind(this));
        this.$el.on('keyup', 'input.edit-group-name', this._onInputKeyUp.bind(this));
        this.$el.on('click', 'a.edit-group, a.save, a.delete', this._onButtonClick.bind(this));
        this.$el.on('click', 'a.group-collapse-drag-handle', this._collapseGroup.bind(this));
        this.$el.on('triggersave',  this.callCallbackOnTriggerSave.bind(this)); //programmatically save group w/ custom jQuery event
    };

    GroupableList.prototype.destroy = function() {
        this.$el.off().data('groupableList', undefined);

        this.el = null;
        this.$el = null;

        this._dropAreas = [];
    };

    GroupableList.prototype.serialize = function() {
        var self = this, ret = [];

        this.$el.find('> li').each(function(i, item) {
            var serialized = self._serializeListItem(item);

            ret.push(serialized);
        });

        return ret;
    };

    GroupableList.prototype.callback = function(callback, args) {
        callback = this.opts[callback];

        if (typeof callback !== 'function') {
            return;
        }

        return callback.apply(this, args);
    };

    GroupableList.prototype.calculateDropAction = function(e) {
        var action, threshold;

        if ((this.dropTarget && this.dropTarget.isGroupable) || (this.dropTarget && this.dropTarget.isGroupAndActionable)) {
            threshold = this.opts.threshold;
        } else {
            threshold = Math.min($(this.dropTarget.element).height() / 2);
        }

        if (Math.abs(e.pageY - this.dropTarget.top) <= threshold) {
            action = ACTIONS.REORDER_TOP;
        } else if (Math.abs(e.pageY - this.dropTarget.bottom) <= threshold) {
            action = ACTIONS.REORDER_BOTTOM;
        } else {
            if (this.$target.isGroupable && this.dropTarget.isGroupable && this.opts.allowGrouping) {
                if (this.dropTarget.isGroupAndActionable) {
                    action = ACTIONS.APPEND_GROUP;
                } else {
                    action = ACTIONS.CREATE_GROUP;
                }
            } else {
                action = ACTIONS.REORDER_BOTTOM; //fallback for edge cases
            }
        }

        return action;
    };

    GroupableList.prototype.callCallbackOnTriggerSave = function() {
        var serialized = this.serialize();

        this.callback('didTriggerSave', [ serialized ]);
    };

    GroupableList.prototype.callCallbacksOnReorder = function() {
        var args = [ this.$target, this.dropTarget ];

        if (this.dropTarget.isGrouped && this.$target.isGrouped) {
            var targetGroupElement = this.$target.parentsUntil(this.el, 'li.group')[0];

            if (targetGroupElement !== this.dropTarget.groupElement) {
                this.callback('didMoveItemBetweenGroups', args);
            }
        }

        if (!this.dropTarget.isGrouped && this.$target.isGrouped) {
            this.callback('didRemoveItemFromGroup', args);
        }

        if (this.dropTarget.isGrouped && !this.$target.isGrouped) {
            this.callback('didAddItemToGroup', args);
        }

        var serialized = this.serialize();

        this.callback('didReorderContent', [ serialized ]);
    };

    GroupableList.prototype._serializeListItem = function(item) {
        var obj = {}, $item = $(item), self = this;

        obj.element = item;

        if ($item.hasClass('group')) {
            var subItems = [];

            obj.name = $item.find('a.group-name').attr('data-name') || $item.find('input.edit-group-name').val();
            obj.isCollapsed = $item.hasClass('collapsed');

            $item.find('li').each(function(i, li) {
                var serialized = self._serializeListItem(li);

                subItems.push(serialized);
            });

            obj.items = subItems;
        } else {
            obj[this.opts.itemIdAttribute] = $item.attr(this.opts.itemIdAttribute);
        }

        return obj;
    };

    GroupableList.prototype._onItemMouseDown = function(e) {
        e.stopPropagation();

        this.$target = $(e.currentTarget);

        var offset, elOffset;

        if (this.opts.useOffsetParent) {
            offset = this.$target.position();
            elOffset = this.$el.position();
        } else {
            offset = this.$target.offset();
            elOffset = this.$el.offset();
        }

        this._elementX = offset.left;
        this._elementY = offset.top;
        this._parentY = elOffset.top;
        this._elementWidth = this.$target.width();
        this._mouseY = e.pageY;

        var self = this;

        this.$el.find('li').each(function() {
            var $this = $(this),
                dropOffset = $this.offset(),
                $groupElement = $this.parentsUntil(self.el, 'li.group'),
                isGroup = $this.hasClass('group'),
                isGrouped = $groupElement.length === 1,
                isGroupAndActionable = isGroup && ($this.hasClass('collapsed') || $this.find('li').length === 0),
                itemId = $this.attr(self.opts.itemIdAttribute),
                isGroupable = !isGroup && !isGrouped;

            //add required properties to target element
            if (this === self.$target[0]) {
                if (isGrouped && !isGroup) {
                    isGroupable = true;
                }

                self.$target.isGrouped = isGrouped;
                self.$target.isGroup = isGroup;
                self.$target.isGroupable = isGroupable;
                self.$target.isGroupAndActionable = isGroupAndActionable;
                self.$target.groupElement = $groupElement[0];
                self.$target.itemId = itemId;

                return;
            }

            if (isGroupAndActionable) {
                isGroupable = true;
            }

            //if moving a group, ignore the items inside other groups
            if (self.$target.hasClass('group') && isGrouped) {
                return;
            }

            self._dropAreas.push({
                element: this,
                top: dropOffset.top,
                bottom: dropOffset.top + $this.height(),
                isGrouped: isGrouped,
                isGroup: isGroup,
                isGroupable: isGroupable,
                isGroupAndActionable: isGroupAndActionable,
                groupElement: $groupElement[0],
                itemId: itemId
            });
        });

        $(document).on('mousemove', this._boundMouseMove)
            .on('mouseup', this._boundMouseUp);
    };

    GroupableList.prototype._onItemMouseMove = function(e) {
        e.preventDefault();

        var delta = this._mouseY - e.pageY;

        //do nothing unless user drags > 10 pixels
        if (this._mouseY === null || Math.abs(delta) < 10) {
            return;
        }

        if (!this._startedDrag) {
            this._startedDrag = true;

            this.$target.addClass('dragging');

            var height = this.$target.height();

            this.$clone = $('<li />').css({ opacity: 0, height: height }).insertAfter(this.$target);
        }

        var top = this._elementY - (delta + 10), // 10 px to account for the movement threshold
            contBottom = this._parentY + this.$el.height(),
            elTop = top;

        if (top < this._parentY) {
            elTop = this._parentY;
        } else if (top > contBottom) {
            elTop = contBottom;
        }

        this.$target.css({
            position: 'absolute',
            top: elTop,
            left: this._elementX,
            width: this._elementWidth,
            zIndex: 1000
        });

        if (this.dropTarget) {
            $(this.dropTarget.element).removeClass(ACTION_CLASSES);
        }

        if (top < this._parentY) {
            this.dropTarget = this._dropAreas[0];
            this._applyActionClasses(e);
            return;
        } else if (top > contBottom) {
            var last = this._dropAreas[this._dropAreas.length - 1],
                target = last;

            if (last && last.groupElement) {
                for (var i = this._dropAreas.length - 1; i >= 0; i--) {
                    var area = this._dropAreas[i];

                    if (area.isGroup) {
                        target = area;
                        break;
                    }
                }
            }

            this.dropTarget = target;
            this._applyActionClasses(e);
            return;
        }

        var dropGroup;

        for (var i = 0; i < this._dropAreas.length; i++) {
            var dropTarget = this._dropAreas[i];

            if (dropGroup && dropGroup.element !== dropTarget.groupElement
                && !dropGroup.isGroupAndActionable) {
                this._applyActionClasses(e);
                return;
            }

            if (dropTarget.top < e.pageY && dropTarget.bottom > e.pageY) {
                this.dropTarget = dropTarget;

                if (dropTarget.isGroup && !dropTarget.isGroupAndActionable) {
                    dropGroup = dropTarget;
                    continue;
                }

                this._applyActionClasses(e);

                return; //exit once the drop target is found
            }
        }

        this.dropTarget = null; // if the for loop finds nothing, there is no drop target
    };

    GroupableList.prototype._applyActionClasses = function(e) {
        var action = this.calculateDropAction(e);

        $(this.dropTarget.element).addClass(action);

        this.$target.toggleClass('grouping', action === ACTIONS.CREATE_GROUP || action == ACTIONS.APPEND_GROUP
            || this.dropTarget.isGrouped);
    };

    GroupableList.prototype._onItemMouseUp = function(e) {
        $(document).off('mousemove', this._boundMouseMove);
        $(document).off('mouseup', this._boundMouseUp);

        this._mouseY = null;
        this._elementX = null;
        this._elementY = null;
        this._parentY = null;
        this._elementWidth = null;
        this._dropAreas = [];

        if (!this._startedDrag) {
            return;
        }

        this.$clone.remove();
        this.$clone = null;

        this.$target.css('position', 'static').removeClass('dragging grouping');

        if (this.dropTarget) {
            var $dropTarget = $(this.dropTarget.element),
                action = this.calculateDropAction(e);

            $dropTarget.removeClass(ACTION_CLASSES);

            if (action === ACTIONS.REORDER_TOP) {
                $dropTarget.before(this.$target);
                this.callCallbacksOnReorder();
            } else if (action === ACTIONS.REORDER_BOTTOM) {
                $dropTarget.after(this.$target);
                this.callCallbacksOnReorder();
            } else if (action === ACTIONS.APPEND_GROUP) {
                $dropTarget.find('ul').append(this.$target);
                this.callCallbacksOnReorder();
            } else {
                var $groupWrapper = $('<li class="group" />').append('<ul />'),
                    $groupWrapperList = $groupWrapper.find('ul');

                $groupWrapper.insertAfter($dropTarget)
                    .prepend(GROUP_NAME_TMPL());

                $groupWrapperList.append($dropTarget).append(this.$target);

                this.opts.didCreateGroup.call(this);

                this.beginEditingGroup($groupWrapper[0]);
            }
        }

        this.dropTarget = null;
        this._startedDrag = false;
    };

    GroupableList.prototype._onInputKeyUp = function(e) {
        var $target = $(e.currentTarget),
            $group = $target.parents('.group');

        if (e.keyCode == 13) {
            this.commitEditingGroup($group[0]);
        }
    };

    GroupableList.prototype._onButtonClick = function(e) {
        var $target = $(e.currentTarget),
            group = $target.parentsUntil(this.$el, '.group')[0];

        if ($target.hasClass('edit-group')) {
            this.beginEditingGroup(group);
        } else if($target.hasClass('save')) {
            this.commitEditingGroup(group)
        } else if($target.hasClass('delete')) {
            this.deleteGroup(group);
        }
    };

    GroupableList.prototype._collapseGroup = function(e) {
        var $target = $(e.currentTarget),
            $group = $target.parentsUntil(this.$el, '.group');

        if ($group) {
            $group.toggleClass('collapsed');
        }

        this.callback('didCollapseGroup', [ this._serializeListItem($group[0]), this.serialize() ]);
    };

    GroupableList.prototype.commitEditingGroup = function(group) {
        var $group = this.$el.find(group);

        if ($group.length === 0) {
            return;
        }

        var serialized = this._serializeListItem(group);

        if (this.callback('shouldCommitEditingGroup', [ group ])) {
            this.callback('didCommitEditingGroup', [ serialized, this.serialize() ]);
            this.endEditingGroup(group);
        }
    };

    GroupableList.prototype.beginEditingGroup = function(group) {
        var $group = this.$el.find(group);

        if ($group.length === 0) {
            return;
        }

        var $nameWrap = $group.find('.group-name-wrap'),
            name = $nameWrap.find('a.group-name').text(),
            $editForm = EDIT_GROUP_TMPL(name);

        $nameWrap.replaceWith($editForm);
        $editForm.find('.edit-group-name').focus().select();

        this.callback('didBeginEditingGroup', [ this._serializeListItem(group) ]);
    };

    GroupableList.prototype.endEditingGroup = function(group) {
        var $group = this.$el.find(group);

        if ($group.length === 0) {
            return;
        }

        var name = $group.find('input.edit-group-name').val(),
            $groupName = GROUP_NAME_TMPL(name);

        $group.find('.edit-group-wrap').replaceWith($groupName);

        this.callback('didFinishEditingGroup', [ this._serializeListItem(group), this.serialize() ]);
    };

    GroupableList.prototype.deleteGroup = function(group) {
        var $group = this.$el.find(group);

        if ($group.length == 0) {
            return;

        }

        var $items = $group.find('li');

        $group.replaceWith($items);

        this.callback('didDeleteGroup', [ this.serialize() ]);
    };

    $.fn.groupableList = function(opts) {
        this.each(function() {
            if ($(this).data('groupableList')) {
                return $(this).data('groupableList');
            }

            var instance = new GroupableList(this, opts);

            $(this).data('groupableList', instance);

            return instance;
        });

        return this;
    }
})(jQuery, window, document);
