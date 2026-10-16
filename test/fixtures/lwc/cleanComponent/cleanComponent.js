import { LightningElement } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import CURRENCY from '@salesforce/i18n/currency';
import TITLE from '@salesforce/label/c.Contact_Title';
import RESET from '@salesforce/label/c.Contact_Reset';
import SAVED from '@salesforce/label/c.Contact_Saved';

export default class CleanComponent extends LightningElement {
    labels = { title: TITLE, reset: RESET };
    currency = CURRENCY;
    message;

    get pathClass() {
        return 'slds-path__item ' + (this.active ? 'slds-is-active' : '');
    }

    handleReset() {
        this.message = SAVED;
        this.dispatchEvent(new ShowToastEvent({ title: SAVED, variant: 'success' }));
        this.dispatchEvent(new CustomEvent('reset'));
    }
}
