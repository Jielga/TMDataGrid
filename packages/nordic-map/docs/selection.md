# Selection

By default, the user selects pins in three ways:

- drag a box to select the pins in it, and hold Shift, Ctrl or Cmd to add them to the selection
- click a pin to select it, or to unselect it when it is selected
- click the empty map to clear the selection

`selected` holds the selected pin ids, and `onSelectionChange` is called with the new ids after each change.
Leave out `selected` to let the map keep its own selection, starting from `defaultSelected`.

## Link the map to a list

`highlighted` draws one pin with a ring, and gives its label the first place.
`onPinHover` is called when the pointer or the keyboard focus moves onto a pin, and with `null` when it leaves.
Together they link the map to a list beside it:

```demo
file: selection/LinkedList.tsx
hint: Point at a city in the list, or at a pin on the map.
height: 480
```

## Selection modes

`selectionMode` sets how pins are selected:

- `"multiple"` - a drag selects the pins in its box, and a click on a pin selects or unselects it
- `"single"` - a click on a pin selects only that pin, and a drag pans the map
- `"none"` - pins are not selected, and a drag pans the map

In single mode a second click on the selected pin clears the selection:

```demo
file: selection/SingleSelection.tsx
height: 480
```

`onPinClick` is called on every click on a pin, in every mode.

## Reference

| Name | Kind | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `selectionMode` | Prop | `SelectionMode` | `"multiple"` | Determines how pins are selected, and whether a drag selects or pans. |
| `selected` | Prop | `string[]` | - | Sets the selected pin ids. If not set, the map keeps its own selection. |
| `defaultSelected` | Prop | `string[]` | `[]` | Sets the selection at the start, when `selected` is not set. |
| `onSelectionChange` | Prop | `(ids: string[]) => void` | - | Called after a drag-select, a pin click or a clear, with the selected ids in `pins` order. |
| `onPinClick` | Prop | `(pin: MapPin<T>) => void` | - | Called when a pin is clicked, or pressed with Enter or Space. |
| `highlighted` | Prop | `string \| null` | `null` | Sets the id of a pin drawn with a ring and labelled first. |
| `onPinHover` | Prop | `(pin: MapPin<T> \| null) => void` | - | Called when the pointer or the keyboard focus moves onto a pin, and with `null` when it leaves. |
| `SelectionMode` | Type | - | - | `"multiple" \| "single" \| "none"` |
