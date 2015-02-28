var Q = require('q');
var CryptoLib = require('symphony-cryptolib');

var Backbone = require('backbone');

var ims = require('../../data/ims');
var messages = require('../../data/messages');

var Crypto = require('../../../src/symphony/extensions/crypto');

describe("The crypto core extension", function() {
    var key = '/v/pkoZlcxxtao+UZzCDCP7/6ZKGZXMcbWqPlGcwgwg=',
        rData = CryptoLib.Utils.b642bits('N8TH9vmckW3X50e1rxO3Mw=='),
        expCtB64 = 'AQA3xMf2+ZyRbdfnR7WvE7czN8TH9vmckW3X50e1rxO3MzvyUfosWIG1sqpzbqquDYuFrJN9',
        expEntityCtB64 = 'AQA3xMf2+ZyRbdfnR7WvE7czN8TH9vmckW3X50e1rxO3MzS1Su81/VU7n80DvICoqbwwbA8kfhWSz8w+uT4wl/0=',
        transport, ds, c;

    beforeEach(function() {
        var q = Q.defer();

        spyOn(Crypto.prototype, 'transportWillSendData');
        spyOn(Crypto.prototype, 'transportDidReceiveData');
        spyOn(Crypto.prototype, '_generateIMKey');

        transport = jasmine.createSpyObj('transport', ['send', 'setCommands']);
        transport.send.and.returnValue(q.promise);

        _.extend(transport, Backbone.Events);

        ds = jasmine.createSpyObj('dataStore', [ 'get', 'upsert' ]);
        ds.get.and.returnValue(ims);

        c = new Crypto(transport, ds);
    });

    describe("on transport calls", function() {
        it("should call transportWillSendData on transport:willSendData", function() {
            transport.trigger('transport:willSendData');

            expect(c.transportWillSendData).toHaveBeenCalled();
        });

        it("should call transportDidReceiveData on transport:didReceiveData", function() {
            transport.trigger('transport:didReceiveData');

            expect(c.transportDidReceiveData).toHaveBeenCalled();
        });
    });

    describe("the _verifyAndSetKeyPair function", function() {
        var relayKeysRsp, myKeysRsp;

        beforeEach(function() {
            spyOn(CryptoLib, 'RSAVerify');

            relayKeysRsp = {
                publicKey: 'relayPub'
            };

            myKeysRsp = {
                publicKey: 'myPub',
                privateKey: 'myPriv',
                publicKeySignature: 'test',
                privateKeySignature: 'test'
            };

            c.userId = 1;
        });

        it("should throw an error if the verification fails", function() {
            CryptoLib.RSAVerify.and.returnValue(false);

            expect(function() {
                c._verifyAndSetKeyPair(relayKeysRsp, myKeysRsp);
            }).toThrow();
        });

        it("should set the proper class variables and store the public key on verification", function() {
            CryptoLib.RSAVerify.and.returnValue(true);

            c._verifyAndSetKeyPair(relayKeysRsp, myKeysRsp);

            expect(c.publicKey).toBe('myPub');
            expect(c.privateKey).toBe('myPriv');
            expect(c.dataStore.upsert).toHaveBeenCalledWith('publicKeys.1', 'myPub');
        });
    });

    describe("the _encryptMessages function", function() {
        var im, opts;

        beforeEach(function() {
            spyOn(CryptoLib.Convenience, 'randomBytes').and.returnValue(rData);

            im = ims[0];

            c._ims[im.threadId] = _.clone(im); //prevent issues in later tests since ims is a local var

            opts = {
                payload: {
                    text: 'test',
                    threadId: im.threadId
                }
            };
        });

        it("should encrypt the message text", function() {
            spyOn(c, '_getIMPrivateKey').and.returnValue(key);

            c._encryptMessages(opts);

            var parsed = opts.payload;

            expect(parsed.text).toEqual(expCtB64);
            expect(parsed.msgFeatures).toBe('1');
        });

        it("should reject the promise if the IM has no key", function(done) {
            c._ims[im.threadId].encryptionKey = null;

            c._encryptMessages(opts).fail(function(rsp) {
                expect(rsp).toEqual(jasmine.any(String));
                done();
            });
        });

        it("should encrypt entities if there are any", function() {
            spyOn(c, '_getIMPrivateKey').and.returnValue(key);

            var opts2 = $.extend(true, {}, opts);

            opts2.payload.entities = { "hashtags": [] };

            c._encryptMessages(opts2).then(function() {
                var parsed = opts2.payload;

                expect(parsed.entities).toBeUndefined();
                expect(parsed.encryptedEntities).toBe(expEntityCtB64);
            });
        });
    });

    describe("the transportDidReceiveData function", function() {
        beforeEach(function() {
            spyOn(c, '_decryptMessages');
            spyOn(c, '_handleLongPollResponse');
            spyOn(c, '_handleIMResponse');

            c.transportDidReceiveData.and.callThrough();
        });

        it("should call the right functions", function() {
            var map = {
                QUERY_THREAD_HISTORY: '_decryptMessages',
                LONG_POLL: '_handleLongPollResponse',
                IM_MANAGER_THREAD: '_handleIMResponse',
                IM_MANAGER_USERS: '_handleIMResponse'
            };

            for (var k in map) {
                if (map.hasOwnProperty(k)) {
                    c.transportDidReceiveData(k, {
                        result: {
                            threadId: 'honk'
                        }
                    });

                    expect(c[map[k]]).toHaveBeenCalled();
                }
            }
        });
    });

    describe("the _generateIMKey function", function() {
        var request, q2;

        beforeEach(function() {
            Crypto.prototype._generateIMKey.and.callThrough();

            q2 = Q.defer();

            ds.get.and.returnValue(q2.promise);

            spyOn(CryptoLib.Convenience, 'randomBytes').and.returnValue(rData);
            spyOn(CryptoLib, 'RSAEncrypt').and.callFake(function(key) {
                return key === 'myPubKey' ? 'mine' : 'theirs';
            });

            c.userId = 1;
            c.publicKey = 'myPubKey';
            c.privateKey = 'myPrivKey';

            request = {
                urlExtension: '/2'
            };
        });

        it("should generate a key for the IM", function(done) {
            q2.resolve({
                1: 'myPubKey',
                2: 'theirPubKey'
            });

            c._generateIMKey(request).done(function () {
                expect(CryptoLib.Convenience.randomBytes).toHaveBeenCalledWith(32);

                expect(request.payload.encryptionKeys).toBe(JSON.stringify([
                    {
                        userId: 2,
                        encryptionKey: 'theirs'
                    },
                    {
                        userId: 1,
                        encryptionKey: 'mine'
                    }
                ]));

                done();
            });
        });

        it("should reject the promise if encryption fails", function(done) {
            q2.resolve({
                1: 'myPubKey',
                2: 'theirPubKey'
            });

            CryptoLib.RSAEncrypt.and.returnValue(false);

            c._generateIMKey(request).fail(function (message) {
                expect(message).toEqual(jasmine.any(String));

                done();
            });
        });

        it("should throw an error if a public key is not found", function() {
            q2.resolve({
                2: 'theirPubKey'
            });

            c._generateIMKey(request).fail(function(message) {
                expect(message).toEqual(jasmine.any(String));

                done();
            });
        });

        it("should do nothing if the IM contains more than two people", function(done) {
            request.urlExtension = '/2,3';

            c._generateIMKey(request).done(function(rsp) {
                expect(rsp).toBeNull();

                done();
            });
        });

        it("should accept requests in which the urlExtension contains the current user", function(done) {
            request.urlExtension = '/1,3';

            q2.resolve({
                1: 'myPubKey',
                3: 'theirs'
            });

            c._generateIMKey(request).done(function() {
                expect(request.payload.encryptionKeys).toBe(JSON.stringify([
                    {
                        userId: 1,
                        encryptionKey: 'mine'
                    },
                    {
                        userId: 3,
                        encryptionKey: 'theirs'
                    }
                ]));

                done();
            });
        });
    });

    describe("the _handleLongPollResponse function", function() {
        it("should decrypt the attached messages", function() {
            spyOn(c, '_decryptMessages');

            var msg = {};

            c._handleLongPollResponse({
                messages: [ { message: msg } ]
            });

            expect(c._decryptMessages).toHaveBeenCalledWith([ msg ]);
        });
    });

    describe("the _handleIMResponse function", function() {
        it("should add the passed IM to the _ims dictionary", function() {
            c._handleIMResponse({
                result: ims[0]
            });

            expect(c._ims[ims[0].threadId]).toBe(ims[0]);
        });
    });

    describe("the _decryptMessages function", function() {
        beforeEach(function() {
            spyOn(c, '_getIMPrivateKey').and.returnValue(key);

            c._ims[ims[0].threadId] = ims[0];

            c._decryptMessages(messages);
        });

        it("should decrypt encrypted messages", function() {
            expect(messages[0].text).toBe('test');
        });

        it("should decrypt entities if there are any", function() {
            expect(messages[0].entities).toEqual({
                hashtags: []
            });
        });

        it("should do nothing to non-encrypted messages", function() {
            expect(messages[1].text).toBe('test');
        });

        it("should replace the text with an error message if decryption fails", function() {
            expect(messages[2].text).toBe('Could not decrypt this message.');
        });
    });

    describe("the _storePublicKeys function", function() {
        it("should store public keys in the dataStore", function() {
            c._storePublicKeys([{
                id: 1,
                publicKey: 'pub'
            }]);

            expect(c.dataStore.upsert).toHaveBeenCalledWith('publicKeys.1', 'pub');
        });
    });

    describe("the _getIMPrivateKey function", function() {
        beforeEach(function() {
            c._ims[ims[0].threadId] = ims[0];
            c.privateKey = 'priv';

            spyOn(CryptoLib, 'RSADecrypt').and.returnValue(key);
        });

        it("should throw", function() {
            c.privateKey = null;

            expect(function() {
                c._getIMPrivateKey(ims[0].threadId);
            }).toThrow();
        });

        it("should throw an error if decryption fails", function() {
            CryptoLib.RSADecrypt.and.returnValue(false);

            expect(function() {
                c._getIMPrivateKey(ims[0].threadId);
            }).toThrow();
        });

        it("should cache the IM key", function() {
            c._getIMPrivateKey(ims[0].threadId);
            c._getIMPrivateKey(ims[0].threadId);

            expect(_.keys(c.keyCache).length).toBe(1);
        });

        it("should decrypt the IM key", function() {
            var ret = c._getIMPrivateKey(ims[0].threadId);

            expect(ret).toBe(key);
        });
    });
});
