import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NodoArchivo } from '../../../models/nodo-archivo';
import { ParserJison } from '../../../models/parser-type';

/* PARSERS */
import * as parserStyle from '../../../analisisis-jison/analizador-style.js';
import * as parserComponent from '../../../analisisis-jison/analizador-component.js';
import * as parserPrincipal from '../../../analisisis-jison/analizador-lenguaje-principal.js';
import * as parserDBA from '../../../analisisis-jison/analizador-dba.js';
import Swal from 'sweetalert2';
import { RenderService } from '../../../service/render.service';


@Component({
  selector: 'app-page-principal',
  imports: [CommonModule, FormsModule],
  templateUrl: './page-principal.html',
  styleUrl: './page-principal.css',
})
export class PagePrincipal {

  arbol: NodoArchivo[] = [
    {
      nombre: 'src',
      tipo: 'carpeta',
      hijos: [
        {
          nombre: 'main.y',
          tipo: 'archivo',
          contenido: ''
        },
        {
          nombre: 'estilos.styles',
          tipo: 'archivo',
          contenido: ''
        }
      ]
    }
  ];

  constructor(private render: RenderService) { }

  archivoActual: NodoArchivo | null = null;
  contenido: string = '';

  seleccionar(nodo: NodoArchivo) {
    if (nodo.tipo === 'archivo') {
      this.archivoActual = nodo;
      this.contenido = nodo.contenido || '';
    }
  }

  guardarContenido() {
    if (this.archivoActual) {
      this.archivoActual.contenido = this.contenido;
    }
  }

  crearCarpeta(nodo?: NodoArchivo) {
    const nombre = prompt('Nombre de la carpeta');
    if (!nombre) return;

    const nueva: NodoArchivo = {
      nombre,
      tipo: 'carpeta',
      hijos: []
    };

    if (!nodo) {
      this.arbol.push(nueva);
    } else {
      nodo.hijos?.push(nueva);
    }
  }

  crearArchivo(nodo?: NodoArchivo) {
    const nombre = prompt('Nombre del archivo (ej: archivo.styles)');
    if (!nombre) return;

    const nuevo: NodoArchivo = {
      nombre,
      tipo: 'archivo',
      contenido: ''
    };

    if (!nodo) {
      this.arbol.push(nuevo);
    } else {
      nodo.hijos?.push(nuevo);
    }
  }

  eliminar(nodo: NodoArchivo, lista: NodoArchivo[]) {
    const index = lista.indexOf(nodo);
    if (index !== -1) {
      lista.splice(index, 1);
    }
  }

  getParser(nombre: string): any {

    if (nombre.endsWith('.styles')) return parserStyle;
    if (nombre.endsWith('.comp')) return parserComponent;
    if (nombre.endsWith('.dba')) return parserDBA;
    if (nombre.endsWith('.y')) return parserPrincipal;

    return null;
  }

  ejecutar() {

    try {

      let astGlobal: any[] = [];

      const recorrer = (nodos: NodoArchivo[]) => {

        for (let nodo of nodos) {

          if (nodo.tipo === 'archivo') {

            const parser = this.getParser(nodo.nombre);

            if (parser && nodo.contenido) {

              const ast = parser.parser.parse(nodo.contenido);

              astGlobal.push(ast);
            }

          } else if (nodo.hijos) {
            recorrer(nodo.hijos);
          }
        }
      };

      recorrer(this.arbol);

      // 🔥 renderizar TODO
      const html = this.render.render(astGlobal);

      console.log(html);

      const ventana = window.open();
      ventana?.document.write(`
      <html>
        <body>
          ${html}
        </body>
      </html>
    `);

    } catch (error: any) {

      console.error(error);

      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message
      });
    }
  }

  obtenerTodosLosArchivos(nodos: NodoArchivo[]): NodoArchivo[] {

    let archivos: NodoArchivo[] = [];

    for (const nodo of nodos) {

      if (nodo.tipo === 'archivo') {
        archivos.push(nodo);
      }

      if (nodo.tipo === 'carpeta' && nodo.hijos) {
        archivos = archivos.concat(this.obtenerTodosLosArchivos(nodo.hijos));
      }
    }

    return archivos;
  }
}