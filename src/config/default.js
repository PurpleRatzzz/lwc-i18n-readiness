// Default scanner configuration. Rules read it from ctx.config instead of hardcoding lists,
// so a project can widen or narrow what counts as "user-facing" without touching rule code.

export default {
    // Directory names the file discovery never enters: dependencies, tool caches and Jest tests.
    // Directories starting with "." (.git, .sfdx, .sf...) are skipped as well.
    excludeDirs: ['node_modules', '__tests__', '__mocks__'],

    // Text shapes that are code, not words for a translator, in templates and in JS alike.
    // A string that matches one of these is never reported, even in a user-facing place.
    codeLikePatterns: [
        /^[a-z][a-z0-9+.-]*:\/\//i, // URL: https://..., lightning://...
        /^\.{0,2}\/\S*$/, // absolute or relative path: /logo.svg, ./data
        /^[a-z0-9_.-]+(?:\/[\w.-]+)+\/?$/, // resource path: lwc/hello (lower case, so "N/A" stays text)
        /^\S+\.(js|css|svg|png|jpe?g|gif|html|json)$/i, // file name
        /^[a-z0-9]+(?:[-_]+[a-z0-9]+)+(?:\s+[a-z0-9]+(?:[-_]+[a-z0-9]+)*)*$/, // CSS classes, tag names: slds-box slds-path__item, c-chart-bar
        /^[A-Za-z0-9]+(?:_+[A-Za-z0-9]+)+$/, // developer names: Record_Selected__c, Access_Restricted_UI
        // One word with a capital right after a small letter is an identifier or a brand, which
        // stays as is in every language: HelloBinding, WorkspaceAPIOpenTab, LinkedIn.
        // "Hello", "OK" and "PDFs" don't match.
        /^(?=\S*[a-z][A-Z])[A-Za-z0-9]+$/,
        /^[\w.]+__(c|r|mdt|e|x)(?:\.\w+)*$/, // API names with a relationship: Account.Owner__r.Name
        /^(utility|standard|custom|action|doctype):\w+$/, // SLDS icon names
        /^[a-z]{2,3}(?:[-_][A-Z][a-z]{3})?[-_][A-Z]{2}$/ // locale tags: en-US, zh_CN, sr-Latn-RS (R5's job)
    ],

    template: {
        // Attributes whose literal value is shown to the user (or read aloud by a screen reader)
        // on any element.
        uiAttributes: ['label', 'title', 'placeholder', 'alternative-text', 'alt', 'help-text', 'field-level-help'],
        // Attribute families: message-when-value-missing, label-when-on (lightning-button-stateful),
        // message-toggle-active (lightning-input type="toggle").
        uiAttributePrefixes: ['message-when-', 'label-when-', 'message-toggle-'],
        // Base components name many display props "*-label" or "*-text": aria-label,
        // source-label (lightning-dual-listbox), assistive-text, loading-state-alternative-text...
        uiAttributeSuffixes: ['-label', '-text'],
        // data-* attributes are read by JS, never displayed, even when they end in "-label".
        nonUiAttributePrefixes: ['data-'],
        // Props of our own c-* children that the child component displays.
        customComponentProps: ['friendly-message', 'message', 'title', 'label'],
        // Display props that only make sense on one specific base component.
        elementAttributes: {
            'lightning-helptext': ['content'],
            'lightning-tree': ['header'],
            'lightning-quick-action-panel': ['header'],
            'lightning-carousel-image': ['header', 'description'],
            'lightning-formatted-text': ['value'],
            'lightning-formatted-rich-text': ['value']
        },
        // Elements that sit inside a sentence. Text on both sides of them is one sentence cut in pieces.
        inlineElements: ['br', 'b', 'strong', 'em', 'i', 'span', 'a'],
        // Base components that render one value in the middle of a sentence, like a {binding} does:
        // "Distance to property: <lightning-formatted-number> miles" is still one sentence.
        valueElementPrefixes: ['lightning-formatted-', 'lightning-relative-date-time'],
        // Text inside these elements is code (CSS, JS, code samples, raw JSON), not UI.
        nonTextElements: ['style', 'script', 'code', 'pre'],
        // Attributes that take an ISO 4217 currency code (R5).
        currencyAttributes: ['currency-code']
    },

    script: {
        // Calls whose first argument is an object the platform shows to the user. `module` is
        // where the callee is imported from, so a local rename (import Alert from 'lightning/alert')
        // still matches. `call` is 'new' for `new X({...})`, otherwise the method: `X.show({...})`.
        uiCalls: [
            { module: 'lightning/platformShowToastEvent', call: 'new', keys: ['title', 'message'], sink: 'toast' },
            { module: 'lightning/toast', call: 'show', keys: ['label', 'message'], sink: 'toast' },
            { module: 'lightning/alert', call: 'open', keys: ['label', 'message'], sink: 'modal' },
            { module: 'lightning/confirm', call: 'open', keys: ['label', 'message'], sink: 'modal' },
            { module: 'lightning/prompt', call: 'open', keys: ['label', 'message'], sink: 'modal' },
            // Our own LightningModal subclasses: MyModal.open({ label, header, description... }).
            { module: 'c/*', call: 'open', keys: ['label', 'message', 'title', 'header', 'description'], sink: 'modal' }
        ],
        // Object keys that hold display text wherever they appear: datatable columns,
        // combobox/radio options, tree and menu items, workspace tab labels, chart datasets.
        // The last three are options of native mobile features (lightning/mobileCapabilities):
        // the barcode scanner's on-screen instructions and the text that explains a permission request.
        // Added after evaluation v1, which missed them in dreamhouse-lwc.
        displayKeys: ['label', 'alternativeText', 'placeholder', 'instructionText', 'successText', 'permissionRationaleText'],
        // DOM properties that put text on the page: el.innerText = '...' (lwc:dom="manual", light DOM).
        domTextProperties: ['innerText', 'textContent', 'innerHTML'],
        // Component fields that hold a message for the user even when we can't see the template
        // render them (e.g. passed on to <c-error-panel errors={error}>).
        // Matches errorMessage, successMsg, error, errors, friendlyMessage...
        messageFieldPattern: /(message|msg|error)s?$/i,
        // Calls whose string arguments are selectors or developer output, never UI.
        ignoredCallees: ['querySelector', 'querySelectorAll', 'closest', 'matches', 'getElementById'],
        // Tags that make a JS string an HTML fragment (innerHTML, lightning-formatted-rich-text, map popups).
        htmlTags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'b', 'i', 'em', 'strong', 'br', 'div', 'span', 'a',
            'ul', 'ol', 'li', 'u', 'small', 'table', 'tr', 'td', 'th'],
        // Extra code shapes in JS only. In JS an ALL-CAPS token is almost always an enum value or
        // code ('ALL', 'OPEN', 'USD', 'POST'); in a template, "OK" on a button is real UI text.
        codeLikePatterns: [/^[A-Z][A-Z0-9_]*$/]
    },

    plural: {
        // Words ending in "s" that are not plural nouns, so "{name} has" or "{x} does" is not a plural.
        notPlural: ['has', 'was', 'is', 'its', 'his', 'hers', 'this', 'yes', 'does', 'goes', 'says', 'gets', 'lets',
            'makes', 'needs', 'uses', 'works', 'shows', 'means', 'plus', 'less', 'as', 'us'],
        // Irregular English plurals that don't end in "s".
        irregular: ['people', 'children', 'men', 'women']
    },

    locale: {
        // Names that hold a locale or currency code (R5): japanLocale, DEFAULT_CURRENCY, and the
        // option keys { currency: 'USD' } (Intl) and { currencyCode: 'USD' } (datatable typeAttributes).
        localeNamePattern: /locale/i,
        currencyNamePattern: /currency/i,
        // BCP 47 tag or Salesforce-style code: en, en-US, zh_CN, sr-Latn-RS.
        localeValuePattern: /^[a-z]{2,3}(?:[-_][a-z0-9]{2,8})*$/i,
        // ISO 4217: three capital letters.
        currencyValuePattern: /^[A-Z]{3}$/,
        // Date/Number methods whose first argument is a locale.
        localeMethods: ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString']
    }
};
