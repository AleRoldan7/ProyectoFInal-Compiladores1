import { Injectable } from '@angular/core';
import { SqliteService } from '../sql/sqlite.service';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root',
})
export class DbaService {

  constructor(private sqlite: SqliteService) { }

  verBaseDeDatos() {
    if (!this.sqlite.listo) {
      Swal.fire({
        icon: 'warning',
        title: 'SQLite no iniciado',
        text: 'Ejecuta el proyecto primero o escribe un comando en la terminal.'
      });
      return;
    }

    const tablas = this.sqlite.listarTablas();
    if (tablas.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Base de datos vacía',
        text: 'No hay tablas. Usa la terminal o ejecuta un .dba.'
      });
      return;
    }

    const html = this.construirHTML(tablas);

    Swal.fire({
      title: '🗄️ Base de datos SQLite',
      html,
      width: '80vw',
      background: '#1e1e2e',
      color: '#cdd6f4',
      confirmButtonText: 'Cerrar',
      confirmButtonColor: '#cba6f7',
      showDenyButton: true,
      denyButtonText: '⬇ Descargar .db',
      denyButtonColor: '#45475a'
    }).then(r => {
      if (r.isDenied) this.sqlite.descargarDB('yfera-database');
    });
  }

  private construirHTML(tablas: string[]): string {
    let html = '<div style="text-align:left;max-height:70vh;overflow-y:auto;font-family:monospace;">';

    for (const tabla of tablas) {
      const { columnas, filas } = this.sqlite.verTabla(tabla);
      const schema = this.sqlite.verSchema(tabla);

      html += `
        <div style="margin-bottom:20px;">
          <div style="
            background:#313244;color:#cba6f7;padding:6px 12px;
            border-radius:4px 4px 0 0;font-size:13px;font-weight:bold;
            display:flex;justify-content:space-between;">
            <span>📋 ${tabla}</span>
            <span style="color:#6c7086;font-size:11px;">${filas.length} registro(s)</span>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:12px;background:#1e1e2e;">
            <thead><tr>
              ${columnas.map(c => {
        const col = schema.find((s: any) => s.name === c);
        return `<th style="
                  background:#45475a;color:#cdd6f4;padding:6px 10px;
                  border:1px solid #313244;text-align:left;white-space:nowrap;">
                  ${c}
                  <span style="color:#6c7086;font-size:10px;display:block;">
                    ${col?.type || ''}${col?.pk ? ' 🔑' : ''}
                  </span>
                </th>`;
      }).join('')}
            </tr></thead>
            <tbody>
              ${filas.length === 0
          ? `<tr><td colspan="${columnas.length}" style="
                    text-align:center;padding:10px;color:#6c7086;
                    border:1px solid #313244;">Sin registros</td></tr>`
          : filas.map((fila, idx) => `
                    <tr style="background:${idx % 2 === 0 ? '#1e1e2e' : '#181825'}">
                      ${fila.map(celda => `
                        <td style="
                          padding:5px 10px;border:1px solid #313244;
                          color:${celda === null ? '#6c7086' : '#cdd6f4'};
                          white-space:nowrap;">
                          ${celda === null ? 'NULL' : celda}
                        </td>`).join('')}
                    </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }

    html += '</div>';
    return html;
  }
}
