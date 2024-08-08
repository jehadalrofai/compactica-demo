import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfigComponent } from '../config/config.component';
import { DataTrackerComponent } from '../data-tracker/data-tracker.component';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ConfigComponent,
    DataTrackerComponent
  ],
  templateUrl: './demo.component.html',
  styleUrls: ['./demo.component.scss']
})
export class DemoComponent {
  public activeTab: string = 'configurations';

  public setActiveTab(tabName: string) {
    this.activeTab = tabName;
  }
}