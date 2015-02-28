var Q = require('q');

var sandbox = require('../mocks/sandboxMock');

var Symphony = require('../../src/symphony');

describe('A Symphony module', function() {
    var mod, opts, d; //module is a reserved word in requireJS

    beforeEach(function() {
        d = Q.defer();

        sandbox.getData.and.returnValue(d.promise);

        spyOn(Symphony.View.prototype, 'initialize').and.callThrough();
        spyOn(Symphony.View.prototype, 'destroy').and.callThrough();
        spyOn(Symphony.Module.prototype, 'initTooltips').and.callThrough();
        spyOn(Symphony.Module.prototype, 'destroyTooltips').and.callThrough();
        spyOn(Symphony.Module.prototype, 'initAliases').and.callThrough();
        spyOn(Symphony.Module.prototype, 'destroyAliases').and.callThrough();

        opts = {
            sandbox: sandbox,
            viewId: _.uniqueId()
        };

        mod = new Symphony.Module(opts);
    });

    it('should call the superclass constructor', function() {
        expect(Symphony.View.prototype.initialize).toHaveBeenCalledWith(opts);
    });

    it('should throw an error if instantiated without a viewId', function() {
        expect(function() {
            new Symphony.Module({
                sandbox: sandbox
            });
        }).toThrowError();
    });

    describe("when includeContainer is false", function() {
        var hMod;

        beforeEach(function() {
            hMod = new Symphony.Module.extend({
                includeContainer: false
            });
        });

        it("should set $content to $el", function() {
            expect(hMod.$el).toBe(hMod.$content);
        });
    });

    describe('when rendered', function() {
        beforeEach(function(done) {
            spyOn(mod, 'containerTmpl').and.callThrough();

            mod.moduleMenu = 'test';
            mod.$content.html('test');
            mod.render();

            d.resolve({});

            mod.eventBus.on('view:rendered', done);
        });

        it('should render the container with the header and menu', function() {
            expect(mod.containerTmpl).toHaveBeenCalledWith({
                moduleHeader: mod.moduleHeader,
                moduleMenu: mod.moduleMenu,
                isPinned: mod.isPinned
            });

            expect(mod.$el.children().length).not.toBe(0);
        });

        it('should append whatever is in $content to the module\'s content section', function() {
            expect(mod.$el.find('section.module-content .content').children()[0]).toEqual(mod.$content[0]);
        });

        it('should initialize tooltips', function() {
            expect(Symphony.Module.prototype.initTooltips).toHaveBeenCalled();
        });

        it('should initialize aliases', function() {
            expect(Symphony.Module.prototype.initAliases).toHaveBeenCalled();
        });

        describe('and focused', function() {
            beforeEach(function() {
                spyOn(mod.el, 'scrollIntoView').and.callThrough();
                spyOn(mod.eventBus, 'trigger').and.callThrough();
                spyOn(mod, '_focus').and.callThrough();

                mod.focusRequested(null, {
                    viewId: mod.viewId
                });
            });

            it('should scroll the module into view', function() {
                expect(mod.el.scrollIntoView).toHaveBeenCalled();
            });

            it('should trigger the module:focused event', function() {
                expect(mod.eventBus.trigger).toHaveBeenCalledWith('module:focused', mod);
            });

            it('should do nothing if a different module focused', function() {
                mod._focus.calls.reset();

                mod.focusRequested(null, {
                    viewId: 'nope'
                });

                expect(mod._focus).not.toHaveBeenCalled();
            });
        });

        describe('and blurred', function() {
            beforeEach(function() {
                spyOn(mod, 'closeMenu');

                mod.focusChanged(null, {
                    viewId: 'no'
                });
            });

            it('should close the menu', function() {
                expect(mod.closeMenu).toHaveBeenCalled();
            });
        });

        describe('and pinned', function() {
            beforeEach(function() {
                mod.pin();
            });

            it('should set the isPinned flag to true', function() {
                expect(mod.isPinned).toBe(true);
            });

            it('should add the pinned class to the icon', function() {
                expect(mod.$el.find('.pin-view').hasClass('pinned')).toBe(true);
            });

            it('should re-initialize tooltips', function() {
                //true causes old tooltips to be overwritten
                expect(mod.initTooltips).toHaveBeenCalledWith(true);
            });

            it('should publish the correct sandbox method', function() {
                expect(sandbox.publish).toHaveBeenCalledWith('view:pin', null, mod.viewId);
            });

            it('should do nothing when already pinned', function() {
                sandbox.publish.calls.reset();

                mod.initTooltips();

                expect(sandbox.publish).not.toHaveBeenCalled();
            });
        });

        describe('and floated', function() {
            beforeEach(function() {
                mod.float();
            });

            it('should publish the correct sandbox event', function() {
                expect(sandbox.publish).toHaveBeenCalledWith('view:float', null, mod.viewId);
            });
        });

        describe('and unfloated', function() {
            beforeEach(function() {
                mod.unfloat();
            });

            it('should publish the correct sandbox event', function() {
                //TODO: check the floaterId parameter
                expect(sandbox.publish).toHaveBeenCalledWith('view:unfloat', null, jasmine.any(Object));
            });
        });

        describe('and closed', function() {
            it('should publish the correct sandbox event', function() {
                mod.close();

                expect(sandbox.publish).toHaveBeenCalledWith('view:close', null, mod.viewId);
            });
        });

        describe('and exported', function() {
            it('should return a copy of the opts property', function() {
                var exported = mod.exportJson();

                expect(exported).toEqual({
                    isPinned: false,
                    viewId: jasmine.any(String)
                });
            })
        });

        describe('and the settings menu is toggled', function() {
            var e = { stopPropagation: $.noop }, $options, $more;

            beforeEach(function() {
                $options = mod.$el.find('.module-options');
                $more = mod.$el.find('.show-more');
            });

            it('should show or hide the menu', function() {
                mod.toggleMenu(e);

                expect(mod.moduleMenuOpen).toBe(true);
                expect($options.css('display')).not.toBe('none');
                expect($more.hasClass('opened')).toBe(true);

                mod.toggleMenu(e);

                expect(mod.moduleMenuOpen).toBe(false);
                expect($options.css('display')).toBe('none');
                expect($more.hasClass('opened')).toBe(false);
            });

            it('should force the state to whatever the second argument is', function() {
                mod.toggleMenu(null, false);

                expect(mod.moduleMenuOpen).toBe(false);
                expect($options.css('display')).toBe('none');
                expect($more.hasClass('opened')).toBe(false);
            });

            it('should close the menu when clicking outside it', function() {
                mod.toggleMenu(e);
                mod.closeMenu();

                expect(mod.moduleMenuOpen).toBe(false);
                expect($options.css('display')).toBe('none');
                expect($more.hasClass('opened')).toBe(false);
            });
        });
    });

    it('should defer taking focus until it is rendered', function(done) {
        spyOn(mod, '_focus').and.callThrough();

        mod.focusRequested(null, {
            viewId: mod.viewId
        });

        expect(mod._focus).not.toHaveBeenCalled();

        mod.render();

        d.resolve({});

        mod.accountDataPromise.done(function() {
            expect(mod._focus).toHaveBeenCalled();
            done();
        });
    });

    describe('when destroyed', function() {
        beforeEach(function() {
            mod.destroy();
        });

        it('should destroy tooltips', function() {
            expect(Symphony.Module.prototype.destroyTooltips).toHaveBeenCalled();
        });

        it('should destroy aliases', function() {
            expect(Symphony.Module.prototype.destroyAliases).toHaveBeenCalled();
        });

        it('should call the superclass destroy function', function() {
            expect(Symphony.View.prototype.destroy).toHaveBeenCalled();
        });
    });
});
