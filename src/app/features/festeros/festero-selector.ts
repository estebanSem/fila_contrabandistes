import { Component, input, output } from '@angular/core';
import { Festero } from '../../core/models/domain';
@Component({
  selector: 'app-festero-selector',
  template: `<label
    >{{ label()
    }}<select [value]="value()" (change)="selected.emit($any($event.target).value)">
      <option value="">Selecciona una persona</option>
      @for (person of people(); track person.id) {
        <option [value]="person.id">{{ person.apellidos }}, {{ person.nombre }}</option>
      }
    </select></label
  >`,
})
export class FesteroSelector {
  readonly label = input.required<string>();
  readonly people = input.required<Festero[]>();
  readonly value = input('');
  readonly selected = output<string>();
}
