var sandbox = require('../../../mocks/sandboxMock');
var goBlast = require('../../../../src/js/modules/common/goBlast');
var accountData = require('../../../fixtures/accountData.js');
var q = require('q');
var _ = require('underscore');

var clientData = {
    ims: [{
        name: 'Test',
        isCollapsed: false,
        items: [{
            'data-streamid': accountData.pinnedChats[0].threadId
        }, {
            'data-streamid': accountData.pinnedChats[1].threadId
        }]
    }],
    rooms: [{
        name: 'Test',
        isCollapsed: false,
        items: [{
            'data-streamid': accountData.roomParticipations[0].threadId
        }, {
            'data-streamid': accountData.roomParticipations[1].threadId
        }]
    }]
};

var userResolverData = [{
    active: true,
    deptCode: "Y149",
    deptName: "Collaboration",
    divName: "Technology Division",
    emailAddress: "Aaron.Scales@ny.email.gs.com",
    entitlement: {
        callEnabled: true,
        delegatesEnabled: true,
        imReadEnabled: true,
        imWriteEnabled: true,
        postReadEnabled: true,
        postWriteEnabled: true,
        roomReadEnabled: true,
        roomWriteEnabled: true
    },
    imageUrl: "http://directory.web.gs.com/directory/api?size=small&kerberos=scalea",
    imageUrlSmall: "http://directory.web.gs.com/directory/api?size=creepy&kerberos=scalea",
    initials: "",
    location: "Jersey City",
    myCurrentThreadId: "ELkQ/fbnaBnCv6m1wNOA8H///r+NJhMI",
    picOptOut: "",
    prettyName: "Scales, Aaron [Tech]",
    screenName: "scalea",
    surname: "Scales",
    title: "",
    userType: "lc",
    id: 2
}, {
    active: true,
    deptCode: "Y149",
    deptName: "Collaboration",
    divName: "Technology Division",
    emailAddress: "Jared.Rada@ny.email.gs.com",
    entitlement: {
        callEnabled: true,
        delegatesEnabld: true,
        delegatesEnabled: true,
        imReadEnabled: true,
        imWriteEnabled: true,
        postReadEnabled: true,
        postWriteEnabled: true,
        roomReadEnabled: true,
        roomWriteEnabled: true
    },
    imageUrl: "http://directory.web.gs.com/directory/api?size=small&kerberos=radaja",
    imageUrlSmall: "http://directory.web.gs.com/directory/api?size=creepy&kerberos=radaja",
    initials: "C",
    location: "Jersey City",
    myCurrentThreadId: "Iv1upz7WEqHJo45BUeu6an///r9ZlunG",
    picOptOut: "",
    prettyName: "Rada, Jared [Tech]",
    screenName: "radaja",
    surname: "Rada",
    title: "",
    userType: "lc",
    id: 3
}];

var mockSandbox = function(empty) {
    var mockAccountData;

    if (empty) {
        mockAccountData = _.clone(accountData);
        mockAccountData.pinnedChats = [];
        mockAccountData.roomParticipations = [];
    } else {
        mockAccountData = accountData;
    }

    sandbox.getData.and.callFake(function(key) {
        var obj = {
            'app.account': {
                q: q.defer(),
                data: mockAccountData
            },
            'documents.leftnavGroups': {
                q: q.defer(),
                data: empty ? {} : clientData
            },
            'supportedMimeTypes': {
                q: q.defer(),
                data: []
            }
        };

        var value = obj[key];

        if (!value) {
            value = {
                q: q.defer(),
                data: null
            };
        }

        value.q.resolve(value.data);

        return value.q.promise;
    });

    sandbox.send.and.returnValue(q.defer().promise);
};

