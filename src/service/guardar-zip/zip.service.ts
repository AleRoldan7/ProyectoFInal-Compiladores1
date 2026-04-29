import { Injectable } from '@angular/core';
import JSZip from 'jszip';
import { NodoArchivo } from '../../models/nodo-archivo';

@Injectable({ providedIn: 'root' })
export class ZipService {

  async exportarZip(arbol: NodoArchivo[], nombreProyecto: string): Promise<void> {
    const zip = new JSZip();
    this.agregarNodosAlZip(zip, arbol, '');
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${nombreProyecto}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  private agregarNodosAlZip(zip: JSZip, nodos: NodoArchivo[], ruta: string) {
    for (const nodo of nodos) {
      const rutaCompleta = ruta ? `${ruta}/${nodo.nombre}` : nodo.nombre;
      if (nodo.tipo === 'archivo') {
        zip.file(rutaCompleta, nodo.contenido || '');
      } else {
        zip.folder(rutaCompleta);
        if (nodo.hijos?.length) {
          this.agregarNodosAlZip(zip, nodo.hijos, rutaCompleta);
        }
      }
    }
  }

  async importarZip(file: File): Promise<NodoArchivo[]> {
    const zip = await JSZip.loadAsync(file);
    const raiz: NodoArchivo[] = [];

    const archivos = Object.keys(zip.files).sort();

    for (const ruta of archivos) {
      const entry = zip.files[ruta];
      const partes = ruta.split('/').filter(p => p);
      if (!partes.length) continue;

      if (entry.dir) {
        this.asegurarCarpeta(raiz, partes);
      } else {
        const contenido = await entry.async('string');
        this.insertarArchivo(raiz, partes, contenido);
      }
    }

    return raiz;
  }

  private asegurarCarpeta(raiz: NodoArchivo[], partes: string[]): NodoArchivo {
    let nivel = raiz;
    let nodoActual!: NodoArchivo;
    for (const parte of partes) {
      let nodo = nivel.find(n => n.nombre === parte && n.tipo === 'carpeta');
      if (!nodo) {
        nodo = { nombre: parte, tipo: 'carpeta', open: true, hijos: [] };
        nivel.push(nodo);
      }
      nivel = nodo.hijos!;
      nodoActual = nodo;
    }
    return nodoActual;
  }

  private insertarArchivo(raiz: NodoArchivo[], partes: string[], contenido: string) {
    if (partes.length === 1) {
      raiz.push({ nombre: partes[0], tipo: 'archivo', contenido });
      return;
    }
    const carpetaPartes = partes.slice(0, -1);
    const nombreArchivo = partes[partes.length - 1];
    const carpeta = this.asegurarCarpeta(raiz, carpetaPartes);
    carpeta.hijos!.push({ nombre: nombreArchivo, tipo: 'archivo', contenido });
  }
}