import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toBcp47, toSalesforceLang } from '../../src/xliff/languages.js';

const PAIRS = [
    ['zh-CN', 'zh_CN'],
    ['zh-TW', 'zh_TW'],
    ['ja', 'ja'],
    ['de', 'de'],
    ['fr', 'fr'],
    ['es', 'es'],
    ['pt-BR', 'pt_BR'],
    ['ko', 'ko']
];

test('maps BCP 47 to Salesforce codes and back', () => {
    for (const [bcp47, sf] of PAIRS) {
        assert.equal(toSalesforceLang(bcp47), sf);
        assert.equal(toBcp47(sf), bcp47);
    }
});

test('BCP 47 lookup ignores case', () => {
    assert.equal(toSalesforceLang('zh-cn'), 'zh_CN');
    assert.equal(toSalesforceLang('PT-br'), 'pt_BR');
});

test('unmapped codes give a clear error', () => {
    assert.throws(() => toSalesforceLang('xx'), /No Salesforce language code is mapped for "xx".*Supported: zh-CN.*languages\.js/);
    // An underscore code is not BCP 47, so it is not silently accepted.
    assert.throws(() => toSalesforceLang('zh_CN'), /No Salesforce language code/);
    assert.throws(() => toBcp47('eo'), /No BCP 47 tag is mapped for Salesforce language "eo"/);
});
