var Q = require('q');

var LeftNav = require('../../../src/js/modules/leftnav/views/view');

var sandbox = require('../../mocks/sandboxMock');

describe("The left nav module", function() {
    var m, q;

    beforeEach(function() {
        q = Q.defer();

        sandbox.getData.and.returnValue(q.promise);

        m = new LeftNav({
            sandbox: sandbox,
            viewId: 123,
            el: document.createElement('div')
        });
    });

    describe("cleaning the left nav", function() {
        var pinnedChats, documents, promises;

        beforeEach(function(done) {
            promises = [];

            pinnedChats = [
                {
                    threadId: '123'
                },
                {
                    threadId: '234'
                },
                {
                    threadId: '345'
                },
                {
                    threadId: '456'
                },
                {
                    threadId: '567'
                }
            ];

            documents = {
                leftnavGroups: {
                    ims: [
                        {
                            'data-streamid': '123'
                        },
                        {
                            'data-streamid': '234'
                        },
                        {
                            name: "hi",
                            isCollapsed: false,
                            items: [
                                {
                                    'data-streamid': '345'
                                },
                                {
                                    'data-streamid': '456'
                                }
                            ]
                        }
                    ]
                },

                layout: {
                    im234: {
                        viewId: "im234",
                        streamId: "234",
                        module: "im"
                    }
                }
            };

            for (var i = 0; i < pinnedChats.length; i++) {
                var chat = pinnedChats[i];

                m.$el.append('<li data-streamid="' + chat.threadId + '">');

                if (i > 0) {
                    m.$el.find('li').eq(i).html('<a class="hide-badge"></a>');
                }
            }

            sandbox.getData.and.callFake(function(id) {
                var p = Q.defer(),
                    promise = p.promise;

                if (id === 'app.account.pinnedChats') {
                    p.resolve(pinnedChats);
                } else if (id === 'documents') {
                    p.resolve(documents);
                } else {
                    return q.promise;
                }

                promises.push(promise);
                return promise;
            });

            m.removeInactiveIM().done(done);
        });

        function imExists(id, status) {
            expect(m.$el.find('[data-streamid="' + id + '"]').length).toBe(status ? 1 : 0);
        }

        it("should keep all grouped IMs", function() {
            imExists(345, true);
            imExists(345, true);
        });

        it("should keep all IMs that are open", function() {
            imExists(234, true);
        });

        it("should keep all IMs with unread counts", function() {
            imExists(123, true);
        });

        it("should remove all other IMs", function() {
            imExists(567, false);
        });
    });
});