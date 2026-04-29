export interface NodoArchivo {
    nombre: string
    tipo: 'archivo' | 'carpeta'
    contenido?: string
    hijos?: NodoArchivo[] 
    open?: boolean,
    padre?: NodoArchivo
}