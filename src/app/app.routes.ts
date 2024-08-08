import { Routes } from '@angular/router';
import { DemoComponent } from './components/demo/demo.component';

export const routes: Routes = [
  { path: 'home', component: DemoComponent },
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: '**', redirectTo: '/home' }
];
