import { Token } from './token';

export class ManejoErrores {

  private tokens: Token[] = [];
  private errores: Token[] = [];

  reset() {
    this.tokens = [];
    this.errores = [];
  }

  agregarToken(lexema: string, line: number, column: number, description: string, type: string) {
    this.tokens.push(new Token(lexema, line, column, description, type));
  }

  /* ERRORES LEXICOS */

  errorLexico(lexema: string, linea: number, columna: number) {
    this.errores.push(new Token(
      lexema, linea, columna,
      `Caracter no reconocido: '${lexema}'`,
      'LEXICO'
    ));
  }

  /* ERRORES SINTACTICOS */

  errorSintactico(lexema: string, linea: number, columna: number, descripcion: string) {
    this.errores.push(new Token(
      lexema,
      linea,
      columna,
      descripcion,
      'SINTACTICO'
    ));
  }


}
