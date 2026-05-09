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
import { SqliteService } from '../../../service/sql/sqlite.service';
import { ProyectoService } from '../../../service/proyecto/proyecto.service';


export interface ErrorReporte {
  lexema: string;
  linea: number;
  columna: number;
  tipo: string;
  descripcion: string;
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
  @ViewChild('lineNums') lineNums!: ElementRef<HTMLDivElement>;


  consolaMode: 'console' | 'errors' | 'terminal' | 'debug' = 'console';
  consolaDebug: string[] = [];
  private sql = new SqliteService();

  constructor(
    public editor: PestanasService,
    public fileTree: ArbolService,
    public compiler: CodigoCompiladoService,
    public terminal: TerminalService,
    public dbViewer: DbaService,
    public proyectos: ProyectoService,
    private cdr: ChangeDetectorRef
  ) {
    this.terminal.init();
    this.interceptarConsola();

    if (this.proyectos.proyectos.length === 0) {
      this.proyectos.crearProyecto('Mi Proyecto');
    }
  }

  get arbol(): NodoArchivo[] {
    return this.proyectos.arbolActivo;
  }


  private interceptarConsola() {
    const original = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    };

    console.log = (...args: any[]) => {
      original.log(...args);
      this.agregarMensajeDebug('LOG', args.join(' '));
    };

    console.error = (...args: any[]) => {
      original.error(...args);
      this.agregarMensajeDebug('ERROR', args.join(' '));
    };

    console.warn = (...args: any[]) => {
      original.warn(...args);
      this.agregarMensajeDebug('WARN', args.join(' '));
    };

