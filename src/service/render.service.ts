import { Injectable } from '@angular/core';
import { Interprte } from '../clases/analizador/interprete';

@Injectable({
  providedIn: 'root',
})
export class RenderService {

  render(ast: any): string {

    if (!ast) return '';

    // lista de componentes
    if (Array.isArray(ast)) {
      return ast.map(n => this.render(n)).join('');
    }

    switch (ast.tipo) {

      case 'texto':
        return `<p>${ast.contenido.replace(/"/g, '')}</p>`;

      case 'seccion':
        return `<div>${this.render(ast.hijos)}</div>`;

      case 'imagen':
        return ast.urls.map((u: any) =>
          `<img src=${u.replace(/"/g, '')} />`
        ).join('');

      case 'form':
        return `
          <form>
            ${ast.inputs.map((i: any) => this.render(i)).join('')}
            <button>${ast.submit?.props?.label || 'Enviar'}</button>
          </form>
        `;

      case 'input_text':
        return `<input type="text" placeholder="text" />`;

      case 'input_number':
        return `<input type="number" />`;

      case 'input_bool':
        return `<input type="checkbox" />`;

      default:
        // COMPONENTE
        if (ast.nombre) {
          return `
            <div class="componente">
              ${this.render(ast.elementos)}
            </div>
          `;
        }

        return '';
    }
  }

}
