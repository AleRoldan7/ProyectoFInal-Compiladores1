export class Token {

  lexema!: string;
  line!: number;
  column!: number;
  description!: string;
  type!: string;

  constructor(lexema: string, line: number, column: number, description: string, type: string) {
    this.lexema = lexema;
    this.line = line;
    this.column = column;
    this.description = description;
    this.type = type;
  }

  getLexema() {
    return this.lexema;
  }

  getLine() {
    return this.line;
  }

  getColumn() {
    return this.column;
  }

  getDescription() {
    return this.description;
  }

  getType() {
    return this.type;
  }
}
