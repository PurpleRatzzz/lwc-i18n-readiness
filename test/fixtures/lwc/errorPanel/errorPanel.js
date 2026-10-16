import { LightningElement, api } from 'lwc';
import inlineMessage from './templates/inlineMessage.html';
import noDataIllustration from './templates/noDataIllustration.html';

export default class ErrorPanel extends LightningElement {
    @api errors;
    @api friendlyText = 'Error retrieving data';
    @api type;

    render() {
        return this.type === 'inlineMessage' ? inlineMessage : noDataIllustration;
    }
}
