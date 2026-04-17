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

    if (!this.archivoActual) {
      alert("Selecciona un archivo");
      return;
    }

    this.guardarContenido();

    const parser = this.getParser(this.archivoActual.nombre);

    if (!parser) {
      alert("Tipo de archivo no soportado");
      return;
    }

    try {

      const resultado = parser.parser.parse(this.contenido);

      console.log("Análisis exitoso");
      console.log(resultado);

      alert("Análisis correcto");

    } catch (error: any) {

      console.error("Error:", error.message);
      alert("Error: " + error.message);
    }
  }
}