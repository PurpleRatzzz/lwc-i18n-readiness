import { LightningElement } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class IgnoreComments extends LightningElement {
    notify() {
        this.dispatchEvent(
            new ShowToastEvent({
                // i18n-ignore-next-line
                title: 'Acme',
                message: 'Saved'
            })
        );
    }
}
