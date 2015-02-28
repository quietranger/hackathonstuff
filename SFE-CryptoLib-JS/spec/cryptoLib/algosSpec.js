var Forge = require('node-forge');

var CryptoLib = require('../../src/cryptoLib/algos');

var rsaKeys = require('../data/keys');

/**
 * NIST Test Vector 16.
 *
 * K : Key
 * P: Plaintext
 * IV: Initialization Vector
 * C: Ciphertext
 * A: Authentication Data
 * T: Authentication Tag
 */

var V = {
    K: '/v/pkoZlcxxtao+UZzCDCP7/6ZKGZXMcbWqPlGcwgwg=',
    P: '2TEyJfiEBuWlWQnFr/UmmoanqVMVNPfaLkwwPYoxinIcPAyVlWgJUy/PDiRJprUlsWrt9aoN5le6Y3s5',
    IV: 'yv66vvrO263eyviI',
    C: 'Ui3B8JlWfQf0fzejKoRCfWQ6jNy/5cDJdZiivSVV0aqMsI5IWQ27PaewixBWgog4xfYeY5O6egq8yfZi',
    A: '/u36zt6tvu/+7frO3q2+76ut2tI=',
    T: 'dvxuzg9OF2jN34hTuy1VGw=='
};

/**
 * PBKF2 Test Vector.
 * P: Password
 * S: Salt
 * C: Iterations
 * DK: Derived Key
 */

var PV = {
    P: 'password',
    S: 'c2FsdA==',
    C: 2,
    DK: 'rk0Mla9rRtMtCt/5KPBt0CowP47zwlHf1uLYWpVHTEM='
};

var SIG = 'l3/is6ZgB0fY5i+HZDxn3fygFP4669c2i8sb4LZDMOjnTplPcx2kvJK6X3rdFdUZR/e/PyMQFSsS018kjjC8OZVSg3EY36ZksO0KHCMEuLLgw' +
    'YYBYjyg6Kk8gkLcF0fatlU2sA/zvkB4UPICCSl+NoD+xJxxCgmW85eQYAbX3bdJfSoQYgd0gxlheo6lvDw120V0Rj6sa/G1sF/dM22kw7aDBLoMfay' +
    'HEQORuUNcdt/6Q+ALl0ETt3Pdssj/jl6pQQgKWGMT2lICkg5DIWREppstzAKNw0EZLBmN2nVMRbE0sMpg1nZ8JQv1FRy45LS/AZ3ocr//DueGW4Vuki' +
    'pzlg==';

var TEXT = 'hello\n';

describe("The CryptoLib", function() {
    /**
     * The ciphertext is returned as the real ciphertext concatenated with the
     * authentication tag. The below variable performs this concatenation to allow
     * Jasmine to compare the return value of the encrypt function and have something
     * to pass to the decrypt function.
     */
    var realCt = 'Ui3B8JlWfQf0fzejKoRCfWQ6jNy/5cDJdZiivSVV0aqMsI5IWQ27PaewixBWgog4xfYeY5O6egq8yfZidvxuzg9OF2jN34hTuy1VGw==';

    it("should properly encrypt in GCM mode", function() {
        var output = CryptoLib.AESGCMEncrypt(V.IV, V.A, V.K, V.P);

        expect(output).toBe(realCt);
    });

    it("should properly decrypt in GCM mode", function() {
        var output = CryptoLib.AESGCMDecrypt(V.IV, V.A, V.K, realCt);

        expect(output).toBe(V.P);
    });

    it("should properly hash passwords via PBKDF2", function() {
        var output = CryptoLib.PBKDF2(PV.S, PV.C, PV.P);

        expect(output).toBe(PV.DK);
    });

    describe("when generating a public/private key pair", function() {
        it("should return a key pair when called synchronously", function() {
            var output = CryptoLib.RSAGenerateKeyPair(16); //too slow to use 2048

            expect(output.privateKey).not.toBeUndefined();
            expect(output.publicKey).not.toBeUndefined();
        });

        it("should return a key pair when called asynchronously", function(done) {
            CryptoLib.RSAGenerateKeyPair(16, function(output) {
                expect(output.privateKey).not.toBeUndefined();
                expect(output.publicKey).not.toBeUndefined();

                done();
            });
        });
    });

    describe("when encrypting/decrypting via RSA", function() {
        it("should properly encrypt via RSA", function() {
            var output = CryptoLib.RSAEncrypt(rsaKeys.publicKey, 'test'),
                outputBits = Forge.util.decode64(output);

            expect(outputBits.length).toBe(256);
        });

        it("should properly decrypt via RSA", function() {
            var ct = 'VAKHodt2iaclOGhPkqqEuiwGMg6DNr3tnwu55Hlr5RsrBQNj0zU2mKKOgE7Y2aho' +
                '7zIL/yUXFZSu45Bs+rPws6CrgYUW/mPAgR9ZE7EIYHzx6aVEvVoxdExfcjmTfV5H' +
                'RuYxeyXlNBqy9rUAKB1gclTmvscoCC/m+OF8b/jgy690EYX1YIIlbno4fsgGekyO' +
                'NHFBXIJpkFTMh09AV1GlNa42P/p2DI3+HshuLknf5gHBRRT5BdaUr+wORFaXDz9/' +
                'euJspytHwpY+hkDAy7y6xGodHrmR8ieh6hNVGpg7XQQ8PifMUxi3r/WRg1lFKSDb' +
                'MNuIX3oLuq4kFzC96ISStA==', //'test' encrypted with the keys in keys.js
                output = CryptoLib.RSADecrypt(rsaKeys.privateKey, ct);

            expect(output.trim()).toBe('test');
        });
    });

    describe("when verifying via RSA", function() {
        it("should return the proper signature", function() {
            var output = CryptoLib.RSASign(rsaKeys.privateKey, TEXT);

            expect(output).toBe(SIG);
        });

        it("should verify the signature properly", function() {
            var verified = CryptoLib.RSAVerify(rsaKeys.publicKey, SIG, TEXT);

            expect(verified).toBe(true);
        });

        it("should return false when verification fails", function() {
            var verified = CryptoLib.RSAVerify(rsaKeys.publicKey, 'derp', TEXT);

            expect(verified).toBe(false);
        });
    });
});
