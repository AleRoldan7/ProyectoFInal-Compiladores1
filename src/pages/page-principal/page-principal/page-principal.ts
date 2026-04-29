import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NodoArchivo } from '../../../models/nodo-archivo';
import Swal from 'sweetalert2';
import { PestanasService } from '../../../service/editor/pestanas.service';
import { ArbolService } from '../../../service/arbol/arbol.service';
import { CodigoCompiladoService } from '../../../service/validacion-codigo/codigo-compilado.service';
import { TerminalService } from '../../../service/terminal/terminal.service';
import { DbaService } from '../../../service/dba/dba.service';


export interface ErrorReporte {
  lexema: string;
  linea: number;
  columna: number;
  tipo: string;
  descripcion: string;
}

interface LineaTerminal {
  texto: string;
  tipo: 'input' | 'output' | 'error' | 'info';
}


@Component({
  selector: 'app-page-principal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './page-principal.html',
  styleUrl: './page-principal.css',
})
export class PagePrincipal {

  @ViewChild('textarea') editorRef!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('colorInput') colorInput!: ElementRef<HTMLInputElement>;
  @ViewChild('terminalBody') terminalBody!: ElementRef<HTMLDivElement>;

  arbol: NodoArchivo[] = [
    {
      nombre: 'src', tipo: 'carpeta', open: true,
      hijos: [
        {
          nombre: 'assets', tipo: 'carpeta', open: false,
          hijos: [
            {
              nombre: 'styles', tipo: 'carpeta', open: false, hijos: [
                { nombre: 'main.styles', tipo: 'archivo', contenido: '/* estilos globales */' }
              ]
            },
          ]
        },
        {
          nombre: 'pages', tipo: 'carpeta', open: true,
          hijos: [
            {
              nombre: 'about', tipo: 'carpeta', open: false, hijos: [
                { nombre: 'about.comp', tipo: 'archivo', contenido: 'AboutComponent(){\n    [\n        T("Bienvenido")\n    ]\n}' }
              ]
            }
          ]
        },
        { nombre: 'index.y', tipo: 'archivo', contenido: 'import "./pages/about/about.comp";\n\nmain {\n    @AboutComponent();\n}' },
        { nombre: 'db.dba', tipo: 'archivo', contenido: 'TABLE users COLUMNS name=string, age=int;\nusers[name="Alice", age=25];\nusers.name;' }
      ]
    }
  ];

  consolaMode: 'console' | 'errors' | 'terminal' = 'console';

  constructor(
    public editor: PestanasService,
    public fileTree: ArbolService,
    public compiler: CodigoCompiladoService,
    public terminal: TerminalService,
    public dbViewer: DbaService,
    private cdr: ChangeDetectorRef
  ) {
    this.terminal.init();
  }


  ngAfterViewInit() {
    this.editor.editorRef = this.editorRef;
    this.editor.colorInput = this.colorInput;
    this.terminal.terminalBody = this.terminalBody;
  }



  clickNodo(nodo: NodoArchivo) {
    const archivo = this.fileTree.clickNodo(nodo);
    if (archivo) {
      this.editor.abrirTab(archivo, this.arbol);
      this.cdr.detectChanges();   // ← AGREGAR
    }
  }

  crearArchivoEn(e: Event, nodo: NodoArchivo) {
    this.fileTree.crearArchivoEn(e, nodo, this.arbol,
      (nuevo) => this.editor.abrirTab(nuevo, this.arbol)
    );
  }

  crearCarpetaEn(e: Event, nodo: NodoArchivo) {
    this.fileTree.crearCarpetaEn(e, nodo, this.arbol);
  }

  crearArchivo() {
    this.fileTree.crearArchivo(this.arbol,
      (nuevo) => this.editor.abrirTab(nuevo, this.arbol)
    );
  }

  crearCarpeta() {
    this.fileTree.crearCarpeta(this.arbol);
  }

  eliminar(e: Event, nodo: NodoArchivo, lista: NodoArchivo[]) {
    this.fileTree.eliminar(e, nodo, lista, (eliminado) => {
      this.editor.pestanasAbiertas = this.editor.pestanasAbiertas.filter(t => t !== eliminado);
      if (this.editor.archivoActual === eliminado) {
        this.editor.archivoActual = this.editor.pestanasAbiertas[this.editor.pestanasAbiertas.length - 1] || null;
        this.editor.contenido = this.editor.archivoActual?.contenido || '';
        this.editor.updateLineNums();
      }
    });
  }

  colapsarTodo() { this.fileTree.colapsarTodo(this.arbol); }
  expandirTodo() { this.fileTree.expandirTodo(this.arbol); }

  exportarZip() { this.fileTree.exportarZip(this.arbol); }
  verArbolTrabajo() { this.fileTree.verArbolTrabajo(this.arbol); }

  abrirProyecto() {
    this.fileTree.abrirProyecto((nuevoArbol) => {
      this.arbol = nuevoArbol;
      this.editor.pestanasAbiertas = [];
      this.editor.archivoActual = null;
      this.editor.contenido = '';
      this.editor.updateLineNums();
    });
  }



  switchTab(nodo: NodoArchivo) {
    this.editor.switchTab(nodo, this.arbol);
    this.cdr.detectChanges();   
    
  }

  cerrarTab(e: Event, nodo: NodoArchivo) {
    this.editor.cerrarTab(e, nodo);
  }

  onEdit() {
    this.editor.onEdit(this.arbol);
    this.cdr.detectChanges();
  }

  handleKeydown(e: KeyboardEvent) {
    this.editor.handleKeydown(e, this.arbol);
  }

  syncScroll(textarea: HTMLTextAreaElement, highlight: HTMLElement) {
    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
  }

  updatePos(ed: HTMLTextAreaElement) {
    this.editor.updatePos(ed);
  }

  mostrarErroresImport() {
    if (!this.editor.importErrors.length) return;
    const html = this.editor.importErrors.map(err => `
      <div style="
        background:#1a1a0a;border:1px solid #9e6a03;border-radius:4px;
        padding:8px 12px;margin-bottom:8px;font-family:monospace;
        font-size:12px;text-align:left;">
        <div style="color:#d29922;margin-bottom:4px;">
          Línea ${err.linea} — <span style="color:#58a6ff">${err.ruta}</span>
        </div>
        <div style="color:#8b949e;">${err.mensaje}</div>
      </div>
    `).join('');

    Swal.fire({
      title: 'Errores de Import',
      html: `<div style="max-height:50vh;overflow-y:auto">${html}</div>`,
      background: '#161b22', color: '#c9d1d9',
      confirmButtonText: 'Entendido', confirmButtonColor: '#238636',
      width: '600px'
    });
  }

  async ejecutar() {
    this.consolaMode = await this.compiler.ejecutar(this.arbol);
  }

  verBaseDeDatos() {
    this.dbViewer.verBaseDeDatos();
  }


}