import { Injectable } from '@angular/core';
import { NodoArchivo } from '../../models/nodo-archivo';
import Swal from 'sweetalert2';
import { ZipService } from '../guardar-zip/zip.service';

@Injectable({
  providedIn: 'root',
})
export class ArbolService {

  private readonly COLORS: Record<string, string> = {
    styles: '#cba6f7',
    comp: '#89b4fa',
    y: '#f9e2af',
    dba: '#94e2d5',
  };

  constructor(private zipService: ZipService) { }


  getExt(nombre: string): string {
    const m = nombre.match(/\.(\w+)$/);
    return m ? m[1] : '';
  }

  getColor(nombre: string): string {
    return this.COLORS[this.getExt(nombre)] || '#cdd6f4';
  }

  getLang(nombre: string): string {
    const map: Record<string, string> = {
      styles: 'STYLES', comp: 'COMP', y: 'YFERA', dba: 'DBA'
    };
    return map[this.getExt(nombre)] || 'TEXT';
  }

  getIcon(nodo: NodoArchivo): string {
    if (nodo.tipo === 'carpeta') {
      return (nodo as any).open ? 'folder_open' : 'folder';
    }

    const icons: Record<string, string> = {
      styles: 'brush',
      comp: 'code',
      y: 'terminal',
      dba: 'dns'
    };

    return icons[this.getExt(nodo.nombre)] || 'description';
  }

  clickNodo(nodo: NodoArchivo): NodoArchivo | null {
    if (nodo.tipo === 'carpeta') {
      (nodo as any).open = !(nodo as any).open;
      return null;
    }
    return nodo;
  }

  colapsarTodo(arbol: NodoArchivo[]) {
    const fn = (nodos: NodoArchivo[]) =>
      nodos.forEach(n => {
        if (n.tipo === 'carpeta') { (n as any).open = false; fn(n.hijos || []); }
      });
    fn(arbol);
  }

  expandirTodo(arbol: NodoArchivo[]) {
    const fn = (nodos: NodoArchivo[]) =>
      nodos.forEach(n => {
        if (n.tipo === 'carpeta') { (n as any).open = true; fn(n.hijos || []); }
      });
    fn(arbol);
  }

  crearArchivo(
    arbol: NodoArchivo[],
    onCreado: (nodo: NodoArchivo) => void,
    parentNode?: NodoArchivo
  ) {
    Swal.fire({
      title: 'Nuevo archivo',
      html: `
        <input id="swal-nombre" class="swal2-input" placeholder="Nombre (ej: main)">
        <select id="swal-ext" class="swal2-select">
          <option value="styles">.styles</option>
          <option value="comp">.comp</option>
          <option value="y">.y</option>
          <option value="dba">.dba</option>
        </select>`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Crear',
      preConfirm: () => {
        const nombre = (document.getElementById('swal-nombre') as HTMLInputElement).value;
        const ext = (document.getElementById('swal-ext') as HTMLSelectElement).value;
        if (!nombre) { Swal.showValidationMessage('El nombre es obligatorio'); return; }
        return `${nombre}.${ext}`;
      }
    }).then(result => {
      if (!result.isConfirmed) return;
      const lista = parentNode?.hijos || arbol;
      if (lista.some(n => n.nombre.toLowerCase() === result.value.toLowerCase())) {
        Swal.fire({ icon: 'error', title: 'Archivo duplicado', text: 'Ya existe un archivo con ese nombre' });
        return;
      }
      const nodo: NodoArchivo = { nombre: result.value, tipo: 'archivo', contenido: '' };
      if (parentNode) parentNode.hijos!.push(nodo); else arbol.push(nodo);
      onCreado(nodo);
    });
  }

  crearCarpeta(arbol: NodoArchivo[], parentNode?: NodoArchivo) {
    Swal.fire({
      title: 'Nueva carpeta',
      input: 'text',
      inputPlaceholder: 'Ej: componentes',
      showCancelButton: true,
      confirmButtonText: 'Crear',
      inputValidator: v => !v ? 'El nombre es obligatorio' : null
    }).then(result => {
      if (!result.isConfirmed) return;
      const nodo: any = { nombre: result.value, tipo: 'carpeta', open: true, hijos: [] };
      if (parentNode) parentNode.hijos!.push(nodo); else arbol.push(nodo);
    });
  }