describe('The go blast module', function() {
    it('should be empty until both account data and client data are populated', function(done) {
        mockSandbox();

        var view = new goBlast({
            sandbox: sandbox
        });

        view.render();

        expect(view.$el.is(':empty')).toBe(true);

        view.eventBus.on('view:rendered', function() {
            expect(view.$el.is(':empty')).toBe(false);
            done();
        });
    });

    it('should close on escape', function() {
        var view = new goBlast({
            sandbox: sandbox
        });

        spyOn(view, 'close');

        view.$el.trigger({
            type: 'keypress',
            which: 27,
            keyCode: 27
        });

        //expect(view.close).toHaveBeenCalled();
    });

    describe("when users are chosen and send is clicked", function() {
        var view;

        beforeEach(function(done) {
            mockSandbox();

            view = new goBlast({
                sandbox: sandbox
            });

            spyOn(view.textInputView, 'getValue').and.returnValue('test'); //changing tokens will toggle disabled

            view.render().postRender();

            view.eventBus.on('view:post-rendered', function() {
                var room = accountData.roomParticipations[0],
                    threadId = room.threadId,
                    $checkbox = view.$el.find('input[data-id="' + threadId + '"]');

                $checkbox.prop('checked', true).trigger('change');

                done();
            });
        });

        it("should disable the send button and only make one backend call", function() {
            var $send = view.$el.find('.send');

            view.sandbox.send.calls.reset();

            for (var i = 0; i < 4; i++) {
                $send.click();
            }

            expect(view.sandbox.send.calls.count()).toBe(1);
            expect($send.hasClass('disabled')).toBe(true);
        });
    });

    describe("the _parseClientData function", function() {
        var view;

        beforeEach(function() {
            view = new goBlast({
                sandbox: sandbox
            });

            view.ims = accountData.pinnedChats;
            view.rooms = accountData.roomParticipations;
            view.userName = "Slipper, Matt JA [Tech]";
        });

        describe("when a user has no client data", function() {
            beforeEach(function() {
                view._parseClientData();
            });

            it("should properly parse IMs and rooms", function() {
                var ims = view.conversations.ims;

                expect(_.pluck(ims, 'name')).not.toContain('Slipper, Matt JA [Tech]');
                expect(ims.length).toBe(accountData.pinnedChats.length);

                var rooms = view.conversations.rooms;
                expect(rooms.length).toBe(accountData.roomParticipations.length);
            });
        });

        describe("when a user has client data", function() {
            beforeEach(function() {
                view._parseClientData(clientData);
            });

            function testGroupable(type) {
                var obj = view.conversations[type],
                    dataType = type === 'ims' ? 'pinnedChats' : 'roomParticipations';

                var top = _.filter(obj, function(item) {
                    return !item.hasOwnProperty('items');
                });

                var groups = _.filter(obj, function(item) {
                    return item.hasOwnProperty('items') ;
                });

                var grouped = _.flatten(_.pluck(groups, 'items')),
                    concat = grouped.concat(top);

                expect(groups.length).toBe(clientData[type].length);
                expect(concat).not.toContain('Slipper, Matt JA [Tech]');
                expect(concat.length).toBe(accountData[dataType].length);
            }

            it("should properly parse IMs", function() {
                testGroupable('ims');
            });

            it("should properly parse rooms", function() {
                testGroupable('rooms');
            });
        });
    });

    describe('when rendered', function() {
        it('should return itself', function() {
            var view = new goBlast({
                sandbox: sandbox
            });

            var result = view.render();

            expect(result).toBe(view);
        });

        describe('and a user has rooms or IMs', function() {
            beforeEach(function(done) {
                mockSandbox();

                this.view = new goBlast({
                    sandbox: sandbox
                });

                spyOn(this.view.textInputView, 'getValue').and.returnValue('test'); //changing tokens will toggle disabled

                this.$el = this.view.$el;
                this.view.render().postRender();

                this.view.eventBus.on('view:post-rendered', done);
            });

            it('should render a list of conversations but exclude those that are read only', function() {
                var $el = this.view.$el,
                    length = accountData.pinnedChats.length + accountData.roomParticipations.length - 1;

                expect($el.find('.conversations li:not(.group)').length).toBe(length);
            });

            describe('the checkboxes', function() {
                describe('when belonging to a group', function() {
                    function testIfChildrenChecked($el, checked) {
                        var $group = $el.find('.group:first'),
                            $groupCheck = $group.find('input[type=checkbox]:first');

                        $groupCheck.prop('checked', checked).trigger('change');

                        var expectation = checked ? $group.find('li input[type=checkbox]').length : 0;

                        expect($group.find('li input[type=checkbox]:checked').length).toBe(expectation);
                        expect($groupCheck.hasClass('partially-checked')).toBe(false);
                    }

                    it('should check all child items', function() {
                        testIfChildrenChecked(this.$el, true);
                    });

                    it('should uncheck all child items', function() {
                        testIfChildrenChecked(this.$el, false);
                    });

                    it('should display a "partially checked" icon if all its are not checked', function() {
                        var $group = this.$el.find('.group:first'),
                            $groupCheck = $group.find('input[type=checkbox]:first');

                        $group.find('li:first input[type=checkbox]').prop('checked', true).trigger('change');

                        expect($groupCheck.hasClass('partially-checked')).toBe(true);
                        expect($groupCheck.prop('checked')).toBe(false);
                    });

                    it('should check if all its children are checked', function() {
                        var $group = this.$el.find('.group:first'),
                            $groupCheck = $group.find('input[type=checkbox]:first');

                        $group.find('li input[type=checkbox]').prop('checked', true).trigger('change');

                        expect($groupCheck.hasClass('partially-checked')).toBe(false);
                        expect($groupCheck.prop('checked')).toBe(true);
                    });

                    it('should uncheck if all its children are unchecked', function() {
                        var $group = this.$el.find('.group:first'),
                            $groupCheck = $group.find('input[type=checkbox]:first');

                        $group.find('li input[type=checkbox]').prop('checked', false).trigger('change');

                        expect($groupCheck.hasClass('partially-checked')).toBe(false);
                        expect($groupCheck.prop('checked')).toBe(false);
                    });

                    it('should add all child items to the to: field when checked', function(done) {
                        var d = q.defer();

                        sandbox.send.and.callFake(function() {
                            d.resolve(userResolverData);

                            return d.promise;
                        });

                        var $group1 = this.$el.find('.group-checkbox:eq(0)'), //group containing 2 ims
                            $group2 = this.$el.find('.group-checkbox:eq(1)'), //group containing 2 rooms
                            self = this;

                        $group1.prop('checked', true).trigger('change');

                        d.promise.done(function() {
                            var $tokens = self.$el.find('.token-input li');

                            expect($tokens.length).toBe(2);
                            expect(Number($tokens.eq(0).attr('data-id'))).toBe(userResolverData[0].id);
                            expect(Number($tokens.eq(1).attr('data-id'))).toBe(userResolverData[1].id);

                            $group2.prop('checked', true).trigger('change');

                            $tokens = self.$el.find('.token-input li'); //re-run selector

                            var rooms = accountData.roomParticipations;

                            expect($tokens.length).toBe(4);
                            expect($tokens.eq(2).attr('data-id')).toBe(rooms[0].threadId);
                            expect($tokens.eq(3).attr('data-id')).toBe(rooms[1].threadId);

                            done();
                        });
                    });

                    it('should remove all child items from the to: field when unchecked', function() {
                        var $group1 = this.$el.find('.group-checkbox:eq(1)'), //group containing 2 rooms
                            rooms = accountData.roomParticipations;

                        $group1.prop('checked', true).trigger('change').prop('checked', false).trigger('change');

                        var $tokens = this.$el.find('.token-input li');

                        expect($tokens.length).toBe(0);
                    });
                });

                describe('when belonging to an IM', function() {
                    beforeEach(function() {
                        var d = q.defer();
                        this.d = d.promise;

                        sandbox.send.and.callFake(function() {
                            d.resolve(userResolverData);

                            return d.promise;
                        });
                    });

                    it('should add its component users to the to: field', function(done) {
                        var threadId = accountData.pinnedChats[3].threadId, //corresponds to my IM with scalea and radaja
                            $room = this.$el.find('input[data-id="' + threadId + '"]'),
                            self = this;

                        $room.prop('checked', true).trigger('change');

                        this.d.done(function() {
                            var $tokens = self.$el.find('.token-input li');

                            expect($tokens.length).toBe(2);
                            expect(Number($tokens.eq(0).attr('data-id'))).toBe(userResolverData[0].id);
                            expect(Number($tokens.eq(1).attr('data-id'))).toBe(userResolverData[1].id);
                            done();
                        });
                    });

                    it('should remove its component users from the to: field', function(done) {
                        var threadId = accountData.pinnedChats[3].threadId,
                            $room = this.$el.find('input[data-id="' + threadId + '"]'),
                            self = this;

                        $room.prop('checked', true).trigger('change');

                        this.d.done(function() {
                            $room.prop('checked', false).trigger('change');

                            var $tokens = self.$el.find('.token-input li');

                            expect($tokens.length).toBe(0);
                            done();
                        });
                    });

                    it('should check all other instances of its component usernames', function(done) {
                        var threadId1 = accountData.pinnedChats[3].threadId, // corresponds to my IM with scalea and radaja
                            threadId2 = accountData.pinnedChats[0].threadId, //corresponds to my IM with scalea
                            $room1 = this.$el.find('input[data-id="' + threadId1 + '"]'),
                            $room2 = this.$el.find('input[data-id="' + threadId2 + '"]');

                        $room1.prop('checked', true).trigger('change');

                        this.d.done(function() {
                            expect($room2.prop('checked')).toBe(true);
                            done();
                        });
                    });

                    it('should uncheck all other instances of its component usernames', function(done) {
                        var threadId1 = accountData.pinnedChats[3].threadId, // corresponds to my IM with scalea and radaja
                            threadId2 = accountData.pinnedChats[0].threadId, //corresponds to my IM with scalea
                            $room1 = this.$el.find('input[data-id="' + threadId1 + '"]'),
                            $room2 = this.$el.find('input[data-id="' + threadId2 + '"]');

                        $room1.prop('checked', true).trigger('change');

                        this.d.done(function() {
                            $room1.prop('checked', false).trigger('change');
                            expect($room2.prop('checked')).toBe(false);
                            done();
                        });
                    });
                });

                describe('when belonging to a room', function() {
                    it('should add itself to the to: field when checked', function() {
                        var threadId = accountData.roomParticipations[0].threadId,
                            $room = this.$el.find('input[data-id="' + threadId + '"]');

                        $room.prop('checked', true).trigger('change');

                        var $tokens = this.$el.find('.token-input li');

                        expect($tokens.length).toBe(1);
                        expect($tokens.attr('data-id')).toBe(threadId);
                    });

                    it('should remove itself from the to: field when unchecked', function() {
                        var threadId = accountData.roomParticipations[0].threadId,
                            $room = this.$el.find('input[data-id="' + threadId + '"]');

                        $room.prop('checked', true).trigger('change').prop('checked', false).trigger('change');

                        var $tokens = this.$el.find('.token-input li');

                        expect($tokens.length).toBe(0);
                    });
                });
            });

            describe('the tokens in the to: field', function() {
                var room = accountData.roomParticipations[3];

                beforeEach(function() {
                    var threadId = room.threadId;

                    this.$checkbox = this.$el.find('input[data-id="' + threadId + '"]');
                    this.$checkbox.prop('checked', true).trigger('change');
                });

                describe('when added', function() {
                    describe("and the member count exceeds the blast message threshold", function() {
                        it("should not send the message until the confirmation is clicked", function() {
                            this.view.sandbox.send.calls.reset();

                            this.$el.find('.send').click();

                            expect(this.view.sandbox.send).not.toHaveBeenCalled();

                            this.$el.find('.send').click();

                            expect(this.view.sandbox.send).toHaveBeenCalled();
                        });

                        it("should display a warning in the send field", function() {
                            expect(this.$el.find('.send').text()).toContain(room.memberCount);
                        });
                    });
                });

                describe('when removed', function() {
                    it('should uncheck their counterparts in the conversations list', function() {
                        this.$el.find('.token-input .remove').click();

                        expect(this.$checkbox.prop('checked')).toBe(false);
                    });

                    it('should add a partial class to groups if they are partially emptied', function() {
                        var threadId2 = accountData.roomParticipations[1].threadId;

                        this.$el.find('input[data-id="' + threadId2 + '"]').prop('checked', true).trigger('change');

                        this.$el.find('.token-input .remove:first').click();

                        var $checkbox = this.$el.find('.rooms .group-checkbox:eq(0)');

                        expect($checkbox.hasClass('partially-checked')).toBe(true);
                        expect($checkbox.prop('checked')).toBe(false);
                    });

                    it('should uncheck groups if they are fully emptied', function() {
                        var threadId2 = accountData.roomParticipations[1].threadId;

                        this.$el.find('input[data-id="' + threadId2 + '"]').prop('checked', true).trigger('change');
                        this.$el.find('.token-input .remove').each(function() {
                            $(this).click();
                        });

                        var $checkbox = this.$el.find('.rooms .group-checkbox:eq(0)');

                        expect($checkbox.hasClass('partially-checked')).toBe(false);
                        expect($checkbox.prop('checked')).toBe(false);
                    });

                    describe("and the member count exceeds the blast message threshold", function() {
                        it("should reduce the warning by the proper amount", function() {
                            this.$el.find('.token-input .remove').click();

                            expect(this.$el.find('.send').text()).toBe('Send');
                        });

                        xit("test numbers larger than zero");
                    });
                });
            });
        });

        describe('and a user has no rooms or IMs', function() {
            beforeEach(function(done) {
                mockSandbox(true);

                this.view = new goBlast({
                    sandbox: sandbox
                });

                this.view.render();

                this.view.eventBus.on('view:rendered', done);
            });

            it('should display a message to the user', function() {
                var $el = this.view.$el;

                expect($el.find('p.empty').length).toEqual(1);
            });
        });
    });
});
