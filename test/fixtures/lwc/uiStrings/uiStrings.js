import { LightningElement, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import Toast from 'lightning/toast';
import Alert from 'lightning/alert';
import EditModal from 'c/editModal';
import { getRecord } from 'lightning/uiRecordApi';
import ASSETS from '@salesforce/resourceUrl/assets';
import SEARCH from '@salesforce/label/c.Search';
import NAME_FIELD from '@salesforce/schema/Property__c.Name';

const TAB_LABEL = 'Property Details';
const COLUMNS = [
    { label: 'Property Name', fieldName: NAME_FIELD.fieldApiName, type: 'text' },
    { label: SEARCH, fieldName: 'Price__c', type: 'currency' }
];

export default class UiStrings extends LightningElement {
    @api recordId;
    @api cardTitle = 'Property';
    greeting = 'Welcome back';
    searchKey = 'Harry Potter';
    logoUrl = `${ASSETS}/logo.svg`;
    labels = { search: SEARCH };
    columns = COLUMNS;
    errorText;
    errors;
    status = {};

    @wire(getRecord, { recordId: '$recordId', fields: ['Property__c.Name'] })
    property;

    get itemClass() {
        return 'slds-path__item ' + (this.isActive ? 'slds-is-active' : '');
    }

    get logoAlt() {
        return this.recordId ? 'Property photo' : `Photo of ${this.cardTitle}`;
    }

    handleSave() {
        console.log('Saving property');
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: 'Property ' + this.recordId + ' saved',
                variant: 'success'
            })
        );
        Toast.show({ label: 'Saved', message: `Saved ${this.count} items`, mode: 'dismissible' }, this);
        this.dispatchEvent(new CustomEvent('saved', { detail: { id: this.recordId } }));
    }

    async handleDelete() {
        await Alert.open({ message: 'This property was deleted', theme: 'info', label: 'Deleted' });
        await EditModal.open({ size: 'small', description: 'Edit the property', header: this.cardTitle });
    }

    handleError(error) {
        this.status = { message: 'Could not load the property', code: 'E_LOAD' };
        this.errors = ['Price is required'];
        this.template.querySelector('.slds-path__item').classList.add('slds-is-current');
        this.reportError('Failed to load properties');
        this.openTab({ label: TAB_LABEL, url: '/lightning/n/Properties' });
        this.highlight = error.body.message;
    }

    reportError(baseMessage) {
        let message = baseMessage;
        if (this.lastError) {
            message += ': ' + this.lastError;
        }
        this.errorText = message;
    }

    renderMap(property) {
        const popup = `
            <h1>${property.Name}</h1>
            <p>Beds: ${property.Beds__c} - Baths: ${property.Baths__c}</p>`;
        const spacer = '<br/>';
        this.template.querySelector('.map').innerHTML = popup + spacer;
        this.mapCaption = 'Map of the area';
    }

    get pathClass() {
        return `slds-box slds-box_small ${this.mode}-mode`;
    }
}
