var CryptoUtils = require('../../src/cryptoLib/utils');

describe("The cryptoUtils lib", function() {
    var testStr = 'test',
        testBits = 'test', // 'test' is a printable string in Forge's flavor of binary
        testB64 = 'dGVzdA==',
        testHex = '74657374';

    it("should properly convert a string into bits", function() {
        var test = CryptoUtils.str2bits(testStr);

        expect(test).toEqual(testBits);
    });

    it("should properly convert a string into base64", function() {
        var test = CryptoUtils.str2b64(testStr);

        expect(test).toBe(testB64);
    });

    it("should properly convert base64 into bits", function() {
        var test = CryptoUtils.b642bits(testB64);

        expect(test).toEqual(testBits);
    });

    it("should properly convert bits into base64", function() {
        var test = CryptoUtils.bits2b64(testBits);

        expect(test).toBe(testB64);
    });

    it("should properly convert base64 into a utf-8 string", function() {
        var test = CryptoUtils.b642str(testB64);

        expect(test).toBe(testStr);
    });

    it("should properly convert base64 into hex", function() {
        var test = CryptoUtils.b642hex(testB64);

        expect(test).toBe(testHex);
    });

    it("should properly convert hex into base64", function() {
        var test = CryptoUtils.hex2b64(testHex);

        expect(test).toBe(testB64);
    });

    it("should properly convery hex into bits", function() {
        var test = CryptoUtils.hex2bits(testHex);

        expect(test).toBe(testBits);
    });
});