  crearArchivoEn(
    e: Event,
    nodo: NodoArchivo,
    arbol: NodoArchivo[],
    onCreado: (nodo: NodoArchivo) => void
  ) {
    e.stopPropagation();
    (nodo as any).open = true;
    this.crearArchivo(arbol, onCreado, nodo);
  }

  crearCarpetaEn(e: Event, nodo: NodoArchivo, arbol: NodoArchivo[]) {
    e.stopPropagation();
    (nodo as any).open = true;
    this.crearCarpeta(arbol, nodo);
  }

  eliminar(
    e: Event,
    nodo: NodoArchivo,
    lista: NodoArchivo[],
    onEliminado: (nodo: NodoArchivo) => void
  ) {
    e.stopPropagation();
    Swal.fire({
      title: '¿Eliminar?', text: `Se eliminará "${nodo.nombre}"`,
      icon: 'warning', showCancelButton: true,
      confirmButtonText: 'Sí, eliminar', confirmButtonColor: '#e63946'
    }).then(result => {
      if (!result.isConfirmed) return;
      lista.splice(lista.indexOf(nodo), 1);
      onEliminado(nodo);
    });
  }


  async exportarZip(arbol: NodoArchivo[]) {
    const result = await Swal.fire({
      title: 'Nombre del proyecto', input: 'text',
      inputPlaceholder: 'mi-proyecto', showCancelButton: true,
      confirmButtonText: 'Exportar .zip'
    });
    if (!result.isConfirmed || !result.value) return;
    await this.zipService.exportarZip(arbol, result.value);
  }

  async abrirProyecto(onCargado: (arbol: NodoArchivo[]) => void) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.zip,.json';
    inp.onchange = async (e: any) => {
      const file: File = e.target.files[0];
      if (!file) return;
      try {
        let nuevoArbol: NodoArchivo[];
        if (file.name.endsWith('.zip')) {
          nuevoArbol = await this.zipService.importarZip(file);
        } else {
          const data = JSON.parse(await file.text());
          const hidratar = (nodos: any[]): NodoArchivo[] => nodos.map(n => ({
            nombre: n.nombre, tipo: n.tipo, open: n.tipo === 'carpeta',
            hijos: n.hijos ? hidratar(n.hijos) : [],
            contenido: n.tipo === 'archivo' ? (n.contenido || '') : undefined
          }));
          nuevoArbol = hidratar(data);
        }
        onCargado(nuevoArbol);
        Swal.fire({ icon: 'success', title: 'Proyecto cargado', timer: 1500, showConfirmButton: false });
      } catch (err: any) {
        Swal.fire({ icon: 'error', title: 'Error al abrir', text: err.message });
      }
    };
    inp.click();
  }


  verArbolTrabajo(arbol: NodoArchivo[]) {
    const serializar = (nodos: NodoArchivo[]): string =>
      nodos.map(n => {

        const icono = this.getIcon(n); // 👈 usamos tu método
        const color = n.tipo === 'archivo' ? this.getColor(n.nombre) : '#cdd6f4';

        const hijos = n.tipo === 'carpeta' && n.hijos?.length
          ? `<ul style="list-style:none;padding-left:24px;border-left:1px dashed #444;margin:4px 0">
            ${serializar(n.hijos)}
           </ul>`
          : '';

        return `
        <li style="margin:6px 0; display:flex; align-items:center; gap:6px;">
          
          <span class="material-icons" style="font-size:18px; color:${color}">
            ${icono}
          </span>

          <span style="color:${color}; font-size:13px; font-family:monospace">
            ${n.nombre}
          </span>

          ${hijos}
        </li>
      `;
      }).join('');

    Swal.fire({
      title: 'Árbol de trabajo',
      html: `
      <ul style="list-style:none;padding:0;text-align:left;max-height:60vh;overflow-y:auto">
        ${serializar(arbol)}
      </ul>
    `,
      width: 600,
      confirmButtonText: 'Cerrar'
    });
  }


  obtenerTodosLosArchivos(nodos: NodoArchivo[]): NodoArchivo[] {
    let archivos: NodoArchivo[] = [];
    for (const nodo of nodos) {
      if (nodo.tipo === 'archivo') archivos.push(nodo);
      if (nodo.tipo === 'carpeta' && nodo.hijos)
        archivos = archivos.concat(this.obtenerTodosLosArchivos(nodo.hijos));
    }
    return archivos;
  }
}
