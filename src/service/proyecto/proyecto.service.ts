import { Injectable } from '@angular/core';
import { NodoArchivo } from '../../models/nodo-archivo';

export interface Proyecto {
  id: string;
  nombre: string;
  arbol: NodoArchivo[];
  fechaCreacion: Date;
  fechaModificacion: Date;
}

@Injectable({ providedIn: 'root' })
export class ProyectoService {

  private readonly STORAGE_KEY = 'yfera_proyectos';
  proyectos: Proyecto[] = [];
  proyectoActivoId: string | null = null;

  constructor() {
    this.cargarDesdeStorage();
  }

  get proyectoActivo(): Proyecto | null {
    return this.proyectos.find(p => p.id === this.proyectoActivoId) ?? null;
  }

  get arbolActivo(): NodoArchivo[] {
    return this.proyectoActivo?.arbol ?? [];
  }

  crearProyecto(nombre: string): Proyecto {
    const p: Proyecto = {
      id: crypto.randomUUID(),
      nombre,
      fechaCreacion: new Date(),
      fechaModificacion: new Date(),
      arbol: [
        {
          nombre: 'src', tipo: 'carpeta', open: true,
          hijos: [
            { nombre: 'index.y',  tipo: 'archivo', contenido: 'import "./componentes.comp";\n\nmain {\n\n}' },
            { nombre: 'componentes.comp', tipo: 'archivo', contenido: 'MiComponente(){\n    [\n        T("Hola YFERA")\n    ]\n}' },
            { nombre: 'estilos.styles', tipo: 'archivo', contenido: '/* estilos */' },
            { nombre: 'base.dba', tipo: 'archivo', contenido: '/* base de datos */' },
          ]
        }
      ]
    };
    this.proyectos.push(p);
    this.proyectoActivoId = p.id;
    this.guardarEnStorage();
    return p;
  }

  seleccionar(id: string) {
    this.proyectoActivoId = id;
    this.guardarEnStorage();
  }

  eliminar(id: string) {
    this.proyectos = this.proyectos.filter(p => p.id !== id);
    if (this.proyectoActivoId === id) {
      this.proyectoActivoId = this.proyectos[0]?.id ?? null;
    }
    this.guardarEnStorage();
  }

  renombrar(id: string, nombre: string) {
    const p = this.proyectos.find(x => x.id === id);
    if (p) { p.nombre = nombre; this.guardarEnStorage(); }
  }

  marcarModificado() {
    if (this.proyectoActivo) {
      this.proyectoActivo.fechaModificacion = new Date();
      this.guardarEnStorage();
    }
  }

  importarArbol(nombre: string, arbol: NodoArchivo[]) {
    const p: Proyecto = {
      id: crypto.randomUUID(),
      nombre,
      arbol,
      fechaCreacion: new Date(),
      fechaModificacion: new Date(),
    };
    this.proyectos.push(p);
    this.proyectoActivoId = p.id;
    this.guardarEnStorage();
    return p;
  }

  guardarEnStorage() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        activo: this.proyectoActivoId,
        proyectos: this.proyectos
      }));
    } catch (e) {
      console.error('[ProyectoService] Error guardando:', e);
    }
  }

  private cargarDesdeStorage() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      this.proyectos = (data.proyectos ?? []).map((p: any) => ({
        ...p,
        fechaCreacion: new Date(p.fechaCreacion),
        fechaModificacion: new Date(p.fechaModificacion),
      }));
      this.proyectoActivoId = data.activo ?? null;
    } catch {
      this.proyectos = [];
      this.proyectoActivoId = null;
    }
  }

  limpiarTodo() {
    this.proyectos = [];
    this.proyectoActivoId = null;
    localStorage.removeItem(this.STORAGE_KEY);
  }
}