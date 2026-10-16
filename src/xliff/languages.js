// XLIFF and translation tools use BCP 47 language tags (zh-CN, pt-BR); Salesforce metadata uses
// its own codes with an underscore (zh_CN, pt_BR) and a file name per language. This table is
// the one place that maps between the two. Adding a language is one line.
const BCP47_TO_SALESFORCE = {
    'zh-CN': 'zh_CN',
    'zh-TW': 'zh_TW',
    ja: 'ja',
    ko: 'ko',
    de: 'de',
    fr: 'fr',
    es: 'es',
    'pt-BR': 'pt_BR'
};

export const SUPPORTED_BCP47 = Object.keys(BCP47_TO_SALESFORCE);

/** 'zh-CN' -> 'zh_CN'. BCP 47 tags are case-insensitive, so 'zh-cn' works too. Throws if unmapped. */
export function toSalesforceLang(bcp47) {
    const key = SUPPORTED_BCP47.find((tag) => tag.toLowerCase() === String(bcp47).toLowerCase());
    if (!key) {
        throw new Error(
            `No Salesforce language code is mapped for "${bcp47}". Supported: ${SUPPORTED_BCP47.join(', ')}. ` +
                'Add it to src/xliff/languages.js.'
        );
    }
    return BCP47_TO_SALESFORCE[key];
}

/** 'zh_CN' -> 'zh-CN'. Throws if unmapped. */
export function toBcp47(sfLang) {
    const entry = Object.entries(BCP47_TO_SALESFORCE).find(([, sf]) => sf === sfLang);
    if (!entry) {
        throw new Error(
            `No BCP 47 tag is mapped for Salesforce language "${sfLang}". ` +
                `Supported: ${Object.values(BCP47_TO_SALESFORCE).join(', ')}. Add it to src/xliff/languages.js.`
        );
    }
    return entry[0];
}
