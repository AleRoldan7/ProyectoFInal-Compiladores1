import { ElementRef, Injectable } from '@angular/core';
import { NodoArchivo } from '../../models/nodo-archivo';
import { CodigoService, ImportError } from '../tabulacion-color/codigo.service';
import { YferaHighlighter } from '../../clases/analizador/color-lenguaje';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root',
})
export class PestanasService {


  editorRef!: ElementRef<HTMLTextAreaElement>;
  colorInput!: ElementRef<HTMLInputElement>;

  archivoActual: NodoArchivo | null = null;
  contenido: string = '';
  pestanasAbiertas: NodoArchivo[] = [];
  lineas: number[] = [1];
  cursorPos: string = 'Ln 1, Col 1';
  codigoColoreado: SafeHtml = '';
  importErrors: ImportError[] = [];
  lineasConErrorImport = new Set<number>();

  private _importTimer: any;

  constructor(private highlighter: CodigoService, private sanitizar: DomSanitizer) { }


  abrirTab(nodo: NodoArchivo, arbol: NodoArchivo[]) {
    if (!this.pestanasAbiertas.includes(nodo)) {
      this.pestanasAbiertas.push(nodo);
    }
    this.archivoActual = nodo;
    this.contenido = nodo.contenido || '';
    this.importErrors = [];
    this.lineasConErrorImport.clear();
    this.updateLineNums();
    this.actualizarHighlight();


    if (nodo.nombre.endsWith('.y')) {
      this.validarImports(arbol);
    }
  }

  switchTab(nodo: NodoArchivo, arbol: NodoArchivo[]) {
    this.abrirTab(nodo, arbol);
  }

  cerrarTab(e: Event, nodo: NodoArchivo) {
    e.stopPropagation();
    this.pestanasAbiertas = this.pestanasAbiertas.filter(t => t !== nodo);
    if (this.archivoActual === nodo) {
      this.archivoActual = this.pestanasAbiertas[this.pestanasAbiertas.length - 1] || null;
      this.contenido = this.archivoActual?.contenido || '';
      this.updateLineNums();
    }
  }


  onEdit(arbol: NodoArchivo[]) {
    if (this.archivoActual) this.archivoActual.contenido = this.contenido;
    this.updateLineNums();
    this.actualizarHighlight();

    if (this.archivoActual?.nombre.endsWith('.y')) {
      clearTimeout(this._importTimer);
      this._importTimer = setTimeout(() => this.validarImports(arbol), 800);
    }
  }

  handleKeydown(e: KeyboardEvent, arbol: NodoArchivo[]) {
    const ed = this.editorRef.nativeElement;

    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ed.selectionStart, end = ed.selectionEnd;
      this.contenido = this.contenido.substring(0, s) + '    ' + this.contenido.substring(end);
      setTimeout(() => { ed.selectionStart = ed.selectionEnd = s + 4; });
      this.onEdit(arbol);
      console.log("SI esta en TAB")
      return;
    }

    if (e.ctrlKey && e.shiftKey && e.key === 'I') {
      e.preventDefault();
      this.autoIndentar();
      return;
    }

    if (['{', '[', '('].includes(e.key) && this.archivoActual) {
      const pares: Record<string, string> = { '{': '}', '[': ']', '(': ')' };
      const s = ed.selectionStart, end = ed.selectionEnd;
      if (s === end) {

        const cierre = pares[e.key];
        this.contenido = this.contenido.substring(0, s) + e.key + cierre + this.contenido.substring(end);
        setTimeout(() => { ed.selectionStart = ed.selectionEnd = s + 1; });
        this.onEdit(arbol);
        console.log("Esta en {")
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const s = ed.selectionStart;
      const lineaActual = this.contenido.substring(0, s).split('\n').pop() || '';
      const indentActual = lineaActual.match(/^(\s*)/)?.[1] || '';
      const terminaEnApertura = /[{[(]\s*$/.test(lineaActual.trim());
      const indent = terminaEnApertura ? indentActual + '    ' : indentActual;
      this.contenido = this.contenido.substring(0, s) + '\n' + indent + this.contenido.substring(s);
      setTimeout(() => { ed.selectionStart = ed.selectionEnd = s + 1 + indent.length; });
      this.onEdit(arbol);
      console.log("ENTER ESTA")
      return;
    }
  }

  get color(): string {
    const nombre = this.archivoActual?.nombre ?? '';
    return YferaHighlighter.highlight(this.contenido, nombre)
  }

  actualizarHighlight() {
    if (!this.archivoActual) {
      this.codigoColoreado = '';
      return;
    }
    const ext = this.getExt(this.archivoActual.nombre);
    const html = this.highlighter.colorear(this.contenido, ext);

    this.codigoColoreado = this.sanitizar.bypassSecurityTrustHtml(html);
  }

  autoIndentar() {
    if (!this.archivoActual) return;
    const ext = this.getExt(this.archivoActual.nombre);
    const indentado = this.highlighter.indentar(this.contenido, ext);
    this.contenido = indentado;
    this.archivoActual.contenido = indentado;
    this.updateLineNums();
    this.actualizarHighlight();
  }


  validarImports(arbol: NodoArchivo[]) {
    if (!this.archivoActual?.nombre.endsWith('.y')) return;
    this.importErrors = this.highlighter.validarImports(this.contenido, arbol);
    this.lineasConErrorImport.clear();
    this.importErrors.forEach(err => this.lineasConErrorImport.add(err.linea));
  }

  tieneErrorImport(numeroLinea: number): boolean {
    return this.lineasConErrorImport.has(numeroLinea);
  }


  updateLineNums() {
    const count = (this.contenido || '').split('\n').length;
    this.lineas = Array.from({ length: count }, (_, i) => i + 1);
  }

  updatePos(ed: HTMLTextAreaElement) {
    const txt = ed.value.substring(0, ed.selectionStart);
    const ln = txt.split('\n').length;
    const col = txt.split('\n').pop()!.length + 1;
    this.cursorPos = `Ln ${ln}, Col ${col}`;
  }

  syncScroll(
    editor: HTMLTextAreaElement,
    lineNums: HTMLElement,
    highlight: HTMLElement
  ) {
    lineNums.scrollTop = editor.scrollTop;
    highlight.scrollTop = editor.scrollTop;
    highlight.scrollLeft = editor.scrollLeft;
  }

  abrirSelectorColor() {
    this.colorInput.nativeElement.click();
  }

  insertarColor(color: string) {
    if (!this.archivoActual) return;
    const ed = this.editorRef.nativeElement;
    const s = ed.selectionStart, end = ed.selectionEnd;
    this.contenido = this.contenido.substring(0, s) + color + this.contenido.substring(end);
    this.archivoActual.contenido = this.contenido;
    setTimeout(() => { ed.selectionStart = ed.selectionEnd = s + color.length; ed.focus(); });
  }


  getExt(nombre: string): string {
    const m = nombre.match(/\.(\w+)$/);
    return m ? m[1] : '';
  }
}
