import { Routes } from '@angular/router';
import { PagePrincipal } from '../pages/page-principal/page-principal/page-principal';

export const routes: Routes = [

    { path: '', redirectTo: 'editor', pathMatch: 'full' },
    { path: 'editor', component: PagePrincipal },

];
