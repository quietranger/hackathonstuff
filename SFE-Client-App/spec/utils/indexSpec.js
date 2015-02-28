var Q = require('q');

var utils = require('../../src/js/utils/index');

describe("isValidString Tests", function() {
    it("empty string should return false", function () {
        expect(utils.isValidString("")).toBe(false);
    });

    it("non-empty string should return true", function () {
        expect(utils.isValidString("test")).toBe(true);
    });

    it("null should return false", function () {
        expect(utils.isValidString(null)).toBe(false);
    });

    it("undefined should return false", function () {
        expect(utils.isValidString(undefined)).toBe(false);
    });

    it("string with white space at beginning should return true", function () {
        expect(utils.isValidString(" a")).toBe(true);
    });

    it("string with white space at end should return true", function () {
        expect(utils.isValidString("a ")).toBe(true);
    });

    it("string with only white space should return false", function () {
        expect(utils.isValidString(" ")).toBe(false);
        expect(utils.isValidString("\t")).toBe(false);
        expect(utils.isValidString("\n")).toBe(false);
    });
});