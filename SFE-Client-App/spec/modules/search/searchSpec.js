var sandbox = require('../../mocks/sandboxMock.js');
var search = require('../../../src/js/modules/search');
var q = require('q');

var accountData = require('../../fixtures/accountData');
var searchData = require('../../fixtures/searchData');

var RESULTS_PER_PAGE = 20;

describe('The search module', function() {
    beforeEach(function() {
        this.q = q.defer();
        this.d = q.defer();

        sandbox.getData.and.returnValue(this.q.promise);
        sandbox.send.and.returnValue(this.d.promise);

        this.search = new search.createView({
            sandbox: sandbox,
            viewId: _.uniqueId()
        });
    });

    it('should be a standalone module', function() {
        expect(search.createView).toBeDefined();
    });

    it('should call app.account and populate account data variables', function(done) {
        var self = this;

        expect(sandbox.getData).toHaveBeenCalledWith('app.account');

        this.q.resolve(accountData);

        this.q.promise.done(function() {
            expect(self.search.currentUserId).toBe(accountData.userName);
            expect(self.search.currentUserName).toBe(accountData.prettyName);
            expect(self.search.rooms.length).toBe(accountData.roomParticipations.length);
            expect(self.search.ims.length).toBe(accountData.pinnedChats.length);
            done();
        });
    });

    describe('pagination', function() {
        it('should calculate the appropriate offset', function() {
            var types = [ 'users', 'rooms', 'messages' ],
                self = this;

            var pagination = {
                currentPage: 3,
                nextStart: 50,
                oldPage: 2,
                pageCount: 20
            };

            _.each(types, function(type) {
                //third page from second
                self.search.pagination[type] = _.clone(pagination);
                expect(self.search._calculateOffset(type)).toBe(
                    pagination.nextStart);

                //fourth page from second
                self.search.pagination[type].currentPage += 1;
                expect(self.search._calculateOffset(type)).toBe(
                    pagination.nextStart + RESULTS_PER_PAGE);

                //fifth page from second
                self.search.pagination[type].currentPage += 1;
                expect(self.search._calculateOffset(type)).toBe(
                    pagination.nextStart + 2 * RESULTS_PER_PAGE);

                // first page from second
                self.search.pagination[type].currentPage = 1;
                expect(self.search._calculateOffset(type)).toBe(0);
            });
        });
    });

    describe('when rendered', function() {
        beforeEach(function() {
            this.search.render().postRender();
        });

        it('should not render anything until account data is populated', function(done) {
            var self = this;

            expect(this.search.$content.is(':empty')).toBe(true);

            this.q.resolve(accountData);

            this.search.eventBus.on('view:rendered', function() {
                expect(self.search.$content.is(':empty')).toBe(false);
                done();
            });
        });

        describe('with a pre-selected room or query', function() {
            beforeEach(function(done) {
                var thread = accountData.roomParticipations[0];
                this.threadId = thread.threadId;
                this.threadName = thread.name;
                this.search.opts.query = 'test';
                this.search.opts.selectedRoomId = this.threadId;
                this.q.resolve(accountData);
                this.search.eventBus.on('view:post-rendered', done);
            });

            it('should pre-fill the search field with the query', function() {
                expect(this.search.$content.find('.query').val()).toBe('test');
            });

            it('should display the advanced search fields', function() {
                expect(this.search.$el.hasClass('showing-advanced-search-fields')).toBe(true);
            });

            it('should pre-select the appropriate room', function() {
                var $in = this.search.$content.find('.in');

                expect($in.find('span:last-child').text()).toBe(this.threadName);
                expect($in.val()).toBe(this.threadId);
                expect(this.search.$content.find('[name="in"]').val()).toBe(this.threadId);
            });
        });

        describe('with populated account data', function() {
            beforeEach(function(done) {
                this.q.resolve(accountData);
                this.search.eventBus.on('view:post-rendered', done);
            });

            it('should show and hide the advanced search fields when the link is pressed', function() {
                this.search.$content.find('.toggle-search-type').trigger('click');
                expect(this.search.$el.hasClass('showing-advanced-search-fields')).toBe(true);
            });

            it('should instantiate the calendars, the typeahead, and the token input', function() {
                expect(this.search.datePickers.length).toBe(2);
                expect(this.search.tokenInput).not.toBe(null);
                expect(this.search.fromTypeahead).not.toBe(null);
            });

            describe('when a search is inputted in the query box', function() {
                beforeEach(function() {
                    this.search.$content.find('.query').val('test').trigger('change');
                });

                it('should tokenize hashtags and cashtags when space is pressed', function() {
                    var e = $.Event('keydown', { which: 32 });

                    this.search.$content.find('.query').val('#test').trigger(e);
                    this.search.$content.find('.query').val('$test').trigger(e);

                    expect(this.search.$content.find('.token-input li').length).toBe(2);
                });

                it('should tokenize hashtags and cashtags when enter is pressed', function() {
                    var e = $.Event('keydown', { which: 13 });

                    this.search.$content.find('.query').val('#test').trigger(e);
                    this.search.$content.find('.query').val('$test').trigger(e);

                    expect(this.search.$content.find('.token-input li').length).toBe(2);
                });

                it('should set run a query on enter', function() {
                    var e = $.Event('keydown', { which: 13 }),
                        self = this;

                    spyOn(this.search, '_debouncedQuery');
                    this.search.$content.find('.query').trigger(e);
                    expect(this.search._debouncedQuery).toHaveBeenCalled();
                });
            });

            describe('when a date is chosen via the calendar picker', function() {
                beforeEach(function() {
                    spyOn(this.search, '_debouncedQuery');

                    this.$calendarEl = this.search.$content.find('.calendar:first');
                    this.calendarName = this.$calendarEl.attr('name');
                    this.calendar = this.search.datePickers[0];
                    this.calendar.setDate(new Date());
                });

                it('should set the appropriate property', function() {
                    expect(this.search.criteria[this.calendarName]).not.toBe(null);
                });

                it('should run a query', function() {
                    expect(this.search._debouncedQuery).toHaveBeenCalled();
                });

                it('should show the clear button', function() {
                    expect(this.$calendarEl.hasClass('has-value')).toBe(true);
                });

                describe('and the clear button is clicked', function() {
                    beforeEach(function() {
                        this.$calendarEl.find('.clear').click();
                    });

                    it('should clear the calendar field', function() {
                        expect(this.$calendarEl.find('span').is(':empty')).toBe(true);
                    });

                    it('should clear the internal search criteria', function() {
                        expect(this.search.criteria[this.$calendarEl.attr('name')]).toBe(null);
                    });

                    it('should hide the clear button', function() {
                        expect(this.$calendarEl.find('.clear').is(':visible')).toBe(false);
                    });

                    it('should run a query', function() {
                        expect(this.search._debouncedQuery).toHaveBeenCalled();
                    });
                });
            });

            describe('when something is chosen from a dropdown', function() {
                beforeEach(function() {
                    spyOn(this.search, '_debouncedQuery');

                    this.$dropdown = this.search.$content.find('.dropdown-menu:first');
                    this.$select = this.$dropdown.find('select');
                    this.$select.val(this.$select.find('option:last').attr('value'))
                        .trigger('change');
                });

                it('should set the appropriate property', function() {
                    expect(this.search.criteria[this.$select.attr('name')])
                        .toBe(this.$select.val());
                });

                it('should run a query', function() {
                    expect(this.search._debouncedQuery).toHaveBeenCalled();
                });

                it('should set the value text to the proper value', function() {
                    var text = this.$select.find('option[value="' + this.$select.val() + '"]').text();

                    expect(this.$dropdown.find('span').text()).toBe(text);
                });
            });

            describe('when a result type is chosen form the show menu', function() {
               var dropdown;

                beforeEach(function() {
                    dropdown = this.search.$content.find('select[name=showResults]');
                });

                it('should hide the other result types', function() {
                    var types = [ 'users', 'messages', 'rooms' ],
                        self = this;

                    _.each(types, function(type) {
                        dropdown.val(type).trigger('change');

                        expect(self.search.$content.find('.result-wrap:not(.' + type + ')')
                            .is(':visible')).not.toBe(true);
                    });
                });
            });

            describe('when a person is autocompleted into the from box', function() {
                it('should set the appropriate property', function() {
                    this.search.$content.find('.from').trigger('typeahead:autocomplete', {
                        id: 'slippm'
                    });

                    expect(this.search.criteria.from).toBe('slippm');
                });

                it('should reset the appropriate property when emptied', function() {
                    this.search.$content.find('.from').val('test').trigger('change')
                        .val('').trigger('change');

                    expect(this.search.criteria.from).toBe(null);
                });

                describe('and is then deleted', function() {
                    it('should run a query', function() {
                        spyOn(this.search, '_debouncedQuery');

                        var clear = this.search.$content.find('.from').val('test').trigger('change').val('');

                        clear.trigger('keyup');

                        expect(this.search._debouncedQuery).toHaveBeenCalled();

                        this.search._debouncedQuery.calls.reset();

                        clear.trigger('keyup');

                        expect(this.search._debouncedQuery).toHaveBeenCalled();
                    });
                });

                it('should run a query', function() {
                    spyOn(this.search, '_debouncedQuery');

                    this.search.$content.find('.from').trigger('typeahead:autocomplete', {
                        id: 'slippm'
                    });

                    expect(this.search._debouncedQuery).toHaveBeenCalled();
                });
            });

            describe('when submitted', function() {
                beforeEach(function() {
                    this.search.$content.find('.token-input input').val('test');
                    this.search.criteria = {
                        start: (new Date()).getTime() - 86400,
                        end: (new Date()).getTime(),
                        from: 'slippm',
                        in: accountData.roomParticipations[0].threadId,
                        connectorId: null,
                        operator: 'ANY',
                        entities: []
                    };

                    this.search.tokens = [
                        {
                            id: '#test'
                        },
                        {
                            id: '#awesome'
                        }
                    ];

                    spyOn(this.search, '_formatPayload').and.callThrough();
                });

                it('should properly format tokens into entities', function() {
                    this.search.query();

                    expect(this.search._formatPayload).toHaveBeenCalled();
                });

                it("should not show a pager when only one page exists", function(done) {
                    this.search.query();

                    this.d.resolve(searchData);

                    var self = this;

                    this.d.promise.done(function() {
                        //only rooms should not show a pager
                        expect(self.search.$el.find('.rooms .pagination').length).toBe(0);
                        done();
                    });
                });

                describe('the message payload', function() {
                    it('should be properly formatted', function() {
                        var payload = this.search._formatPayload();
                        var expectation = {
                            messagesPerPage: RESULTS_PER_PAGE,
                            usersPerPage: RESULTS_PER_PAGE,
                            roomsPerPage: RESULTS_PER_PAGE,
                            messagesStart: 0,
                            usersStart: 0,
                            roomsStart: 0,
                            entities: '#test,#awesome',
                            query: 'test',
                            operator: 'ANY'
                        };

                        _.each(_.keys(expectation), function(key) {
                            expect(expectation[key]).toEqual(payload[key]);
                        });
                    });

                    it('should exclude all empty strings and null values', function() {
                        this.search.tokens = [];
                        this.search.$content.find('.token-input input').val('');
                        this.search.criteria = { //it doesn't matter what these are as long as they are falsy
                            in: undefined,
                            connectorId: null,
                            source: '',
                            entities: []
                        };

                        var payload = this.search._formatPayload();

                        _.each(_.keys(this.search.criteria), function(key) {
                            expect(payload[key]).toBeUndefined();
                        });
                    });
                });

                it('should render results', function(done) {
                    var self = this;

                    this.search.query();

                    this.d.resolve(searchData);
                    this.d.promise.done(function() {
                        expect(self.search.$content.find('.messages .content > div').length)
                            .toBe(searchData.messages.results.length);
                        expect(self.search.$content.find('.rooms .content > div').length)
                            .toBe(searchData.rooms.results.length);
                        expect(self.search.$content.find('.users .content > div').length)
                            .toBe(searchData.users.results.length);
                        done();
                    });
                });
            });
        });
    });

    it('should destroy the typeahead and the token input when destroyed', function(done) {
        var self = this;

        this.search.render().postRender();

        this.q.resolve(accountData);

        this.search.eventBus.on('view:post-rendered', function() {
            var tokenInput = self.search.tokenInput,
                typeahead = self.search.fromTypeahead;

            spyOn(tokenInput, 'tokenInput').and.callThrough();
            spyOn(typeahead, 'typeahead').and.callThrough();

            self.search.destroy();

            expect(tokenInput.tokenInput).toHaveBeenCalledWith('destroy');
            expect(typeahead.typeahead).toHaveBeenCalledWith('destroy');
            done();
        });
    });
});
