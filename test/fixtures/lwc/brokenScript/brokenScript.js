import { LightningElement } from 'lwc';

// Deliberately broken: the scanner must report this file and keep going.
export default class BrokenScript extends LightningElement {
    handleClick() {
        this.message = 'Unclosed string;
    }
}
