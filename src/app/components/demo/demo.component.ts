import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataConfigComponent } from '../data-config/data-config.component';
import { DataTrackerComponent } from '../data-tracker/data-tracker.component';


@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [CommonModule,
    DataConfigComponent,
    DataTrackerComponent 
  ],
  templateUrl: './demo.component.html',
  styleUrls: ['./demo.component.scss']
})
export class DemoComponent { }
