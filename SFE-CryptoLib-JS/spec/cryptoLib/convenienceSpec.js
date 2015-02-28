var Forge = require('node-forge');

var c = require('../../src/cryptoLib/convenience');

describe("The crypto convenience module", function() {
    var key = '/v/pkoZlcxxtao+UZzCDCP7/6ZKGZXMcbWqPlGcwgwg=',
        randomB64 = 'N8TH9vmckW3X50e1rxO3Mw==',
        randomBytes = Forge.util.decode64(randomB64),
        expFullPayloadFromKey = 'AQA3xMf2+ZyRbdfnR7WvE7czN8TH9vmckW3X50e1rxO3MzvyUfosWIG1sqpzbqquDYuFrJN9',
        expFullPayloadFromPw = 'AQE3xMf2+ZyRbdfnR7WvE7czN8TH9vmckW3X50e1rxO3MzfEx/b5nJFt1+dHta8TtzPB5ruMNeVB0gsbl+7nfJDbwD7znw==',
        expCtFromKeyB64 = 'O/JR+ixYgbWyqnNuqq4Ni4Wsk30=',
        expCtFromPwB64 = 'wea7jDXlQdILG5fu53yQ28A+858=',
        password = 'test';

    beforeEach(function() {
        spyOn(c, 'randomBytes').and.returnValue(randomBytes);
    });

    describe("the encrypt function", function() {
        var expCtFromKeyBits = Forge.util.decode64(expCtFromKeyB64),
            expCtFromPw = Forge.util.decode64(expCtFromPwB64),
            ctBits, ctB64;

        describe("when given a key", function() {
            beforeEach(function() {
                ctB64 = c.encrypt(key, false, 'test');
                ctBits = Forge.util.createBuffer(Forge.util.decode64(ctB64));
            });

            /*
            getBytes() removes the read bytes from the buffer.
             */

            it("should place version 01 at byte position 0", function() {
                var version = Forge.util.createBuffer(ctBits.getBytes(1));

                expect(version.toHex()).toBe('01');
            });

            it("should place the use password bit at byte position 1", function() {
                ctBits.getBytes(1);

                var usePassword = Forge.util.createBuffer(ctBits.getBytes(1));

                expect(usePassword.toHex()).toBe('00');
            });

            it("should place the IV at byte positions 2-18", function() {
                ctBits.getBytes(2);

                var iv = ctBits.getBytes(16);

                expect(iv).toEqual(randomBytes);
            });

            it("should place the adata at byte positions 18-34", function() {
                ctBits.getBytes(18);

                var adata = ctBits.getBytes(16);

                expect(adata).toEqual(randomBytes);
            });

            it("should place the ciphertext and tag on the end", function() {
                ctBits.getBytes(34);

                var ct = ctBits.getBytes();

                expect(ct).toEqual(expCtFromKeyBits);
            });

            it("should return the correct full base64", function() {
                expect(ctB64).toBe(expFullPayloadFromKey);
            });
        });

        describe("when given a password", function() {
            beforeEach(function() {
                ctB64 = c.encrypt('password', true, 'test');
                ctBits = Forge.util.createBuffer(Forge.util.decode64(ctB64));
            });

            it("should place version 01 at byte position 0", function() {
                var version = Forge.util.createBuffer(ctBits.getBytes(1));

                expect(version.toHex()).toBe('01');
            });

            it("should place the use password bit at byte position 1", function() {
                ctBits.getBytes(1);

                var usePassword = Forge.util.createBuffer(ctBits.getBytes(1));

                expect(usePassword.toHex()).toBe('01');
            });

            it("should place the salt at byte positions 2-18", function() {
                ctBits.getBytes(2);

                var salt = ctBits.getBytes(16);

                expect(salt).toEqual(randomBytes);
            });

            it("should place the IV at byte positions 19-35", function() {
                ctBits.getBytes(18);

                var iv = ctBits.getBytes(16);

                expect(iv).toEqual(randomBytes);
            });

            it("should place the adata at byte positions 36-52", function() {
                ctBits.getBytes(34);

                var adata = ctBits.getBytes(16);

                expect(adata).toEqual(randomBytes);
            });

            it("should place the ciphertext and tag on the end", function() {
                ctBits.getBytes(50);

                var ct = ctBits.getBytes();

                expect(ct).toEqual(expCtFromPw);
            });

            it("should return the correct full base64", function() {
                expect(ctB64).toBe(expFullPayloadFromPw);
            });
        });
    });

    describe("the decrypt function", function() {
        it("should return the correct plaintext", function() {
            var pt = c.decrypt(key, expFullPayloadFromKey);

            expect(pt).toBe('test');
        });

        it("should return the correct plaintext when given a password", function() {
            var pt = c.decrypt('password', expFullPayloadFromPw);

            expect(pt).toBe('test');
        });

        it("should throw an error if the format version is not implemented", function() {
            expect(function() {
                c.decrypt(key, 'AwA='); //0300 in hex
            }).toThrow();
        });
    });

    describe("the randomBytes function", function() {
        beforeEach(function() {
            c.randomBytes.and.callThrough();
        });

        it("should generate random data", function() {
            var data = c.randomBytes(16);

            expect(data.length).toBe(16);
        });

        it("should throw an error if identical random data is generated 3 times", function() {
            spyOn(Forge.random, 'getBytesSync').and.returnValue('bytes');

            c.randomBytes(4);
            Forge.random.getBytesSync.calls.reset();

            expect(function() {
                c.randomBytes(4);
            }).toThrow();

            expect(Forge.random.getBytesSync.calls.count()).toBe(3);
        });
    });
});