    console.info = (...args: any[]) => {
      original.info(...args);
      this.agregarMensajeDebug('INFO', args.join(' '));
    };
  }

  nuevoProyecto() {
    Swal.fire({
      title: 'Nuevo proyecto',
      input: 'text',
      inputPlaceholder: 'Nombre del proyecto',
      showCancelButton: true,
      confirmButtonText: 'Crear',
      inputValidator: v => !v ? 'El nombre es obligatorio' : null
    }).then(r => {
      if (!r.isConfirmed) return;
      this.proyectos.crearProyecto(r.value);
      // Cerrar tabs del proyecto anterior
      this.editor.pestanasAbiertas = [];
      this.editor.archivoActual = null;
      this.editor.contenido = '';
      this.editor.updateLineNums();
      this.cdr.detectChanges();
    });
  }

  seleccionarProyecto(id: string) {
    this.proyectos.seleccionar(id);
    // Limpiar tabs al cambiar de proyecto
    this.editor.pestanasAbiertas = [];
    this.editor.archivoActual = null;
    this.editor.contenido = '';
    this.editor.updateLineNums();
    this.cdr.detectChanges();
  }

  eliminarProyecto(e: Event, id: string) {
    e.stopPropagation();
    Swal.fire({
      icon: 'warning',
      title: '¿Eliminar proyecto?',
      text: 'Se perderán todos los archivos.',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      confirmButtonColor: '#e63946'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.proyectos.eliminar(id);
      this.editor.pestanasAbiertas = [];
      this.editor.archivoActual = null;
      this.editor.contenido = '';
      this.cdr.detectChanges();
    });
  }

  private agregarMensajeDebug(tipo: string, mensaje: string) {
    const timestamp = new Date().toLocaleTimeString();
    const msg = `[${timestamp}] [${tipo}] ${mensaje}`;
    this.consolaDebug.push(msg);

    if (this.consolaDebug.length > 100) {
      this.consolaDebug.shift();
    }

    this.cdr.detectChanges();
  }

  limpiarDebug() {
    this.consolaDebug = [];
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
      this.cdr.detectChanges();
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
      Swal.fire({
        title: 'Nombre del proyecto',
        input: 'text',
        inputPlaceholder: 'Mi proyecto importado',
        showCancelButton: true,
        confirmButtonText: 'Importar'
      }).then(r => {
        const nombre = r.value || 'Proyecto importado';
        this.proyectos.importarArbol(nombre, nuevoArbol);
        this.editor.pestanasAbiertas = [];
        this.editor.archivoActual = null;
        this.editor.contenido = '';
        this.cdr.detectChanges();
      });
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
    this.proyectos.marcarModificado();
    this.cdr.detectChanges();
  }


  handleKeydown(e: KeyboardEvent) {
    this.editor.handleKeydown(e, this.arbol);
  }

  syncScroll(
    editor: HTMLTextAreaElement,
    lineNums: HTMLElement,
    highlight: HTMLElement
  ) {
    const scrollTop = editor.scrollTop;

    if (lineNums) lineNums.scrollTop = scrollTop;
    if (highlight) {
      highlight.scrollTop = scrollTop;
      highlight.scrollLeft = editor.scrollLeft;
    }
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
    if (this.compiler.errores.length > 0) {
      this.consolaMode = 'errors';
      Swal.fire({ icon: 'error', title: 'Error en compilación', text: 'El código tuvo fallos' });
    }
  }



  cargarArchivos() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.multiple = true;
    inp.accept = '.y,.comp,.dba,.styles';
    inp.onchange = (e: any) => {
      const files: FileList = e.target.files;
      if (!files || files.length === 0) return;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = (ev: any) => {
          try {
            const contenido = ev.target.result as string;
            const nodo: NodoArchivo = {
              nombre: file.name,
              tipo: 'archivo',
              contenido: contenido
            };
            this.arbol.push(nodo);
            this.editor.abrirTab(nodo, this.arbol);
            this.cdr.detectChanges();
          } catch (err: any) {
            Swal.fire({
              icon: 'error',
              title: 'Error al cargar archivo',
              text: err.message
            });
          }
        };
        reader.readAsText(file);
      }

      Swal.fire({
        icon: 'success',
        title: 'Archivos cargados',
        text: `${files.length} archivo(s) agregado(s) al proyecto`,
        timer: 2000
      });
    };
    inp.click();
  }

  guardarPaginaCompilada() {
    const ventanaAbierta = window.open();
    if (!ventanaAbierta) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo abrir ventana'
      });
      return;
    }

    const archivos = this.fileTree.obtenerTodosLosArchivos(this.arbol);
    const stylesFiles = archivos.filter(a => a.nombre.endsWith('.styles') && a.contenido);
    const stylesCss = stylesFiles.map(s => s.contenido).join('\n');

    const htmlCompleto = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Página YFERA Compilada</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
  <style>
    body {
      background: #f5f5f5;
      color: #333;
    }
    ${stylesCss}
  </style>
</head>
<body>
  ${this.compiler.htmlCompilado || '<p>No hay contenido compilado</p>'}
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"><\/script>
</body>
</html>`;

    ventanaAbierta.document.write(htmlCompleto);
    ventanaAbierta.document.close();

    Swal.fire({
      icon: 'success',
      title: 'Página generada',
      html: `
        <p>La página se ha compilado exitosamente.</p>
        <p>¿Deseas descargar el archivo HTML?</p>
      `,
      showCancelButton: true,
      confirmButtonText: 'Descargar',
      cancelButtonText: 'Cerrar',
      confirmButtonColor: '#a6e3a1'
    }).then(result => {
      if (result.isConfirmed) {
        const blob = new Blob([htmlCompleto], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'pagina-compilada.html';
        a.click();
        URL.revokeObjectURL(a.href);
      }
    });
  }

  limpiarBD() {
    Swal.fire({
      icon: 'warning',
      title: '¿Limpiar base de datos?',
      text: 'Se borrarán todos los datos guardados. Esta acción no se puede deshacer.',
      showCancelButton: true,
      confirmButtonText: 'Sí, limpiar',
      cancelButtonText: 'Cancelar'
    }).then(r => {
      if (r.isConfirmed) {
        this.sql.reiniciar();
        Swal.fire('Listo', 'BD limpiada correctamente', 'success');
      }
    });
  }
  verBaseDeDatos() {
    this.dbViewer.verBaseDeDatos();
  }

}