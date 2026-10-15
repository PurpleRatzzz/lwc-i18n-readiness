orderStatusPath: success/error toast shows the picklist API value instead of the label

### Summary

`orderStatusPath` renders each path step with the picklist **label** (`pathItem.label`), but the toast shown after a status change uses the picklist **API value**:

https://github.com/trailheadapps/ebikes-lwc/blob/c60a6c1cfae41e2f8bf6cf4f961a4f07954abfee/force-app/main/default/lwc/orderStatusPath/orderStatusPath.js#L139

```js
message: `Order status set to "${value}"`,
```

The error message a few lines below (`Failed to update order status to "${value}"`) has the same issue. Both paths are hit by a click on the path and by an incoming `Manufacturing_Event__e`, since `handleManufacturingEvent` also passes the API value (`payload.Status__c`) to `setPicklistValue`.

With the shipped metadata this is invisible, because every `Status__c` value has a label identical to its API name (for example `In Production` / `In Production`). It becomes visible as soon as a label differs from its API name, which happens when an admin renames a value or when the picklist is translated through Translation Workbench. The user then sees one name on the path and a different name in the toast.

The Jest mock `getPicklistValues.json` also uses identical labels and values (`A`/`A`, `B`/`B`, ...), so the existing tests can't catch it.

I found this while reviewing the code for localization issues. I haven't reproduced it in a deployed org yet; the steps below follow from the code path.

### Salesforce Org Type

Not tied to an org type (found by code review).

### Steps To Reproduce

1. Deploy ebikes-lwc and open an `Order__c` record page that contains the `orderStatusPath` component.
2. In Setup → Object Manager → Order → Fields & Relationships → Status, edit the `In Production` value and change only its **label** (for example to `Being Built`). Leave the API name as `In Production`.
   (Alternatively: enable Translation Workbench, translate the `Status__c` picklist values into another language, and switch the user's language.)
3. Click the `Being Built` step on the path.

### Current Behavior

The path shows `Being Built`, but the toast says `Order status set to "In Production"`. With a translated picklist, the path is in the user's language and the toast shows the English API name.

### Expected Behavior

The toast shows the same label the user sees on the path: `Order status set to "Being Built"`.

### Possible fix

Look up the label from the picklist values the component already has, and fall back to the API value if it isn't found:

```js
async setPicklistValue(value) {
    const label =
        this.picklistValues?.find((plValue) => plValue.value === value)
            ?.label ?? value;
    // ...
    message: `Order status set to "${label}"`,
    // ...
    this.reportError(`Failed to update order status to "${label}"`, error);
}
```

To cover this in Jest, one of the values in `getPicklistValues.json` could get a label that differs from its value, and a new test could listen for the toast event and check its message (the current tests don't assert on toasts).

I'm happy to open a PR with the fix and the test update if that's useful.
