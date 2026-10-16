import { LightningElement } from 'lwc';
import LOCALE from '@salesforce/i18n/locale';
import CURRENCY from '@salesforce/i18n/currency';

const DEFAULT_CURRENCY = 'EUR';

export default class HardcodedLocale extends LightningElement {
    japanLocale = 'ja-JP';
    currencyCode = CURRENCY;
    columns = [{ label: 'Price', fieldName: 'price', type: 'currency', typeAttributes: { currencyCode: 'USD' } }];

    get formattedPrice() {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', currencyDisplay: 'symbol' }).format(this.price);
    }

    get userPrice() {
        return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY }).format(this.price);
    }

    get createdLabel() {
        return this.createdDate.toLocaleDateString('de-DE', { month: 'long' });
    }

    get createdDefault() {
        return this.createdDate.toLocaleDateString(undefined, { month: 'long' });
    }

    get sortedNames() {
        return new Intl.Collator(['fr-FR']).compare(this.a, this.b);
    }
}
